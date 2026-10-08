import { Plus, Users, Layers } from 'lucide-react';
import type { Group } from '../../types/index.ts';

interface GroupRailProps {
  groups: Group[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroup: () => void;
  onOpenDemoLogin: () => void;
}

export function GroupRail({
  groups,
  activeGroupId,
  onSelectGroup,
  onOpenCreateGroup,
  onOpenDemoLogin,
}: GroupRailProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-16 bg-[#0c0c0e] border-r border-[#1f1f23] flex flex-col items-center py-3 select-none shrink-0 z-20">
      <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 mb-4 shadow-sm">
        <Layers className="w-5 h-5 text-zinc-200" />
      </div>

      <div className="w-8 h-[1px] bg-zinc-800/80 mb-3" />

      <div className="flex-1 w-full space-y-2 overflow-y-auto px-2 flex flex-col items-center">
        {groups.map((group) => {
          const isActive = group.id === activeGroupId;
          return (
            <div key={group.id} className="relative group w-full flex justify-center">
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r transition-all duration-150 ${
                  isActive
                    ? 'h-6 bg-zinc-100'
                    : 'h-0 bg-transparent group-hover:h-3 group-hover:bg-zinc-500'
                }`}
              />
              <button
                type="button"
                onClick={() => onSelectGroup(group.id)}
                title={group.name}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold tracking-tight transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-md'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800/80 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {getInitials(group.name)}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onOpenCreateGroup}
          title="Create Workspace"
          className="w-10 h-10 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="pt-2 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onOpenDemoLogin}
          title="Switch Account"
          className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors cursor-pointer"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
