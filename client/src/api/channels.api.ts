import { apiClient } from '../lib/axios.ts';
import type { Channel } from '../types/index.ts';

export const getGroupChannels = async (
  groupId: string,
): Promise<Channel[]> => {
  const response = await apiClient.get<Channel[]>(
    `/api/groups/${groupId}/channels`,
  );
  return response.data;
};

export const getChannel = async (channelId: string): Promise<Channel> => {
  const response = await apiClient.get<Channel>(`/api/channels/${channelId}`);
  return response.data;
};

export const createChannel = async (
  groupId: string,
  name: string,
  topic?: string,
): Promise<Channel> => {
  const response = await apiClient.post<Channel>(
    `/api/groups/${groupId}/channels`,
    {
      name,
      topic,
    },
  );
  return response.data;
};
