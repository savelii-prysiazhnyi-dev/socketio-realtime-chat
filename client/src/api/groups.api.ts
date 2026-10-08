import { apiClient } from '../lib/axios.ts';
import type { Group, GroupMember, MemberRole } from '../types/index.ts';

export const getGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>('/api/groups');
  return response.data;
};

export const getGroup = async (groupId: string): Promise<Group> => {
  const response = await apiClient.get<Group>(`/api/groups/${groupId}`);
  return response.data;
};

export const createGroup = async (name: string): Promise<Group> => {
  const response = await apiClient.post<Group>('/api/groups', { name });
  return response.data;
};

export const getGroupMembers = async (
  groupId: string,
): Promise<GroupMember[]> => {
  const response = await apiClient.get<GroupMember[]>(
    `/api/groups/${groupId}/members`,
  );
  return response.data;
};

export const addGroupMember = async (
  groupId: string,
  userId: string,
  role: MemberRole = 'MEMBER',
): Promise<GroupMember> => {
  const response = await apiClient.post<GroupMember>(
    `/api/groups/${groupId}/members`,
    {
      userId,
      role,
    },
  );
  return response.data;
};
