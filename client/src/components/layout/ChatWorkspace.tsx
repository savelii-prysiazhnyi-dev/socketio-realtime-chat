import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GroupRail } from './GroupRail.tsx';
import { ChannelSidebar } from './ChannelSidebar.tsx';
import { ChatArea } from './ChatArea.tsx';
import { MembersSidebar } from './MembersSidebar.tsx';
import { CreateGroupModal } from '../modals/CreateGroupModal.tsx';
import { CreateChannelModal } from '../modals/CreateChannelModal.tsx';
import { InviteMemberModal } from '../modals/InviteMemberModal.tsx';
import { DemoLoginModal } from '../modals/DemoLoginModal.tsx';
import { useGroups, useGroup, useGroupMembers } from '../../hooks/useGroups.ts';
import { useGroupChannels, useChannel } from '../../hooks/useChannels.ts';
import { useChannelMessages } from '../../hooks/useMessages.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useSocketStore } from '../../stores/useSocketStore.ts';
import type { User } from '../../types/index.ts';

export interface ChatWorkspaceProps {
  currentUser: User;
  onLogout: () => void;
}

export function ChatWorkspace({ currentUser, onLogout }: ChatWorkspaceProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(true);

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [demoLoginOpen, setDemoLoginOpen] = useState(false);

  const { data: groups = [] } = useGroups();
  const effectiveGroupId =
    activeGroupId && groups.some((g) => g.id === activeGroupId)
      ? activeGroupId
      : groups[0]?.id ?? null;

  const { data: activeGroup } = useGroup(effectiveGroupId || undefined);
  const { data: members = [] } = useGroupMembers(effectiveGroupId || undefined);
  const { data: channels = [] } = useGroupChannels(effectiveGroupId || undefined);

  const effectiveChannelId =
    activeChannelId && channels.some((c) => c.id === activeChannelId)
      ? activeChannelId
      : channels[0]?.id ?? null;

  const { data: activeChannel } = useChannel(effectiveChannelId || undefined);

  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useChannelMessages(effectiveChannelId || undefined);

  const isConnected = useSocketStore((state) => state.isConnected);
  const joinGroup = useSocketStore((state) => state.joinGroup);

  useEffect(() => {
    if (token) {
      useSocketStore.getState().connect(token, queryClient);
    }
    return () => {
      useSocketStore.getState().disconnect();
    };
  }, [token, queryClient]);

  useEffect(() => {
    useSocketStore.getState().setActiveChannel(effectiveChannelId);
  }, [effectiveChannelId]);

  useEffect(() => {
    if (effectiveGroupId && isConnected) {
      joinGroup(effectiveGroupId);
    }
  }, [effectiveGroupId, isConnected, joinGroup]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 antialiased font-sans">
      <GroupRail
        groups={groups}
        activeGroupId={effectiveGroupId}
        onSelectGroup={(id) => {
          setActiveGroupId(id);
          setActiveChannelId(null);
        }}
        onOpenCreateGroup={() => setCreateGroupOpen(true)}
        onOpenDemoLogin={() => setDemoLoginOpen(true)}
      />

      <ChannelSidebar
        group={activeGroup}
        channels={channels}
        activeChannelId={effectiveChannelId}
        currentUser={currentUser}
        onSelectChannel={(id) => setActiveChannelId(id)}
        onOpenCreateChannel={() => setCreateChannelOpen(true)}
        onOpenDemoLogin={() => setDemoLoginOpen(true)}
        onLogout={onLogout}
      />

      <ChatArea
        key={effectiveChannelId ?? 'none'}
        channel={activeChannel}
        messagesData={messagesData}
        isLoadingMessages={isLoadingMessages}
        onToggleMembers={() => setMembersOpen((prev) => !prev)}
        membersOpen={membersOpen}
      />

      {membersOpen && effectiveGroupId && (
        <MembersSidebar
          group={activeGroup}
          members={members}
          onOpenInvite={() => setInviteMemberOpen(true)}
        />
      )}

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={(newGroupId) => {
          setActiveGroupId(newGroupId);
        }}
      />

      {effectiveGroupId && (
        <CreateChannelModal
          open={createChannelOpen}
          onOpenChange={setCreateChannelOpen}
          groupId={effectiveGroupId}
          onSuccess={(newChannelId) => {
            setActiveChannelId(newChannelId);
          }}
        />
      )}

      {effectiveGroupId && (
        <InviteMemberModal
          open={inviteMemberOpen}
          onOpenChange={setInviteMemberOpen}
          groupId={effectiveGroupId}
        />
      )}

      <DemoLoginModal
        open={demoLoginOpen}
        onOpenChange={setDemoLoginOpen}
      />
    </div>
  );
}
