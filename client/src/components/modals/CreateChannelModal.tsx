import { useState, type FormEvent } from 'react';
import { Dialog } from '../ui/dialog.tsx';
import { Input } from '../ui/input.tsx';
import { Button } from '../ui/button.tsx';
import { useCreateChannel } from '../../hooks/useChannels.ts';

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onSuccess?: (channelId: string) => void;
}

export function CreateChannelModal({
  open,
  onOpenChange,
  groupId,
  onSuccess,
}: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createChannelMutation = useCreateChannel(groupId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase();

    if (!cleanName) {
      setError('Channel name cannot be empty');
      return;
    }

    if (!/^[a-z0-9-_]+$/i.test(cleanName)) {
      setError(
        'Channel name must contain only letters, numbers, hyphens, and underscores',
      );
      return;
    }

    try {
      setError(null);
      const channel = await createChannelMutation.mutateAsync({
        name: cleanName,
        topic: topic.trim() || undefined,
      });
      setName('');
      setTopic('');
      onOpenChange(false);
      onSuccess?.(channel.id);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error || 'Failed to create channel'
          : 'Failed to create channel';
      setError(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Channel"
      description="Create a new communication channel for discussions and updates."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Channel Name
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500 text-xs">
              #
            </span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                if (error) setError(null);
              }}
              placeholder="e.g. dev-updates, alerts, random"
              className="pl-7"
              autoFocus
            />
          </div>
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Topic <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this channel about?"
          />
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
            disabled={createChannelMutation.isPending || !name.trim()}
          >
            {createChannelMutation.isPending ? 'Creating...' : 'Create Channel'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
