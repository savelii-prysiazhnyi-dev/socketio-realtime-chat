import {
  userRepository,
  groupRepository,
  channelRepository,
  messageRepository,
} from '../repositories/index.js';
import { AuthService } from './auth.service.js';
import { UserService } from './user.service.js';
import { GroupService } from './group.service.js';
import { ChannelService } from './channel.service.js';
import { MessageService } from './message.service.js';

import { presenceService, PresenceService } from './presence.service.js';

export const authService = new AuthService(userRepository);
export const userService = new UserService(userRepository);
export const groupService = new GroupService(groupRepository, userRepository);
export const channelService = new ChannelService(
  channelRepository,
  groupRepository,
);
export const messageService = new MessageService(
  messageRepository,
  channelRepository,
  groupRepository,
);
export { presenceService };

export {
  AuthService,
  UserService,
  GroupService,
  ChannelService,
  MessageService,
  PresenceService,
};
