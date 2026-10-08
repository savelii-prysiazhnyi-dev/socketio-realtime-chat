import * as React from 'react';
import type { User } from '../types/index.ts';

export interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  login: (userId: string) => Promise<void>;
  logout: () => void;
  isLoggingIn: boolean;
  selectedUserId: string | null;
  loginError: string | null;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
