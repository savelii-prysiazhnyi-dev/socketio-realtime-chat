import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChannelMessages, sendMessage } from '../api/messages.api.ts';
import type { Message, MessagesResponse } from '../types/index.ts';

export const MESSAGE_KEYS = {
  byChannel: (channelId: string, cursor?: string) =>
    ['messages', channelId, cursor ?? 'latest'] as const,
};

export function useChannelMessages(
  channelId: string | undefined,
  cursor?: string,
) {
  return useQuery<MessagesResponse>({
    queryKey: MESSAGE_KEYS.byChannel(channelId ?? '', cursor),
    queryFn: () => getChannelMessages(channelId!, 50, cursor),
    enabled: Boolean(channelId),
  });
}

export function useSendMessage(channelId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, string>({
    mutationFn: (content: string) => sendMessage(channelId!, content),
    onSuccess: () => {
      if (channelId) {
        queryClient.invalidateQueries({
          queryKey: ['messages', channelId],
        });
      }
    },
  });
}
