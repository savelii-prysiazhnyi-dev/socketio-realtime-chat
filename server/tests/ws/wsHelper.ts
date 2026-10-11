import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketIoServer } from 'socket.io';
import {
  io as ioc,
  type Socket as ClientSocket,
  type ManagerOptions,
  type SocketOptions,
} from 'socket.io-client';
import buildApp from '../../src/app.js';
import { setupWebsocket } from '../../src/ws/index.js';
import { presenceService } from '../../src/services/presence.service.js';
import { getCorsSettings } from '../../src/utils/cors.js';
import { generateToken } from '../../src/utils/jwt.js';

import {
  wsRateLimiter,
  WsRateLimiter,
  getWsMaxPayloadBytes,
  type WsRateLimitConfig,
} from '../../src/ws/rateLimiter.js';

export interface TestWsServerOptions {
  maxHttpBufferSize?: number;
  rateLimiterConfig?: Partial<WsRateLimitConfig>;
  rateLimiter?: WsRateLimiter;
}

export interface TestWsServer {
  app: ReturnType<typeof buildApp>;
  httpServer: HttpServer;
  io: SocketIoServer;
  port: number;
  rateLimiter: WsRateLimiter;
  close: () => Promise<void>;
}

export const createTestWsServer = async (
  options?: TestWsServerOptions,
): Promise<TestWsServer> => {
  const app = buildApp();
  const httpServer = createServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: getCorsSettings(),
    maxHttpBufferSize: options?.maxHttpBufferSize ?? getWsMaxPayloadBytes(),
  });

  const rateLimiter =
    options?.rateLimiter ??
    (options?.rateLimiterConfig
      ? new WsRateLimiter(options.rateLimiterConfig)
      : wsRateLimiter);

  setupWebsocket(io, rateLimiter);

  await new Promise<void>(resolve => {
    httpServer.listen(0, () => resolve());
  });

  const address = httpServer.address() as AddressInfo;
  const port = address.port;

  const close = async (): Promise<void> => {
    await new Promise<void>(resolve => {
      io.close(() => resolve());
    });
    await new Promise<void>(resolve => {
      httpServer.close(() => resolve());
    });
    presenceService.clear();
    rateLimiter.clear();
  };

  return { app, httpServer, io, port, rateLimiter, close };
};

export const createTestClient = (
  port: number,
  token?: string,
  options?: Partial<ManagerOptions & SocketOptions>,
): ClientSocket => {
  const url = `http://localhost:${port}`;
  return ioc(url, {
    auth: token !== undefined ? { token } : undefined,
    transports: ['websocket'],
    autoConnect: true,
    forceNew: true,
    reconnection: false,
    ...options,
  });
};

export const waitFor = <T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> => {
  if (event === 'connect' && socket.connected) {
    return Promise.resolve(socket as unknown as T);
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(
        new Error(
          `Timed out waiting for event "${event}" after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    const onEvent = (data: T) => {
      clearTimeout(timer);
      resolve(data);
    };

    socket.once(event, onEvent);
  });
};

export const waitForEventOmission = (
  socket: ClientSocket,
  event: string,
  durationMs = 300,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const onEvent = (data: unknown) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      reject(
        new Error(
          `Expected event "${event}" to NOT be received, but received: ${JSON.stringify(
            data,
          )}`,
        ),
      );
    };

    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, durationMs);

    socket.once(event, onEvent);
  });
};

export const createAuthToken = (userId: string): string => {
  return generateToken({ userId });
};
