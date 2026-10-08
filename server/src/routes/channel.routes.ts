import { Router } from 'express';
import { channelController, messageController } from '../controllers/index.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const channelRoutes: Router = Router();

channelRoutes.use(authenticate);

channelRoutes.get(
  '/:channelId',
  channelController.getById.bind(channelController),
);
channelRoutes.get(
  '/:channelId/messages',
  messageController.listByChannel.bind(messageController),
);
channelRoutes.post(
  '/:channelId/messages',
  messageController.create.bind(messageController),
);
