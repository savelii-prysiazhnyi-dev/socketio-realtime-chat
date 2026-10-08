import type { AppError } from '../interfaces/error/AppError.js';

export class HttpError extends Error implements AppError {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(401, message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(403, message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', details?: Record<string, unknown>) {
    super(404, message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(409, message, details);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends HttpError {
  constructor(
    message = 'Internal Server Error',
    details?: Record<string, unknown>,
  ) {
    super(500, message, details);
    this.name = 'InternalServerError';
  }
}
