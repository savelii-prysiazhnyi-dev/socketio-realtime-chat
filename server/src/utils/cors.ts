import type { CorsOptions } from 'cors';

export const getCorsSettings = (): CorsOptions => {
  const rawOrigins = process.env.CORS_ORIGIN || '*';
  const allowedOrigins =
    rawOrigins === '*' ? '*' : rawOrigins.split(',').map(o => o.trim());

  return {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  };
};
