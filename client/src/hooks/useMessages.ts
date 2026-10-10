import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { getChannelMessages, sendMessage } from '../api/messages.api.ts';
import type { Message, MessagesResponse } from '../types/index.ts';

export const MESSAGE_KEYS = {
  byChannel: (channelId: string) => ['messages', channelId] as const,
};

export function useChannelMessages(channelId: string | undefined) {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: MESSAGE_KEYS.byChannel(channelId ?? ''),
    queryFn: ({ pageParam }) =>
      getChannelMessages(channelId!, 50, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(channelId),
  });
}

export function useSendMessage(channelId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, string>({
    mutationFn: (content: string) => sendMessage(channelId!, content),
    onSuccess: (message) => {
      if (!channelId) return;
      queryClient.setQueriesData<InfiniteData<MessagesResponse>>(
        { queryKey: MESSAGE_KEYS.byChannel(channelId) },
        (old) => {
          if (!old) return old;
          if (
            old.pages.some((page) =>
              page.messages.some((m) => m.id === message.id),
            )
          ) {
            return old;
          }
          const updatedPages = [...old.pages];
          const firstPage = updatedPages[0];
          updatedPages[0] = {
            ...firstPage,
            messages: [...firstPage.messages, message],
          };
          return {
            ...old,
            pages: updatedPages,
          };
        },
      );
    },
  });
}
