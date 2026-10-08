import { Router } from 'express';
import { groupController, channelController } from '../controllers/index.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const groupRoutes: Router = Router();

groupRoutes.use(authenticate);

groupRoutes.get('/', groupController.list.bind(groupController));
groupRoutes.post('/', groupController.create.bind(groupController));
groupRoutes.get('/:groupId', groupController.getById.bind(groupController));
groupRoutes.get(
  '/:groupId/members',
  groupController.listMembers.bind(groupController),
);
groupRoutes.post(
  '/:groupId/members',
  groupController.addMember.bind(groupController),
);

groupRoutes.get(
  '/:groupId/channels',
  channelController.listByGroup.bind(channelController),
);
groupRoutes.post(
  '/:groupId/channels',
  channelController.create.bind(channelController),
);
