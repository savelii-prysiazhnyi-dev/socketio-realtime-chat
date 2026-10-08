import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { groupRoutes } from './group.routes.js';
import { channelRoutes } from './channel.routes.js';

export const apiRoutes: Router = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/groups', groupRoutes);
apiRoutes.use('/channels', channelRoutes);

export { authRoutes, userRoutes, groupRoutes, channelRoutes };
