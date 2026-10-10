import type { CorsOptions } from 'cors';

export const getCorsSettings = (): CorsOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawOrigins = process.env.CORS_ORIGIN;

  if (isProduction && (!rawOrigins || rawOrigins === '*')) {
    throw new Error(
      'CORS_ORIGIN must be explicitly configured with trusted origins in production mode when credentials are enabled',
    );
  }

  let origin: CorsOptions['origin'];

  if (rawOrigins && rawOrigins !== '*') {
    origin = rawOrigins.split(',').map(o => o.trim());
  } else if (!isProduction) {
    origin = true;
  } else {
    origin = [];
  }

  return {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  };
};
