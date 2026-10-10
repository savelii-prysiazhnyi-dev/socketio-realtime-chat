import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Group name cannot be empty')
    .max(50, 'Group name cannot exceed 50 characters'),
  icon: z.string().trim().url('Invalid icon URL').optional().or(z.literal('')),
});

export const groupIdParamsSchema = z.object({
  groupId: z.uuid('Invalid group ID format'),
});

export const addMemberSchema = z.object({
  userId: z.uuid('Invalid user ID format'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type GroupIdParams = z.infer<typeof groupIdParamsSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
