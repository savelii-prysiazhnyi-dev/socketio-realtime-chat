import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../api/auth.api.ts';
import { useAuth, type AuthContextType } from '../context/auth-context.ts';
import type { User } from '../types/index.ts';

export { useAuth, type AuthContextType };

export const AUTH_KEYS = {
  users: ['users'] as const,
  currentUser: ['currentUser'] as const,
};

export function useUsers() {
  return useQuery<User[]>({
    queryKey: AUTH_KEYS.users,
    queryFn: getUsers,
  });
}

export function useCurrentUser() {
  const { currentUser } = useAuth();
  return {
    data: currentUser,
  };
}
