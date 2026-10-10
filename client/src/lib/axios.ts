import axios, { type InternalAxiosRequestConfig } from 'axios';

let inMemoryToken: string | null = null;

export const getAuthToken = (): string | null => {
  return inMemoryToken;
};

export const setAuthToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (
  handler: UnauthorizedHandler | null,
): void => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);
