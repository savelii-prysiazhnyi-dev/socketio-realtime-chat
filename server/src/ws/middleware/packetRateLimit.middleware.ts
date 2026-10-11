import type { Socket } from 'socket.io';
import type { WsRateLimiter } from '../rateLimiter.js';

export const createPacketRateLimitMiddleware = (
  socket: Socket,
  rateLimiter: WsRateLimiter,
) => {
  return (_packet: unknown[], next: (err?: Error) => void): void => {
    const check = rateLimiter.consumeEvent(socket.id);
    if (check.isFlooding) {
      socket.emit('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many events. Connection terminated.',
      });
      socket.disconnect(true);
      return;
    }
    if (check.isLimited) {
      socket.emit('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
      });
      return;
    }
    next();
  };
};
