import type { Socket } from 'socket.io';
import { presenceService } from '../../services/index.js';
import type { WsRateLimiter } from '../rateLimiter.js';

export const createUserConcurrencyMiddleware = (rateLimiter: WsRateLimiter) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const userId = socket.data.userId as string;
    if (
      presenceService.getUserSocketCount(userId) >=
      rateLimiter.config.maxSocketsPerUser
    ) {
      return next(
        new Error('Maximum concurrent connections per user exceeded'),
      );
    }
    next();
  };
};
