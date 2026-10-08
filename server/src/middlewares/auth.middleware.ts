import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../common/errors/httpErrors.js';
import { verifyToken } from '../utils/jwt.js';

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication token cannot be empty');
  }

  const payload = verifyToken(token);
  req.user = { id: payload.userId };
  next();
};
