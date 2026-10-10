import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroupChannels,
  getChannel,
  createChannel,
} from '../api/channels.api.ts';
import type { Channel } from '../types/index.ts';

export const CHANNEL_KEYS = {
  byGroup: (groupId: string) => ['channels', 'byGroup', groupId] as const,
  detail: (channelId: string) => ['channels', channelId] as const,
};

export function useGroupChannels(groupId: string | undefined) {
  return useQuery<Channel[]>({
    queryKey: CHANNEL_KEYS.byGroup(groupId ?? ''),
    queryFn: () => getGroupChannels(groupId!),
    enabled: Boolean(groupId),
  });
}

export function useChannel(channelId: string | undefined) {
  return useQuery<Channel>({
    queryKey: CHANNEL_KEYS.detail(channelId ?? ''),
    queryFn: () => getChannel(channelId!),
    enabled: Boolean(channelId),
  });
}

export function useCreateChannel(groupId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Channel, Error, { name: string; topic?: string }>({
    mutationFn: ({ name, topic }) => createChannel(groupId!, name, topic),
    onSuccess: (newChannel) => {
      if (groupId) {
        queryClient.setQueryData<Channel[]>(
          CHANNEL_KEYS.byGroup(groupId),
          (old) => {
            if (!old) return [newChannel];
            if (old.some((c) => c.id === newChannel.id)) return old;
            return [...old, newChannel];
          },
        );
        queryClient.invalidateQueries({
          queryKey: CHANNEL_KEYS.byGroup(groupId),
        });
      }
    },
  });
}
