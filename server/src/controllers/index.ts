import {
  authService,
  userService,
  groupService,
  channelService,
  messageService,
} from '../services/index.js';
import { AuthController } from './auth.controller.js';
import { UserController } from './user.controller.js';
import { GroupController } from './group.controller.js';
import { ChannelController } from './channel.controller.js';
import { MessageController } from './message.controller.js';

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const groupController = new GroupController(groupService);
export const channelController = new ChannelController(channelService);
export const messageController = new MessageController(messageService);

export {
  AuthController,
  UserController,
  GroupController,
  ChannelController,
  MessageController,
};
