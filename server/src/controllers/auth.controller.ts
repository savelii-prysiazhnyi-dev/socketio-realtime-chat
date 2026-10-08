import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../services/auth.service.js';
import { validateRequest } from '../utils/validateRequest.js';
import { demoLoginSchema } from '../common/schemas/auth.schema.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async demoLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = validateRequest(
        req,
        demoLoginSchema,
        'Invalid demo login request body',
      );
      const result = await this.authService.demoLogin(userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await this.authService.getMe(req.user!.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
}
