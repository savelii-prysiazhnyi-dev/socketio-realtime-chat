import type { Socket } from 'socket.io';
import { verifyToken } from '../../utils/jwt.js';

export const authSocketMiddleware = (
  socket: Socket,
  next: (err?: Error) => void,
): void => {
  try {
    const rawAuth =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!rawAuth || typeof rawAuth !== 'string') {
      return next(new Error('Missing authentication token'));
    }

    const token = rawAuth.startsWith('Bearer ')
      ? rawAuth.slice(7).trim()
      : rawAuth.trim();

    if (!token) {
      return next(new Error('Authentication token cannot be empty'));
    }

    const payload = verifyToken(token);
    socket.data.userId = payload.userId;

    next();
  } catch {
    next(new Error('Invalid or expired authentication token'));
  }
};
