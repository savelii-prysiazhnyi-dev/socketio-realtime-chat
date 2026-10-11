import type { Server, Socket } from 'socket.io';
import {
  authSocketMiddleware,
  createConnectionRateLimitMiddleware,
  createUserConcurrencyMiddleware,
  createPacketRateLimitMiddleware,
} from './middleware/index.js';
import { groupService, presenceService } from '../services/index.js';
import { logger } from '../utils/logger.js';
import { wsEmitter } from './emitter.js';
import {
  registerGroupHandlers,
  registerTypingHandlers,
} from './handlers/index.js';
import {
  wsRateLimiter,
  getClientIp,
  type WsRateLimiter,
} from './rateLimiter.js';

export const setupWebsocket = (
  io: Server,
  rateLimiter: WsRateLimiter = wsRateLimiter,
): void => {
  wsEmitter.init(io);

  io.use(createConnectionRateLimitMiddleware(io, rateLimiter));
  io.use(authSocketMiddleware);
  io.use(createUserConcurrencyMiddleware(rateLimiter));

  const onConnection = async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const clientIp = getClientIp(socket);

    rateLimiter.trackIpSocket(clientIp, socket.id);
    socket.use(createPacketRateLimitMiddleware(socket, rateLimiter));

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

    socket.emit('presence:sync', {
      userIds: presenceService.getOnlineUsers(),
    });

    logger.info({ userId, socketId: socket.id }, 'User connected to socket');

    registerGroupHandlers(io, socket);
    registerTypingHandlers(io, socket, rateLimiter);

    socket.on('disconnect', () => {
      rateLimiter.untrackIpSocket(clientIp, socket.id);
      rateLimiter.removeSocketEvents(socket.id);

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
