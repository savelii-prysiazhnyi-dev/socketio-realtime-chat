import type { Server, Socket } from 'socket.io';
import { authSocketMiddleware } from './middleware/authSocket.middleware.js';
import { groupService, presenceService } from '../services/index.js';
import { logger } from '../utils/logger.js';
import { wsEmitter } from './emitter.js';
import { groupRoomPayloadSchema, typingPayloadSchema } from './schemas.js';
import { validateSocketPayload } from '../utils/validateSocketPayload.js';

export const setupWebsocket = (io: Server): void => {
  wsEmitter.init(io);
  io.use(authSocketMiddleware);

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info(
      { socketId: socket.id, userId },
      'Authenticated socket connected',
    );

    socket.join(`user:${userId}`);

    let userGroupIds: string[] = [];
    try {
      const userGroups = await groupService.getUserGroups(userId);
      userGroupIds = userGroups.map(group => group.id);
      for (const groupId of userGroupIds) {
        socket.join(`group:${groupId}`);
      }
    } catch (err) {
      logger.error({ err, userId }, 'Failed to join group rooms on connection');
    }

    const isFirstConnection = presenceService.track(userId, socket.id);
    if (isFirstConnection) {
      for (const groupId of userGroupIds) {
        socket.to(`group:${groupId}`).emit('user:presence', {
          userId,
          status: 'ONLINE',
        });
      }
    }

    logger.info({ userId, socketId: socket.id }, 'User connected to socket');

    socket.on('group:join', async (data: unknown) => {
      const payload = validateSocketPayload(groupRoomPayloadSchema, data);
      if (!payload) {
        socket.emit('error', { message: 'Invalid group:join payload' });
        return;
      }

      try {
        await groupService.getGroupById(payload.groupId, userId);
        socket.join(`group:${payload.groupId}`);
        if (!userGroupIds.includes(payload.groupId)) {
          userGroupIds.push(payload.groupId);
        }
      } catch {
        socket.emit('error', { message: 'Unauthorized or group not found' });
      }
    });

    socket.on('group:leave', (data: unknown) => {
      const payload = validateSocketPayload(groupRoomPayloadSchema, data);
      if (!payload) return;

      socket.leave(`group:${payload.groupId}`);
      userGroupIds = userGroupIds.filter(id => id !== payload.groupId);
    });

    socket.on('typing:start', (data: unknown) => {
      const payload = validateSocketPayload(typingPayloadSchema, data);
      if (!payload || !socket.rooms.has(`group:${payload.groupId}`)) return;

      socket.to(`group:${payload.groupId}`).emit('user:typing', {
        groupId: payload.groupId,
        channelId: payload.channelId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: unknown) => {
      const payload = validateSocketPayload(typingPayloadSchema, data);
      if (!payload || !socket.rooms.has(`group:${payload.groupId}`)) return;

      socket.to(`group:${payload.groupId}`).emit('user:typing', {
        groupId: payload.groupId,
        channelId: payload.channelId,
        userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      const isLastConnection = presenceService.untrack(userId, socket.id);
      if (isLastConnection) {
        for (const groupId of userGroupIds) {
          io.to(`group:${groupId}`).emit('user:presence', {
            userId,
            status: 'OFFLINE',
          });
        }
      }
      logger.info(
        { userId, socketId: socket.id },
        'User disconnected from socket',
      );
    });
  });
};
