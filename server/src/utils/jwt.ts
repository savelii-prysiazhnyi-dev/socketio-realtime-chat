import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../common/errors/httpErrors.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-chat-jwt-secret-key-32chars!!';

export interface JwtPayload {
  userId: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};
