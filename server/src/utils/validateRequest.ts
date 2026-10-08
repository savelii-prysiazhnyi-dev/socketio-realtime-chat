import type { ZodType } from 'zod';
import type { Request } from 'express';
import { BadRequestError } from '../common/errors/httpErrors.js';

type RequestSource = 'body' | 'params' | 'query';

export const validateRequest = <T>(
  request: Request,
  schema: ZodType<T>,
  errorMessage: string,
  source: RequestSource = 'body',
): T => {
  const parseResult = schema.safeParse(request[source]);

  if (!parseResult.success) {
    throw new BadRequestError(
      errorMessage,
      parseResult.error as unknown as Record<string, unknown>,
    );
  }

  return parseResult.data;
};

export default validateRequest;
