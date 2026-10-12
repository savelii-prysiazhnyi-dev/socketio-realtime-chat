import { Hash, Plus, ChevronDown, LogOut, X } from 'lucide-react';
import { Badge } from '../ui/badge.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { useSocketStore } from '../../stores/useSocketStore.ts';
import type { Group, Channel, User } from '../../types/index.ts';

interface ChannelSidebarProps {
  group: Group | undefined;
  channels: Channel[];
  activeChannelId: string | null;
  currentUser: User | null;
  onSelectChannel: (channelId: string) => void;
  onOpenCreateChannel: () => void;
  onOpenDemoLogin: () => void;
  onLogout?: () => void;
  onCloseMobile?: () => void;
}

export function ChannelSidebar({
  group,
  channels,
  activeChannelId,
  currentUser,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenDemoLogin,
  onLogout,
  onCloseMobile,
}: ChannelSidebarProps) {
  const unreadChannelIds = useSocketStore((state) => state.unreadChannelIds);
  const isConnected = useSocketStore((state) => state.isConnected);
  const canManageChannels =
    group?.role === 'OWNER' || group?.role === 'ADMIN';

  return (
    <div className="w-56 sm:w-60 bg-[#111114] border-r border-[#1f1f23] flex flex-col h-full select-none shrink-0">
      <div className="h-12 border-b border-[#1f1f23] px-3 sm:px-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-xs text-zinc-100 truncate tracking-tight">
            {group?.name || 'Workspace'}
          </span>
          {group?.role && (
            <Badge
              variant={
                group.role === 'OWNER'
                  ? 'owner'
                  : group.role === 'ADMIN'
                    ? 'admin'
                    : 'member'
              }
            >
              {group.role}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              title="Close sidebar"
              className="md:hidden p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <div>
          <div className="flex items-center justify-between px-1.5 mb-1">
            <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Channels
            </span>
            {canManageChannels && (
              <button
                type="button"
                onClick={onOpenCreateChannel}
                title="Create Channel"
                className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {channels.length === 0 ? (
              <div className="text-[11px] text-zinc-500 px-2 py-3 text-center">
                No channels found
              </div>
            ) : (
              channels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                const isUnread = !isActive && unreadChannelIds.has(channel.id);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      onSelectChannel(channel.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                        : isUnread
                          ? 'text-zinc-100 font-semibold hover:bg-zinc-900/60 border border-transparent'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive
                            ? 'text-zinc-200'
                            : isUnread
                              ? 'text-zinc-100'
                              : 'text-zinc-500'
                        }`}
                      />
                      <span className="truncate">{channel.name}</span>
                    </div>
                    {isUnread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-2 border-t border-[#1f1f23] bg-[#0e0e11]">
        <div className="flex items-center justify-between p-1.5 rounded-md hover:bg-zinc-900 transition-colors">
          <div
            onClick={onOpenDemoLogin}
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
          >
            <Avatar
              name={currentUser?.name || 'Guest'}
              src={currentUser?.avatar}
              size="sm"
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">
                {currentUser?.name || 'Not signed in'}
              </div>
              <div className="text-[10px] text-zinc-500 truncate font-mono">
                {currentUser?.email || 'Click to switch'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-500' : 'bg-zinc-500'
              }`}
            />
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign out / Switch Profile"
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
