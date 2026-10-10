import type { ZodType } from 'zod';

export const validateSocketPayload = <T>(
  schema: ZodType<T>,
  data: unknown,
): T | null => {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
};
