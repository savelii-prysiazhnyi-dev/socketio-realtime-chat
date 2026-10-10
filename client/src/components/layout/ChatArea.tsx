import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  type KeyboardEvent,
} from 'react';
import {
  Hash,
  SendHorizontal,
  Users as UsersIcon,
  RotateCw,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { useSendMessage } from '../../hooks/useMessages.ts';
import { useSocketStore } from '../../stores/useSocketStore.ts';
import type {
  Channel,
  Message,
  MessagesResponse,
  User,
  GroupMember,
} from '../../types/index.ts';

interface ChatAreaProps {
  channel: Channel | undefined;
  messagesData: MessagesResponse | undefined;
  isLoadingMessages: boolean;
  onLoadOlder?: () => void;
  isLoadingOlder?: boolean;
  hasOlder?: boolean;
  onToggleMembers: () => void;
  membersOpen: boolean;
  currentUser?: User | null;
  members?: GroupMember[];
}

export function ChatArea({
  channel,
  messagesData,
  isLoadingMessages,
  onLoadOlder,
  isLoadingOlder,
  hasOlder,
  onToggleMembers,
  membersOpen,
  currentUser,
  members,
}: ChatAreaProps) {
  const [content, setContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingInactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const isConnected = useSocketStore((state) => state.isConnected);
  const typingUserIds = useSocketStore((state) =>
    channel ? state.typingUsers[channel.id] : undefined,
  );
  const sendTypingStart = useSocketStore((state) => state.sendTypingStart);
  const sendTypingStop = useSocketStore((state) => state.sendTypingStop);
  const activeTypingUserIds = useMemo(() => {
    if (!typingUserIds) return [];
    return Array.from(typingUserIds).filter((id) => id !== currentUser?.id);
  }, [typingUserIds, currentUser?.id]);

  const typingText = useMemo(() => {
    if (activeTypingUserIds.length === 0) return null;
    const memberMap = new Map((members ?? []).map((m) => [m.userId, m.user.name]));
    const names = activeTypingUserIds.map((id) => memberMap.get(id) || 'Someone');
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    }
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    }
    return 'Several people are typing...';
  }, [activeTypingUserIds, members]);

  const sendMessageMutation = useSendMessage(channel?.id);

  const sendErrorMessage = useMemo(() => {
    if (!sendMessageMutation.isError) return null;
    const error = sendMessageMutation.error as {
      response?: { data?: { message?: string } };
    };
    return (
      error.response?.data?.message ||
      sendMessageMutation.error.message ||
      'Failed to send message'
    );
  }, [sendMessageMutation.isError, sendMessageMutation.error]);

  const messages = messagesData?.messages || [];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollHeightBeforeLoadRef = useRef<number | null>(null);
  const prevMessagesLengthRef = useRef<number>(0);

  const handleLoadOlder = () => {
    if (scrollContainerRef.current) {
      scrollHeightBeforeLoadRef.current =
        scrollContainerRef.current.scrollHeight;
    }
    onLoadOlder?.();
  };

  useLayoutEffect(() => {
    if (
      scrollHeightBeforeLoadRef.current !== null &&
      scrollContainerRef.current
    ) {
      const diff =
        scrollContainerRef.current.scrollHeight -
        scrollHeightBeforeLoadRef.current;
      if (diff > 0) {
        scrollContainerRef.current.scrollTop += diff;
      }
      scrollHeightBeforeLoadRef.current = null;
    } else if (prevMessagesLengthRef.current === 0 && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (typingInactivityTimeoutRef.current) {
        clearTimeout(typingInactivityTimeoutRef.current);
      }
      if (channel) {
        sendTypingStop(channel.groupId, channel.id);
      }
    };
  }, [channel, sendTypingStop]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 20), 200);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (sendMessageMutation.isError) {
      sendMessageMutation.reset();
    }
    if (e.target.value.length <= 4000) {
      setContent(e.target.value);
    }
    if (!channel) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      sendTypingStart(channel.groupId, channel.id);
      lastTypingSentRef.current = now;
    }

    if (typingInactivityTimeoutRef.current) {
      clearTimeout(typingInactivityTimeoutRef.current);
    }
    typingInactivityTimeoutRef.current = setTimeout(() => {
      sendTypingStop(channel.groupId, channel.id);
    }, 2500);
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || !channel || sendMessageMutation.isPending) return;

    if (typingInactivityTimeoutRef.current) {
      clearTimeout(typingInactivityTimeoutRef.current);
    }
    sendTypingStop(channel.groupId, channel.id);

    try {
      await sendMessageMutation.mutateAsync(trimmed);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '20px';
        textareaRef.current.style.overflowY = 'hidden';
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      return;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!channel) {
    return (
      <div className="flex-1 bg-[#09090b] flex flex-col items-center justify-center text-zinc-500 select-none">
        <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
        <p className="text-sm font-medium text-zinc-400">Select a channel to begin</p>
        <p className="text-xs text-zinc-600 mt-1">
          Pick a workspace channel from the left sidebar
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#09090b] flex flex-col h-full min-w-0">
      <div className="h-12 border-b border-[#1f1f23] px-4 flex items-center justify-between shrink-0 bg-[#0c0c0e]/60 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
          <h1 className="text-xs font-semibold text-zinc-100 truncate tracking-tight">
            {channel.name}
          </h1>
          {channel.topic && (
            <>
              <div className="w-[1px] h-3 bg-zinc-800 shrink-0" />
              <p className="text-xs text-zinc-500 truncate">{channel.topic}</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMembers}
            className={`gap-1.5 ${
              membersOpen ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-400'
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">Members</span>
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {hasOlder && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              className="text-xs gap-1.5"
            >
              <RotateCw
                className={`w-3 h-3 ${isLoadingOlder ? 'animate-spin' : ''}`}
              />
              Load older messages
            </Button>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2">
              <Hash className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs font-medium text-zinc-300">
              Welcome to #{channel.name}!
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              This is the start of the #{channel.name} channel.
            </p>
          </div>
        ) : (
          messages.map((message: Message) => {
            const isAuthorOnline =
              onlineUsers.has(message.userId) ||
              (message.userId === currentUser?.id && isConnected);
            return (
              <div
                key={message.id}
                className="group flex gap-3 text-xs leading-relaxed hover:bg-zinc-900/30 -mx-2 px-2 py-1.5 rounded transition-colors"
              >
                <div className="relative shrink-0 self-start">
                  <Avatar
                    name={message.user.name}
                    src={message.user.avatar}
                    size="md"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#09090b] ${
                      isAuthorOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                    title={isAuthorOnline ? 'Online' : 'Offline'}
                  />
                </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-zinc-200">
                    {message.user.name}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {formatTimestamp(message.createdAt)}
                  </span>
                </div>
                <div className="text-zinc-300 whitespace-pre-wrap break-words mt-0.5">
                  {message.content}
                </div>
              </div>
            </div>
          );
        })
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingText && (
        <div className="px-4 py-1 text-[11px] text-zinc-400 italic bg-[#0c0c0e]/40 shrink-0 flex items-center gap-1.5 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span>{typingText}</span>
        </div>
      )}

      <div className="p-3 border-t border-[#1f1f23] bg-[#0c0c0e]/80 shrink-0">
        {sendErrorMessage && (
          <div className="mb-2 px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{sendErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => sendMessageMutation.reset()}
              className="text-rose-400 hover:text-rose-300 text-[11px] underline ml-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="rounded-lg border border-zinc-800 bg-[#121215] shadow-2xl shadow-black/80 focus-within:border-zinc-700 transition-[border-color,box-shadow]">
          <div className="px-3.5 pt-2.5 pb-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channel.name}... (Press Enter to send)`}
              className="w-full resize-none bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none leading-5 block m-0 p-0 break-words"
              style={{ minHeight: '20px', maxHeight: '200px' }}
            />
          </div>

          <div className="h-[1px] bg-zinc-800/60 w-full" />

          <div className="flex items-center justify-between px-3.5 py-1.5 text-[10px] text-zinc-500 bg-zinc-950/30 rounded-b-lg">
            <span className="font-mono text-[10px] text-zinc-500">
              {content.length > 0 ? `${content.length} / 4000` : ''}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline text-zinc-500 text-[11px]">
                Shift + Enter for new line
              </span>
              <Button
                variant="default"
                size="xs"
                disabled={!content.trim() || sendMessageMutation.isPending}
                onClick={handleSend}
                className="gap-1.5 h-6 px-2.5 text-[11px] font-medium"
              >
                <span>Send</span>
                <SendHorizontal className="w-2.5 h-2.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
