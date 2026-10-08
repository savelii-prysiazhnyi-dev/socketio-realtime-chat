import { apiClient, setAuthToken } from '../lib/axios.ts';
import type { User, AuthResponse } from '../types/index.ts';

export const getUsers = async (): Promise<User[]> => {
  const response = await apiClient.get<User[]>('/api/users');
  return response.data;
};

export const demoLogin = async (userId: string): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/demo-login', {
    userId,
  });
  setAuthToken(response.data.token);
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/api/auth/me');
  return response.data;
};

export const logout = (): void => {
  setAuthToken(null);
};
