import { apiClient } from '../lib/axios.ts';
import type { Message, MessagesResponse } from '../types/index.ts';

export const getChannelMessages = async (
  channelId: string,
  limit = 50,
  cursor?: string,
): Promise<MessagesResponse> => {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await apiClient.get<MessagesResponse>(
    `/api/channels/${channelId}/messages?${params.toString()}`,
  );
  return response.data;
};

export const sendMessage = async (
  channelId: string,
  content: string,
): Promise<Message> => {
  const response = await apiClient.post<Message>(
    `/api/channels/${channelId}/messages`,
    {
      content,
    },
  );
  return response.data;
};
