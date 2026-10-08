import * as React from 'react';
import {
  Hash,
  SendHorizontal,
  Users as UsersIcon,
  RotateCw,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { useSendMessage } from '../../hooks/useMessages.ts';
import type { Channel, Message, MessagesResponse } from '../../types/index.ts';

interface ChatAreaProps {
  channel: Channel | undefined;
  messagesData: MessagesResponse | undefined;
  isLoadingMessages: boolean;
  onLoadOlder?: () => void;
  isLoadingOlder?: boolean;
  hasOlder?: boolean;
  onToggleMembers: () => void;
  membersOpen: boolean;
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
}: ChatAreaProps) {
  const [content, setContent] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const sendMessageMutation = useSendMessage(channel?.id);

  const messages = messagesData?.messages || [];

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const adjustTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 20), 200);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
  }, []);

  React.useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);


  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || !channel || sendMessageMutation.isPending) return;

    try {
      await sendMessageMutation.mutateAsync(trimmed);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '20px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {hasOlder && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadOlder}
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
          messages.map((message: Message) => (
            <div
              key={message.id}
              className="group flex gap-3 text-xs leading-relaxed hover:bg-zinc-900/30 -mx-2 px-2 py-1.5 rounded transition-colors"
            >
              <Avatar
                name={message.user.name}
                src={message.user.avatar}
                size="md"
              />
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative p-3 border-t border-[#1f1f23] bg-[#0c0c0e]/80 min-h-[103px] h-[103px] shrink-0 z-10">
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-zinc-800 bg-[#121215] shadow-2xl shadow-black/80 focus-within:border-zinc-700 transition-[border-color,box-shadow] z-20">
          <div className="px-3.5 pt-2.5 pb-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 4000) {
                  setContent(e.target.value);
                }
              }}
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
