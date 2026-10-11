export class PresenceService {
  private userSockets = new Map<string, Set<string>>();

  track(userId: string, socketId: string): boolean {
    const sockets = this.userSockets.get(userId) ?? new Set();
    const isFirst = sockets.size === 0;
    sockets.add(socketId);
    this.userSockets.set(userId, sockets);
    return isFirst;
  }

  untrack(userId: string, socketId: string): boolean {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  clear(): void {
    this.userSockets.clear();
  }
}

export const presenceService = new PresenceService();
