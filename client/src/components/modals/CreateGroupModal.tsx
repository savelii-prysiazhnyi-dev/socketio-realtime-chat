import * as React from 'react';
import { Dialog } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Button } from '../ui/button.tsx';
import { useCreateGroup } from '../../hooks/useGroups.ts';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (groupId: string) => void;
}

export function CreateGroupModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateGroupModalProps) {
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createGroupMutation = useCreateGroup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    try {
      setError(null);
      const group = await createGroupMutation.mutateAsync(name.trim());
      setName('');
      onOpenChange(false);
      onSuccess?.(group.id);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error || 'Failed to create group'
          : 'Failed to create group';
      setError(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Workspace"
      description="Create a new group workspace. You will be assigned as the OWNER with a default #general channel."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Workspace Name
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Core Engineering, Marketing, Finance"
            autoFocus
          />
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createGroupMutation.isPending || !name.trim()}
          >
            {createGroupMutation.isPending ? 'Creating...' : 'Create Workspace'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
