import { Crown, User as UserIcon, UserMinus, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { Badge } from '../ui/badge.tsx';
import type { User } from '../../types/index.ts';

interface ProfileSelectorProps {
  users: User[];
  isLoading: boolean;
  onSelect: (userId: string) => void;
  isLoggingIn: boolean;
  selectedUserId?: string | null;
}

export function ProfileSelector({
  users,
  isLoading,
  onSelect,
  isLoggingIn,
  selectedUserId,
}: ProfileSelectorProps) {
  const getProfileMeta = (userName: string) => {
    const lower = userName.toLowerCase();
    if (lower.includes('alice')) {
      return {
        roleLabel: 'Owner of Core',
        badgeVariant: 'owner' as const,
        icon: <Crown className="w-3.5 h-3.5 text-amber-400" />,
        description:
          'Full workspace permissions: create & delete channels, invite team members, manage roles.',
        accentBorder: 'hover:border-amber-700/60',
      };
    }
    if (lower.includes('bob')) {
      return {
        roleLabel: 'Member',
        badgeVariant: 'member' as const,
        icon: <UserIcon className="w-3.5 h-3.5 text-zinc-400" />,
        description:
          'Team member permissions: read channels, post messages, browse members list.',
        accentBorder: 'hover:border-zinc-600',
      };
    }
    return {
      roleLabel: 'Unassigned',
      badgeVariant: 'outline' as const,
      icon: <UserMinus className="w-3.5 h-3.5 text-indigo-400" />,
      description:
        'Unassigned profile: test zero-state workspaces, create new teams, or wait for invitations.',
      accentBorder: 'hover:border-indigo-600/60',
    };
  };

  return (
    <div className="min-h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center items-center p-6 selection:bg-zinc-800 selection:text-zinc-100">
      <div className="w-full max-w-3xl space-y-8 animate-in fade-in-0 duration-300">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-[11px] font-medium text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-zinc-300" />
            <span>Chat Workspace Demo</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
            Choose a profile to authenticate with
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Choose a profile to authenticate with and test role permissions (Alice is Owner of Core, Bob is Member, Charlie is unassigned).
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 rounded-lg border border-zinc-800/80 bg-zinc-950 p-5 animate-pulse"
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-8 text-center space-y-3 max-w-md mx-auto">
            <p className="text-xs text-zinc-400">
              No demo profiles found in the database.
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Run <code className="text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded">pnpm --dir server run seed</code> to populate demo accounts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {users.map((user) => {
              const meta = getProfileMeta(user.name);
              const isSelected = selectedUserId === user.id && isLoggingIn;

              return (
                <div
                  key={user.id}
                  onClick={() => !isLoggingIn && onSelect(user.id)}
                  className={`group relative rounded-lg border border-zinc-800/80 bg-zinc-950 p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer ${meta.accentBorder} hover:bg-zinc-900/40 hover:shadow-xl`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <Avatar
                        name={user.name}
                        src={user.avatar}
                        size="lg"
                        className="rounded-lg border border-zinc-700/60"
                      />
                      <Badge variant={meta.badgeVariant} className="gap-1">
                        {meta.icon}
                        <span>{meta.roleLabel}</span>
                      </Badge>
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-1.5">
                        <span>{user.name}</span>
                        {user.name === 'Alice' && (
                          <Sparkles className="w-3 h-3 text-amber-400/80 inline" />
                        )}
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
                        {user.email}
                      </p>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-normal">
                      {meta.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-zinc-900">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={isLoggingIn}
                      className="w-full justify-between group-hover:bg-zinc-100"
                    >
                      <span>
                        {isSelected ? 'Authenticating...' : `Continue as ${user.name}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-600 font-mono text-center">
          <span>REST API Ready</span>
          <span>•</span>
          <span>Role-Based Access Control</span>
          <span>•</span>
          <span>Instant Switch Anytime</span>
        </div>
      </div>
    </div>
  );
}
