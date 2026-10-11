import type { Request } from 'express';
import {
  rateLimit,
  ipKeyGenerator,
  MemoryStore,
  type RateLimitRequestHandler,
  type Options,
} from 'express-rate-limit';

export const getClientIp = (req: Request): string => {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim().length > 0) {
    return cf.trim();
  }
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim().length > 0) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp.length > 0) {
      return firstIp;
    }
  }
  if (req.ip && req.ip.length > 0) {
    return req.ip;
  }
  return req.socket?.remoteAddress || '127.0.0.1';
};

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: { error: string };
}

export const AUTH_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
};

export const USER_CREATION_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
};

export const GENERAL_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  limit: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
};

const registeredStores: MemoryStore[] = [];

export const createRateLimiter = (
  config: RateLimitConfig,
  overrides: Partial<Options> = {},
): RateLimitRequestHandler => {
  const store = new MemoryStore();
  registeredStores.push(store);

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    store,
    validate: { xForwardedForHeader: false, default: true },
    keyGenerator: (req: Request) => ipKeyGenerator(getClientIp(req)),
    message: config.message ?? {
      error: 'Too many requests from this IP, please try again later.',
    },
    ...overrides,
  });
};

export const authRateLimiter = createRateLimiter(AUTH_RATE_LIMIT_CONFIG);
export const userCreationRateLimiter = createRateLimiter(
  USER_CREATION_RATE_LIMIT_CONFIG,
);
export const generalRateLimiter = createRateLimiter(GENERAL_RATE_LIMIT_CONFIG);

export const resetRateLimits = async (): Promise<void> => {
  await Promise.all(registeredStores.map(store => store.resetAll()));
};
