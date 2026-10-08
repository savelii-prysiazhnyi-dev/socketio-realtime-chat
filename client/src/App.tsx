import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { GroupRail } from './components/layout/GroupRail.tsx';
import { ChannelSidebar } from './components/layout/ChannelSidebar.tsx';
import { ChatArea } from './components/layout/ChatArea.tsx';
import { MembersSidebar } from './components/layout/MembersSidebar.tsx';
import { CreateGroupModal } from './components/modals/CreateGroupModal.tsx';
import { CreateChannelModal } from './components/modals/CreateChannelModal.tsx';
import { InviteMemberModal } from './components/modals/InviteMemberModal.tsx';
import { DemoLoginModal } from './components/modals/DemoLoginModal.tsx';
import { ProfileSelector } from './components/auth/ProfileSelector.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { useAuth, useUsers } from './hooks/useAuth.ts';
import { useGroups, useGroup, useGroupMembers } from './hooks/useGroups.ts';
import { useGroupChannels, useChannel } from './hooks/useChannels.ts';
import { useChannelMessages } from './hooks/useMessages.ts';
import type { User } from './types/index.ts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

interface ChatWorkspaceProps {
  currentUser: User;
  onLogout: () => void;
}

function ChatWorkspace({ currentUser, onLogout }: ChatWorkspaceProps) {
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

function ChatApp() {
  const { currentUser, login, logout, isLoggingIn, selectedUserId } = useAuth();
  const { data: users = [], isLoading: isUsersLoading } = useUsers();

  if (!currentUser) {
    return (
      <ProfileSelector
        users={users}
        isLoading={users.length === 0 && isUsersLoading}
        onSelect={(userId) => {
          void login(userId);
        }}
        isLoggingIn={isLoggingIn}
        selectedUserId={selectedUserId}
      />
    );
  }

  return <ChatWorkspace currentUser={currentUser} onLogout={logout} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}
