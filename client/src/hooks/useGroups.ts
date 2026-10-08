import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGroups,
  getGroup,
  createGroup,
  getGroupMembers,
  addGroupMember,
} from '../api/groups.api.ts';
import type { Group, GroupMember, MemberRole } from '../types/index.ts';

export const GROUP_KEYS = {
  all: ['groups'] as const,
  detail: (groupId: string) => ['groups', groupId] as const,
  members: (groupId: string) => ['groups', groupId, 'members'] as const,
};

export function useGroups() {
  return useQuery<Group[]>({
    queryKey: GROUP_KEYS.all,
    queryFn: getGroups,
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery<Group>({
    queryKey: GROUP_KEYS.detail(groupId ?? ''),
    queryFn: () => getGroup(groupId!),
    enabled: Boolean(groupId),
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery<GroupMember[]>({
    queryKey: GROUP_KEYS.members(groupId ?? ''),
    queryFn: () => getGroupMembers(groupId!),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation<Group, Error, string>({
    mutationFn: (name: string) => createGroup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.all });
    },
  });
}

export function useAddGroupMember(groupId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<
    GroupMember,
    Error,
    { userId: string; role?: MemberRole }
  >({
    mutationFn: ({ userId, role }) => addGroupMember(groupId!, userId, role),
    onSuccess: () => {
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: GROUP_KEYS.members(groupId),
        });
      }
    },
  });
}
