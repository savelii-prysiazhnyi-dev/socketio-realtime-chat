import { useState, type FormEvent } from 'react';
import { Dialog } from '../ui/dialog.tsx';
import { Button } from '../ui/button.tsx';
import { Avatar } from '../ui/avatar.tsx';
import { useUsers } from '../../hooks/useAuth.ts';
import { useAddGroupMember, useGroupMembers } from '../../hooks/useGroups.ts';
import type { MemberRole } from '../../types/index.ts';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  groupId,
}: InviteMemberModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<MemberRole>('MEMBER');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedUserId('');
    setRole('MEMBER');
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const { data: allUsers = [] } = useUsers();
  const { data: currentMembers = [] } = useGroupMembers(groupId);
  const addMemberMutation = useAddGroupMember(groupId);

  const existingUserIds = new Set(currentMembers.map((m) => m.userId));
  const availableUsers = allUsers.filter((u) => !existingUserIds.has(u.id));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a user to invite');
      return;
    }

    try {
      setError(null);
      await addMemberMutation.mutateAsync({
        userId: selectedUserId,
        role,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error || 'Failed to add member'
          : 'Failed to add member';
      setError(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Invite Team Member"
      description="Select an existing user in the system to join this workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Select User
          </label>
          {availableUsers.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">
              All registered users are already members of this workspace.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-zinc-800 p-1">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    setSelectedUserId(user.id);
                    if (error) setError(null);
                  }}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                    selectedUserId === user.id
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'hover:bg-zinc-900 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={user.name} src={user.avatar} size="sm" />
                    <div>
                      <div className="font-medium text-zinc-200">{user.name}</div>
                      <div className="text-[11px] text-zinc-500">{user.email}</div>
                    </div>
                  </div>
                  {selectedUserId === user.id && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('MEMBER')}
              className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                role === 'MEMBER'
                  ? 'border-zinc-500 bg-zinc-900 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              <div className="text-xs font-medium">Member</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Can view channels & send messages
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole('ADMIN')}
              className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                role === 'ADMIN'
                  ? 'border-indigo-600 bg-indigo-950/40 text-indigo-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              <div className="text-xs font-medium">Admin</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Can create channels & invite users
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              addMemberMutation.isPending ||
              !selectedUserId ||
              availableUsers.length === 0
            }
          >
            {addMemberMutation.isPending ? 'Inviting...' : 'Add Member'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
