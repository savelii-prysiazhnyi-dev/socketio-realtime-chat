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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
    }
    return Promise.reject(error);
  },
);
