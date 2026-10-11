import { Router } from 'express';
import { userController } from '../controllers/index.js';
import { userCreationRateLimiter } from '../middlewares/rateLimit.middleware.js';

export const userRoutes: Router = Router();

userRoutes.get('/', userController.list.bind(userController));
userRoutes.post('/', userCreationRateLimiter);
