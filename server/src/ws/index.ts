import type { Server, Socket } from 'socket.io';
import { authSocketMiddleware } from './middleware/authSocket.middleware.js';
import { groupService, presenceService } from '../services/index.js';
import { logger } from '../utils/logger.js';
import { wsEmitter } from './emitter.js';
import {
  registerGroupHandlers,
  registerTypingHandlers,
} from './handlers/index.js';

export const setupWebsocket = (io: Server): void => {
  wsEmitter.init(io);
  io.use(authSocketMiddleware);

  const onConnection = async (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info(
      { socketId: socket.id, userId },
      'Authenticated socket connected',
    );

    socket.join(`user:${userId}`);

    const userGroupIds = new Set<string>();
    socket.data.userGroupIds = userGroupIds;

    const isFirstConnection = presenceService.track(userId, socket.id);

    try {
      const userGroups = await groupService.getUserGroups(userId);
      for (const group of userGroups) {
        userGroupIds.add(group.id);
        socket.join(`group:${group.id}`);
      }
    } catch (err) {
      logger.error({ err, userId }, 'Failed to join group rooms on connection');
    }

    if (isFirstConnection) {
      for (const groupId of userGroupIds) {
        socket.to(`group:${groupId}`).emit('user:presence', {
          userId,
          status: 'ONLINE',
        });
      }
    }

    logger.info({ userId, socketId: socket.id }, 'User connected to socket');

    registerGroupHandlers(io, socket);
    registerTypingHandlers(io, socket);

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
  };

  io.on('connection', onConnection);
};
