import { prisma } from '../utils/prisma.js';
import { UserRepository } from './user.repository.js';
import { GroupRepository } from './group.repository.js';
import { ChannelRepository } from './channel.repository.js';
import { MessageRepository } from './message.repository.js';

export const userRepository = new UserRepository(prisma);
export const groupRepository = new GroupRepository(prisma);
export const channelRepository = new ChannelRepository(prisma);
export const messageRepository = new MessageRepository(prisma);

export {
  UserRepository,
  GroupRepository,
  ChannelRepository,
  MessageRepository,
};
