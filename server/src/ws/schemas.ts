import { z } from 'zod';

export const groupRoomPayloadSchema = z.object({
  groupId: z.uuid('Invalid group ID format'),
});

export const typingPayloadSchema = z.object({
  groupId: z.uuid('Invalid group ID format'),
  channelId: z.uuid('Invalid channel ID format'),
});

export type GroupRoomPayload = z.infer<typeof groupRoomPayloadSchema>;
export type TypingPayload = z.infer<typeof typingPayloadSchema>;
