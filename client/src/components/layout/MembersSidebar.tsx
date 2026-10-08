import type { ReactNode } from 'react';
import { UserPlus, Shield, Crown } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { Badge } from '../ui/badge.tsx';
import type { GroupMember, Group } from '../../types/index.ts';

interface MembersSidebarProps {
  group: Group | undefined;
  members: GroupMember[];
  onOpenInvite: () => void;
}

export function MembersSidebar({
  group,
  members,
  onOpenInvite,
}: MembersSidebarProps) {
  const canInvite = group?.role === 'OWNER' || group?.role === 'ADMIN';

  const owners = members.filter((m) => m.role === 'OWNER');
  const admins = members.filter((m) => m.role === 'ADMIN');
  const regularMembers = members.filter((m) => m.role === 'MEMBER');

  const renderMemberSection = (
    title: string,
    list: GroupMember[],
    icon?: ReactNode,
  ) => {
    if (list.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 px-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          {icon}
          <span>
            {title} — {list.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {list.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-900/60 transition-colors"
            >
              <Avatar
                name={m.user.name}
                src={m.user.avatar}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {m.user.name}
                  </span>
                  <Badge
                    variant={
                      m.role === 'OWNER'
                        ? 'owner'
                        : m.role === 'ADMIN'
                          ? 'admin'
                          : 'member'
                    }
                  >
                    {m.role}
                  </Badge>
                </div>
                <div className="text-[10px] text-zinc-600 truncate font-mono">
                  {m.user.email}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-60 bg-[#111114] border-l border-[#1f1f23] flex flex-col h-full select-none shrink-0">
      <div className="h-12 border-b border-[#1f1f23] px-3.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-100 tracking-tight">
          Workspace Members
        </span>
        {canInvite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenInvite}
            title="Invite Member"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {renderMemberSection(
          'Owners',
          owners,
          <Crown className="w-3 h-3 text-amber-400" />,
        )}
        {renderMemberSection(
          'Admins',
          admins,
          <Shield className="w-3 h-3 text-indigo-400" />,
        )}
        {renderMemberSection('Members', regularMembers)}
      </div>
    </div>
  );
}
