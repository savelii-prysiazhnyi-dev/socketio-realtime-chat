import type { Server, Socket } from 'socket.io';
import { getClientIp, type WsRateLimiter } from '../rateLimiter.js';

export const createConnectionRateLimitMiddleware = (
  io: Server,
  rateLimiter: WsRateLimiter,
) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (rateLimiter.isGlobalCapacityExceeded(io.engine.clientsCount)) {
      return next(
        new Error('Server capacity reached. Please try again later.'),
      );
    }

    const clientIp = getClientIp(socket);
    if (rateLimiter.isHandshakeRateLimited(clientIp)) {
      return next(
        new Error('Too many connection attempts. Please try again later.'),
      );
    }

    if (
      rateLimiter.getIpSocketCount(clientIp) >=
      rateLimiter.config.maxSocketsPerIp
    ) {
      return next(new Error('Maximum concurrent connections per IP exceeded'));
    }

    next();
  };
};
