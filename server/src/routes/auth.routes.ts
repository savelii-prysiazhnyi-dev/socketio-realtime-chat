import { Router } from 'express';
import { authController } from '../controllers/index.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const authRoutes: Router = Router();

authRoutes.post('/demo-login', authController.demoLogin.bind(authController));
authRoutes.get('/me', authenticate, authController.getMe.bind(authController));
