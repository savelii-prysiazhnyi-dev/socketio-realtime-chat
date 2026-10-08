import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { demoLogin, logout as logoutApi } from '../api/auth.api.ts';
import { setAuthToken } from '../lib/axios.ts';
import type { User } from '../types/index.ts';
import { AuthContext } from './auth-context.ts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const login = async (userId: string) => {
    try {
      setSelectedUserId(userId);
      setIsLoggingIn(true);
      setLoginError(null);
      const res = await demoLogin(userId);
      setAuthToken(res.token);
      setTokenState(res.token);
      setCurrentUser(res.user);
      queryClient.setQueryData(['currentUser'], res.user);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error || 'Authentication failed'
          : 'Authentication failed';
      setLoginError(msg);
      throw err;
    } finally {
      setIsLoggingIn(false);
      setSelectedUserId(null);
    }
  };

  const logout = () => {
    logoutApi();
    setAuthToken(null);
    setTokenState(null);
    setCurrentUser(null);
    queryClient.removeQueries({ queryKey: ['currentUser'] });
    queryClient.removeQueries({ queryKey: ['groups'] });
    queryClient.removeQueries({ queryKey: ['channels'] });
    queryClient.removeQueries({ queryKey: ['messages'] });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        login,
        logout,
        isLoggingIn,
        selectedUserId,
        loginError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
