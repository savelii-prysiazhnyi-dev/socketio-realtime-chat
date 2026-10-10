import type { Server } from 'socket.io';

export class WsEmitter {
  constructor(private io?: Server) {}

  init(io: Server): void {
    this.io = io;
  }

  setIo(io: Server): void {
    this.io = io;
  }

  emitMessageCreated(
    groupId: string,
    payload: { channelId: string; groupId: string; message: unknown },
  ): void {
    this.io?.to(`group:${groupId}`).emit('message:created', payload);
  }

  emitChannelCreated(
    groupId: string,
    payload: { groupId: string; channel: unknown },
  ): void {
    this.io?.to(`group:${groupId}`).emit('channel:created', payload);
  }

  emitMemberJoined(
    groupId: string,
    payload: { groupId: string; member: unknown },
  ): void {
    this.io?.to(`group:${groupId}`).emit('member:joined', payload);
  }

  emitGroupInvited(
    userId: string,
    groupId: string,
    payload: { group: unknown },
  ): void {
    this.io?.in(`user:${userId}`).socketsJoin(`group:${groupId}`);
    this.io?.to(`user:${userId}`).emit('group:invited', payload);
  }

  joinUserSocketsToGroup(userId: string, groupId: string): void {
    this.io?.in(`user:${userId}`).socketsJoin(`group:${groupId}`);
  }
}

export const wsEmitter = new WsEmitter();
