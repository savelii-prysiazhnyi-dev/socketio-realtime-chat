import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../common/errors/httpErrors.js';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET environment variable must be set with at least 32 characters in production mode',
      );
    }
    return secret;
  }
  return secret || 'dev-chat-jwt-secret-key-32chars!!';
};

export interface JwtPayload {
  userId: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};
