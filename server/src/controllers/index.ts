import {
  authService,
  userService,
  groupService,
  channelService,
  messageService,
} from '../services/index.js';
import { wsEmitter } from '../ws/emitter.js';
import { AuthController } from './auth.controller.js';
import { UserController } from './user.controller.js';
import { GroupController } from './group.controller.js';
import { ChannelController } from './channel.controller.js';
import { MessageController } from './message.controller.js';

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const groupController = new GroupController(groupService, wsEmitter);
export const channelController = new ChannelController(
  channelService,
  wsEmitter,
);
export const messageController = new MessageController(
  messageService,
  wsEmitter,
);

export {
  AuthController,
  UserController,
  GroupController,
  ChannelController,
  MessageController,
};
