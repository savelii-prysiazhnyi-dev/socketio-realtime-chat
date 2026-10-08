import { Dialog } from '../ui/dialog.tsx';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { Badge } from '../ui/badge.tsx';
import { useUsers, useAuth } from '../../hooks/useAuth.ts';

interface DemoLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoLoginModal({ open, onOpenChange }: DemoLoginModalProps) {
  const { data: users = [], isLoading } = useUsers();
  const { currentUser, login, isLoggingIn, selectedUserId } = useAuth();

  const handleSelectUser = async (userId: string) => {
    await login(userId);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Switch Demo Account"
      description="Choose a profile to authenticate with and test role permissions (Alice is Owner of Core, Bob is Member, Charlie is unassigned)."
    >
      <div className="space-y-2 mt-2">
        {isLoading ? (
          <div className="text-xs text-zinc-500 py-4 text-center">
            Loading demo accounts...
          </div>
        ) : (
          users.map((user) => {
            const isCurrent = currentUser?.id === user.id;
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                  isCurrent
                    ? 'border-emerald-700/60 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} src={user.avatar} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-100">
                        {user.name}
                      </span>
                      {isCurrent && (
                        <Badge
                          variant="default"
                          className="bg-emerald-900/60 text-emerald-300 border-emerald-700/60"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {user.email}
                    </span>
                  </div>
                </div>

                <Button
                  variant={isCurrent ? 'outline' : 'default'}
                  size="sm"
                  disabled={isLoggingIn || isCurrent}
                  onClick={() => handleSelectUser(user.id)}
                >
                  {isCurrent ? 'Current' : selectedUserId === user.id ? 'Switching...' : 'Switch'}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Dialog>
  );
}
