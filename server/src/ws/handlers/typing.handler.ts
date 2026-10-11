import type { Server, Socket } from 'socket.io';
import { validateSocketPayload } from '../../utils/validateSocketPayload.js';
import { typingPayloadSchema } from '../schemas.js';
import { wsRateLimiter, type WsRateLimiter } from '../rateLimiter.js';

export const registerTypingHandlers = (
  _io: Server,
  socket: Socket,
  rateLimiter: WsRateLimiter = wsRateLimiter,
): void => {
  const userId = socket.data.userId as string;

  const startTyping = (data: unknown) => {
    const payload = validateSocketPayload(typingPayloadSchema, data);
    if (!payload || !socket.rooms.has(`group:${payload.groupId}`)) return;

    if (rateLimiter.isTypingThrottled(userId, payload.channelId)) {
      return;
    }

    socket.to(`group:${payload.groupId}`).emit('user:typing', {
      groupId: payload.groupId,
      channelId: payload.channelId,
      userId,
      isTyping: true,
    });
  };

  const stopTyping = (data: unknown) => {
    const payload = validateSocketPayload(typingPayloadSchema, data);
    if (!payload || !socket.rooms.has(`group:${payload.groupId}`)) return;

    rateLimiter.clearTypingThrottle(userId, payload.channelId);

    socket.to(`group:${payload.groupId}`).emit('user:typing', {
      groupId: payload.groupId,
      channelId: payload.channelId,
      userId,
      isTyping: false,
    });
  };

  socket.on('typing:start', startTyping);
  socket.on('typing:stop', stopTyping);
};
