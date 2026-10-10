# WebSocket Implementation Code Reference

This document compiles the concrete code snippets discussed for implementing the real-time WebSocket architecture across the client and server.

---

## 1. Client-Side Implementation

### 1.1 Socket Factory (`client/src/lib/socket.ts`)

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (token?: string): Socket => {
  if (!socket && token) {
    socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket!;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

---

### 1.2 Socket Context & Provider (`client/src/context/SocketContext.tsx`)

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket } from '../lib/socket.ts';
import { MESSAGE_KEYS } from '../hooks/useMessages.ts';
import type { Message, MessagesResponse } from '../types/index.ts';

interface SocketContextValue {
  socket: Socket | null;
  onlineUsers: Set<string>;
  unreadByGroup: Record<string, number>;
  unreadByChannel: Record<string, number>;
  typingUsers: Record<string, Set<string>>;
  clearUnreadForChannel: (groupId: string, channelId: string) => void;
  sendTypingStart: (groupId: string, channelId: string) => void;
  sendTypingStop: (groupId: string, channelId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  token: string | null;
  activeGroupId: string | null;
  activeChannelId: string | null;
  children: ReactNode;
}

export function SocketProvider({
  token,
  activeGroupId,
  activeChannelId,
  children,
}: SocketProviderProps) {
  const queryClient = useQueryClient();
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocketInstance(null);
      setOnlineUsers(new Set());
      setUnreadByGroup({});
      setUnreadByChannel({});
      return;
    }

    const socket = getSocket(token);
    setSocketInstance(socket);
    socket.connect();

    socket.on('connect', () => {
      if (activeChannelId) {
        void queryClient.invalidateQueries({
          queryKey: MESSAGE_KEYS.byChannel(activeChannelId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    });

    socket.on('user:presence', ({ userId, status }: { userId: string; status: 'ONLINE' | 'OFFLINE' }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'ONLINE') next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on('message:created', ({ channelId, groupId, message }: { channelId: string; groupId: string; message: Message }) => {
      queryClient.setQueryData<MessagesResponse>(
        MESSAGE_KEYS.byChannel(channelId),
        (oldData) => {
          if (!oldData) return oldData;
          const exists = oldData.messages.some((m) => m.id === message.id);
          if (exists) return oldData;
          return {
            ...oldData,
            messages: [...oldData.messages, message],
          };
        },
      );

      const isCurrentView = activeGroupId === groupId && activeChannelId === channelId;
      if (!isCurrentView) {
        setUnreadByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? 0) + 1,
        }));
        setUnreadByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? 0) + 1,
        }));
      }
    });

    socket.on('user:typing', ({ channelId, userId, isTyping }: { channelId: string; userId: string; isTyping: boolean }) => {
      const timerKey = `${channelId}:${userId}`;

      setTypingUsers((prev) => {
        const channelSet = new Set(prev[channelId] ?? []);
        if (isTyping) {
          channelSet.add(userId);
        } else {
          channelSet.delete(userId);
        }
        return { ...prev, [channelId]: channelSet };
      });

      if (typingTimersRef.current.has(timerKey)) {
        clearTimeout(typingTimersRef.current.get(timerKey));
        typingTimersRef.current.delete(timerKey);
      }

      if (isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const channelSet = new Set(prev[channelId] ?? []);
            channelSet.delete(userId);
            return { ...prev, [channelId]: channelSet };
          });
          typingTimersRef.current.delete(timerKey);
        }, 3500);
        typingTimersRef.current.set(timerKey, timeout);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('user:presence');
      socket.off('message:created');
      socket.off('user:typing');
      disconnectSocket();
    };
  }, [token, activeGroupId, activeChannelId, queryClient]);

  const clearUnreadForChannel = useCallback((groupId: string, channelId: string) => {
    setUnreadByChannel((prev) => {
      const channelCount = prev[channelId] ?? 0;
      if (channelCount === 0) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    setUnreadByGroup((prev) => {
      const current = prev[groupId] ?? 0;
      const channelCount = unreadByChannel[channelId] ?? 0;
      const nextCount = Math.max(0, current - channelCount);
      return { ...prev, [groupId]: nextCount };
    });
  }, [unreadByChannel]);

  const sendTypingStart = useCallback((groupId: string, channelId: string) => {
    socketInstance?.emit('typing:start', { groupId, channelId });
  }, [socketInstance]);

  const sendTypingStop = useCallback((groupId: string, channelId: string) => {
    socketInstance?.emit('typing:stop', { groupId, channelId });
  }, [socketInstance]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketInstance,
        onlineUsers,
        unreadByGroup,
        unreadByChannel,
        typingUsers,
        clearUnreadForChannel,
        sendTypingStart,
        sendTypingStop,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
```

---

### 1.3 Component Usages

#### A. Unread Badge on Workspace Icon (`client/src/components/layout/GroupRail.tsx`)

```tsx
const { unreadByGroup } = useSocket();

{groups.map((group) => {
  const isActive = group.id === activeGroupId;
  const unreadCount = unreadByGroup[group.id] ?? 0;

  return (
    <div key={group.id} className="relative group w-full flex justify-center">
      <button
        type="button"
        onClick={() => onSelectGroup(group.id)}
        className="..."
      >
        {getInitials(group.name)}
      </button>

      {unreadCount > 0 && !isActive && (
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center pointer-events-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  );
})}
```

#### B. Throttled Typing Emitter in Chat Area (`client/src/components/layout/ChatArea.tsx`)

```tsx
const { sendTypingStart, sendTypingStop, typingUsers } = useSocket();
const lastTypingSentRef = useRef<number>(0);
const typingInactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const activeTypingUserIds = channel?.id ? typingUsers[channel.id] ?? new Set() : new Set();

const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setContent(e.target.value);
  if (!channel || !group) return;

  const now = Date.now();
  if (now - lastTypingSentRef.current > 2000) {
    sendTypingStart(group.id, channel.id);
    lastTypingSentRef.current = now;
  }

  if (typingInactivityTimeoutRef.current) {
    clearTimeout(typingInactivityTimeoutRef.current);
  }

  typingInactivityTimeoutRef.current = setTimeout(() => {
    sendTypingStop(group.id, channel.id);
  }, 2500);
};

const handleSend = async () => {
  if (typingInactivityTimeoutRef.current) {
    clearTimeout(typingInactivityTimeoutRef.current);
  }
  if (channel && group) {
    sendTypingStop(group.id, channel.id);
  }
  await sendMessageMutation.mutateAsync(content.trim());
  setContent('');
};
```

#### C. Online Indicator in Members Sidebar (`client/src/components/layout/MembersSidebar.tsx`)

```tsx
const { onlineUsers } = useSocket();

{list.map((m) => {
  const isOnline = onlineUsers.has(m.userId);

  return (
    <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-900/60">
      <div className="relative">
        <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#111114] rounded-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-zinc-200 truncate">{m.user.name}</span>
      </div>
    </div>
  );
})}
```

---

## 2. Server-Side Implementation

### 2.1 Presence Service (`server/src/services/presence.service.ts`)

```ts
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
}

export const presenceService = new PresenceService();
```

---

### 2.2 Server Connection Lifecycle (`server/src/ws/index.ts`)

```ts
import type { Server, Socket } from 'socket.io';
import { authSocketMiddleware } from './middleware/authSocket.middleware.js';
import { groupService, presenceService } from '../services/index.js';
import { logger } from '../utils/logger.js';

export const registerWebSocketHandlers = (io: Server): void => {
  io.use(authSocketMiddleware);

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ socketId: socket.id, userId }, 'Authenticated socket connected');

    socket.join(`user:${userId}`);

    let userGroupIds: string[] = [];
    try {
      const userGroups = await groupService.getUserGroups(userId);
      userGroupIds = userGroups.map((g) => g.id);
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

    socket.on('group:join', async ({ groupId }: { groupId: string }) => {
      try {
        await groupService.getGroupById(groupId, userId);
        socket.join(`group:${groupId}`);
      } catch {
        socket.emit('error', { message: 'Unauthorized or group not found' });
      }
    });

    socket.on('group:leave', ({ groupId }: { groupId: string }) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on('typing:start', ({ groupId, channelId }: { groupId: string; channelId: string }) => {
      socket.to(`group:${groupId}`).emit('user:typing', {
        groupId,
        channelId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ groupId, channelId }: { groupId: string; channelId: string }) => {
      socket.to(`group:${groupId}`).emit('user:typing', {
        groupId,
        channelId,
        userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      const isLastConnection = presenceService.untrack(userId, socket.id);
      if (isLastConnection) {
        for (const groupId of userGroupIds) {
          socket.to(`group:${groupId}`).emit('user:presence', {
            userId,
            status: 'OFFLINE',
          });
        }
      }
      logger.info({ socketId: socket.id, userId }, 'Socket disconnected');
    });
  });
};
```

---

### 2.3 REST Controller Broadcast Triggers

#### A. Message Broadcast (`server/src/controllers/message.controller.ts`)

```ts
// Inside MessageController.create:
const message = await this.messageService.createMessage(channelId, userId, data);

io.to(`group:${channel.groupId}`).emit('message:created', {
  channelId,
  groupId: channel.groupId,
  message,
});

res.status(201).json(message);
```

#### B. Channel Broadcast (`server/src/controllers/channel.controller.ts`)

```ts
// Inside ChannelController.create:
const channel = await this.channelService.createChannel(groupId, userId, data);

io.to(`group:${groupId}`).emit('channel:created', {
  groupId,
  channel,
});

res.status(201).json(channel);
```

#### C. Member Joined / Workspace Invited (`server/src/controllers/group.controller.ts`)

```ts
// Inside GroupController.addMember:
const member = await this.groupService.addMember(groupId, actorId, data);

io.to(`group:${groupId}`).emit('member:joined', {
  groupId,
  member,
});

io.to(`user:${member.userId}`).emit('group:invited', {
  group,
});

res.status(201).json(member);
```
