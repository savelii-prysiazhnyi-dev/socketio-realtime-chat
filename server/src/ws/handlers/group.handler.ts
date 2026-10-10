import type { Server, Socket } from 'socket.io';
import { groupService } from '../../services/index.js';
import { validateSocketPayload } from '../../utils/validateSocketPayload.js';
import { groupRoomPayloadSchema } from '../schemas.js';

export const registerGroupHandlers = (_io: Server, socket: Socket): void => {
  const userId = socket.data.userId as string;

  const joinGroup = async (data: unknown) => {
    const payload = validateSocketPayload(groupRoomPayloadSchema, data);
    if (!payload) {
      socket.emit('error', { message: 'Invalid group:join payload' });
      return;
    }

    try {
      await groupService.getGroupById(payload.groupId, userId);
      socket.join(`group:${payload.groupId}`);
      const userGroupIds =
        (socket.data.userGroupIds as Set<string> | undefined) ??
        new Set<string>();
      socket.data.userGroupIds = userGroupIds;
      userGroupIds.add(payload.groupId);
    } catch {
      socket.emit('error', { message: 'Unauthorized or group not found' });
    }
  };

  const leaveGroup = (data: unknown) => {
    const payload = validateSocketPayload(groupRoomPayloadSchema, data);
    if (!payload) return;

    socket.leave(`group:${payload.groupId}`);
    const userGroupIds = socket.data.userGroupIds as Set<string> | undefined;
    userGroupIds?.delete(payload.groupId);
  };

  socket.on('group:join', joinGroup);
  socket.on('group:leave', leaveGroup);
};
