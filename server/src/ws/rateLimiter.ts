import type { Socket } from 'socket.io';

export interface WsRateLimitConfig {
  maxGlobalConnections: number;
  handshakeWindowMs: number;
  maxHandshakesPerIp: number;
  maxSocketsPerUser: number;
  maxSocketsPerIp: number;
  eventWindowMs: number;
  maxEventsPerSocket: number;
  eventFloodThreshold: number;
  typingThrottleMs: number;
}

const isTestEnv = process.env.NODE_ENV === 'test';

export const DEFAULT_WS_RATE_LIMIT_CONFIG: WsRateLimitConfig = {
  maxGlobalConnections: isTestEnv ? 1000 : 5000,
  handshakeWindowMs: 10000,
  maxHandshakesPerIp: isTestEnv ? 500 : 30,
  maxSocketsPerUser: isTestEnv ? 50 : 5,
  maxSocketsPerIp: isTestEnv ? 500 : 30,
  eventWindowMs: 1000,
  maxEventsPerSocket: isTestEnv ? 500 : 30,
  eventFloodThreshold: isTestEnv ? 1000 : 90,
  typingThrottleMs: isTestEnv ? 0 : 1000,
};

export const getClientIp = (socket: Socket): string => {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp.length > 0) {
      return firstIp;
    }
  }
  return socket.handshake.address || '127.0.0.1';
};

export const getWsMaxPayloadBytes = (): number => {
  const envVal = process.env.WS_MAX_PAYLOAD_BYTES;
  if (envVal && !Number.isNaN(Number(envVal))) {
    return Number(envVal);
  }
  return 32 * 1024;
};

export class WsRateLimiter {
  public config: WsRateLimitConfig;
  private handshakeTimestamps = new Map<string, number[]>();
  private ipSockets = new Map<string, Set<string>>();
  private socketEventTimestamps = new Map<string, number[]>();
  private typingTimestamps = new Map<string, number>();

  constructor(config: Partial<WsRateLimitConfig> = {}) {
    this.config = {
      ...DEFAULT_WS_RATE_LIMIT_CONFIG,
      ...config,
    };
  }

  isGlobalCapacityExceeded(currentClientsCount: number): boolean {
    return currentClientsCount > this.config.maxGlobalConnections;
  }

  isHandshakeRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.handshakeWindowMs;
    const timestamps = (this.handshakeTimestamps.get(ip) ?? []).filter(
      t => t > windowStart,
    );

    if (timestamps.length >= this.config.maxHandshakesPerIp) {
      this.handshakeTimestamps.set(ip, timestamps);
      return true;
    }

    timestamps.push(now);
    this.handshakeTimestamps.set(ip, timestamps);
    return false;
  }

  getIpSocketCount(ip: string): number {
    return this.ipSockets.get(ip)?.size ?? 0;
  }

  trackIpSocket(ip: string, socketId: string): void {
    const sockets = this.ipSockets.get(ip) ?? new Set();
    sockets.add(socketId);
    this.ipSockets.set(ip, sockets);
  }

  untrackIpSocket(ip: string, socketId: string): void {
    const sockets = this.ipSockets.get(ip);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.ipSockets.delete(ip);
    }
  }

  consumeEvent(socketId: string): { isLimited: boolean; isFlooding: boolean } {
    const now = Date.now();
    const windowStart = now - this.config.eventWindowMs;
    const timestamps = (this.socketEventTimestamps.get(socketId) ?? []).filter(
      t => t > windowStart,
    );

    timestamps.push(now);
    this.socketEventTimestamps.set(socketId, timestamps);

    const count = timestamps.length;
    const isFlooding = count > this.config.eventFloodThreshold;
    const isLimited = count > this.config.maxEventsPerSocket;

    return { isLimited, isFlooding };
  }

  removeSocketEvents(socketId: string): void {
    this.socketEventTimestamps.delete(socketId);
  }

  isTypingThrottled(userId: string, channelId: string): boolean {
    const key = `${userId}:${channelId}`;
    const now = Date.now();
    const lastTimestamp = this.typingTimestamps.get(key);

    if (lastTimestamp && now - lastTimestamp < this.config.typingThrottleMs) {
      return true;
    }

    this.typingTimestamps.set(key, now);
    return false;
  }

  clearTypingThrottle(userId: string, channelId: string): void {
    const key = `${userId}:${channelId}`;
    this.typingTimestamps.delete(key);
  }

  clear(): void {
    this.handshakeTimestamps.clear();
    this.ipSockets.clear();
    this.socketEventTimestamps.clear();
    this.typingTimestamps.clear();
  }
}

export const wsRateLimiter = new WsRateLimiter();
