import type { Server, Socket } from 'socket.io';
import { authSocketMiddleware } from './middleware/authSocket.middleware.js';
import { groupService, presenceService } from '../services/index.js';
import { logger } from '../utils/logger.js';
import { wsEmitter } from './emitter.js';

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

    socket.on('group:join', async ({ groupId }: { groupId: string }) => {
      try {
        await groupService.getGroupById(groupId, userId);
        socket.join(`group:${groupId}`);
        if (!userGroupIds.includes(groupId)) {
          userGroupIds.push(groupId);
        }
      } catch {
        socket.emit('error', { message: 'Unauthorized or group not found' });
      }
    });

    socket.on('group:leave', ({ groupId }: { groupId: string }) => {
      socket.leave(`group:${groupId}`);
      userGroupIds = userGroupIds.filter(id => id !== groupId);
    });

    socket.on(
      'typing:start',
      ({ groupId, channelId }: { groupId: string; channelId: string }) => {
        socket.to(`group:${groupId}`).emit('user:typing', {
          groupId,
          channelId,
          userId,
          isTyping: true,
        });
      },
    );

    socket.on(
      'typing:stop',
      ({ groupId, channelId }: { groupId: string; channelId: string }) => {
        socket.to(`group:${groupId}`).emit('user:typing', {
          groupId,
          channelId,
          userId,
          isTyping: false,
        });
      },
    );

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
