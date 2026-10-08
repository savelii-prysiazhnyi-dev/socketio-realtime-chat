import { ProfileSelector } from './auth/ProfileSelector.tsx';
import { ChatWorkspace } from './layout/ChatWorkspace.tsx';
import { useAuth, useUsers } from '../hooks/useAuth.ts';

export function ChatApp() {
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
