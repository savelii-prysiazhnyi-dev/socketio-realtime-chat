import { Router } from 'express';
import { userController } from '../controllers/index.js';

export const userRoutes: Router = Router();

userRoutes.get('/', userController.list.bind(userController));
