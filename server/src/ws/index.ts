import type { Server, Socket } from 'socket.io';
import { authSocketMiddleware } from './middleware/authSocket.middleware.js';
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

  io.use((socket, next) => {
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
  });

  io.use(authSocketMiddleware);

  io.use((socket, next) => {
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
  });

  const onConnection = async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const clientIp = getClientIp(socket);

    rateLimiter.trackIpSocket(clientIp, socket.id);

    socket.use((_packet, next) => {
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
    });

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
