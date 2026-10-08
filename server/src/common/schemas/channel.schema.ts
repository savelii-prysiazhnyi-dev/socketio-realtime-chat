import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Channel name cannot be empty')
    .max(50, 'Channel name cannot exceed 50 characters')
    .regex(
      /^[a-z0-9-_]+$/i,
      'Channel name must contain only letters, numbers, hyphens, and underscores',
    ),
  topic: z
    .string()
    .trim()
    .max(255, 'Topic cannot exceed 255 characters')
    .optional(),
});

export const channelIdParamsSchema = z.object({
  channelId: z.uuid('Invalid channel ID format'),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type ChannelIdParams = z.infer<typeof channelIdParamsSchema>;
