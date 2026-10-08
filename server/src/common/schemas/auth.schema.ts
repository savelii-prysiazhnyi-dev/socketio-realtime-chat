import { z } from 'zod';

export const demoLoginSchema = z.object({
  userId: z.uuid('Invalid user ID format'),
});

export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
