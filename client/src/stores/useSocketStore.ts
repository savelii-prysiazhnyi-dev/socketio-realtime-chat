import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import { MESSAGE_KEYS } from '../hooks/useMessages.ts';
import { CHANNEL_KEYS } from '../hooks/useChannels.ts';
import { GROUP_KEYS } from '../hooks/useGroups.ts';
import type { Message, MessagesResponse, Channel, GroupMember, Group } from '../types/index.ts';

interface PresencePayload {
  userId: string;
  status: 'ONLINE' | 'OFFLINE';
}

interface TypingPayload {
  groupId: string;
  channelId: string;
  userId: string;
  isTyping: boolean;
}

interface MessageCreatedPayload {
  channelId: string;
  groupId: string;
  message: Message;
}

interface ChannelCreatedPayload {
  groupId: string;
  channel: Channel;
}

interface MemberJoinedPayload {
  groupId: string;
  member: GroupMember;
}

interface GroupInvitedPayload {
  group: Group;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Record<string, Set<string>>;
  unreadChannelIds: Set<string>;
  activeChannelId: string | null;

  connect: (token: string, queryClient: QueryClient) => void;
  disconnect: () => void;
  setActiveChannel: (channelId: string | null) => void;
  markChannelAsRead: (channelId: string) => void;
  sendTypingStart: (groupId: string, channelId: string) => void;
  sendTypingStop: (groupId: string, channelId: string) => void;
  joinGroup: (groupId: string) => void;
}

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  typingUsers: {},
  unreadChannelIds: new Set(),
  activeChannelId: null,

  connect: (token: string, queryClient: QueryClient) => {
    const existingSocket = get().socket;
    if (existingSocket) {
      existingSocket.disconnect();
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(socketUrl, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      set({ isConnected: true });
      const currentChannelId = get().activeChannelId;
      if (currentChannelId) {
        void queryClient.invalidateQueries({
          queryKey: ['messages', currentChannelId],
        });
      }
      void queryClient.invalidateQueries({ queryKey: GROUP_KEYS.all });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('user:presence', ({ userId, status }: PresencePayload) => {
      set((state) => {
        const next = new Set(state.onlineUsers);
        if (status === 'ONLINE') {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return { onlineUsers: next };
      });
    });

    socket.on('user:typing', ({ channelId, userId, isTyping }: TypingPayload) => {
      const timerKey = `${channelId}:${userId}`;
      const existingTimer = typingTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimers.delete(timerKey);
      }

      set((state) => {
        const currentChannelTyping = new Set(state.typingUsers[channelId] ?? []);
        if (isTyping) {
          currentChannelTyping.add(userId);
        } else {
          currentChannelTyping.delete(userId);
        }
        return {
          typingUsers: { ...state.typingUsers, [channelId]: currentChannelTyping },
        };
      });

      if (isTyping) {
        const timeout = setTimeout(() => {
          set((state) => {
            const currentChannelTyping = new Set(state.typingUsers[channelId] ?? []);
            currentChannelTyping.delete(userId);
            return {
              typingUsers: { ...state.typingUsers, [channelId]: currentChannelTyping },
            };
          });
          typingTimers.delete(timerKey);
        }, 3000);
        typingTimers.set(timerKey, timeout);
      }
    });

    socket.on('message:created', ({ channelId, message }: MessageCreatedPayload) => {
      const updateMessages = (
        old: MessagesResponse | undefined,
      ): MessagesResponse | undefined => {
        if (!old) return old;
        const exists = old.messages.some((m) => m.id === message.id);
        if (exists) return old;
        return {
          ...old,
          messages: [...old.messages, message],
        };
      };

      queryClient.setQueriesData<MessagesResponse>(
        { queryKey: ['messages', channelId] },
        updateMessages,
      );
      queryClient.setQueryData<MessagesResponse>(
        MESSAGE_KEYS.byChannel(channelId),
        updateMessages,
      );

      if (get().activeChannelId !== channelId) {
        set((state) => {
          const next = new Set(state.unreadChannelIds);
          next.add(channelId);
          return { unreadChannelIds: next };
        });
      }
    });

    socket.on('channel:created', ({ groupId, channel }: ChannelCreatedPayload) => {
      queryClient.setQueryData<Channel[]>(
        CHANNEL_KEYS.byGroup(groupId),
        (old) => {
          if (!old) return [channel];
          const exists = old.some((c) => c.id === channel.id);
          if (exists) return old;
          return [...old, channel];
        },
      );
      void queryClient.invalidateQueries({
        queryKey: CHANNEL_KEYS.byGroup(groupId),
      });
    });

    socket.on('member:joined', ({ groupId, member }: MemberJoinedPayload) => {
      queryClient.setQueryData<GroupMember[]>(
        GROUP_KEYS.members(groupId),
        (old) => {
          if (!old) return [member];
          const exists = old.some((m) => m.userId === member.userId);
          if (exists) return old;
          return [...old, member];
        },
      );
      void queryClient.invalidateQueries({
        queryKey: GROUP_KEYS.members(groupId),
      });
    });

    socket.on('group:invited', ({ group }: GroupInvitedPayload) => {
      queryClient.setQueryData<Group[]>(
        GROUP_KEYS.all,
        (old) => {
          if (!old) return [group];
          const exists = old.some((g) => g.id === group.id);
          if (exists) return old;
          return [...old, group];
        },
      );
      void queryClient.invalidateQueries({ queryKey: GROUP_KEYS.all });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    for (const timer of typingTimers.values()) {
      clearTimeout(timer);
    }
    typingTimers.clear();

    set({
      socket: null,
      isConnected: false,
      onlineUsers: new Set(),
      typingUsers: {},
      unreadChannelIds: new Set(),
      activeChannelId: null,
    });
  },

  setActiveChannel: (channelId: string | null) => {
    set((state) => {
      const next = new Set(state.unreadChannelIds);
      if (channelId) {
        next.delete(channelId);
      }
      return { activeChannelId: channelId, unreadChannelIds: next };
    });
  },

  markChannelAsRead: (channelId: string) => {
    set((state) => {
      if (!state.unreadChannelIds.has(channelId)) return state;
      const next = new Set(state.unreadChannelIds);
      next.delete(channelId);
      return { unreadChannelIds: next };
    });
  },

  sendTypingStart: (groupId: string, channelId: string) => {
    get().socket?.emit('typing:start', { groupId, channelId });
  },

  sendTypingStop: (groupId: string, channelId: string) => {
    get().socket?.emit('typing:stop', { groupId, channelId });
  },

  joinGroup: (groupId: string) => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      socket.emit('group:join', { groupId });
    }
  },
}));
