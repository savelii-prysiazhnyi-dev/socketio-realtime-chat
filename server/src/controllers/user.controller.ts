import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '../services/user.service.js';

export class UserController {
  constructor(private readonly userService: UserService) {}

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await this.userService.getAllUsers();
      res.status(200).json(users);
    } catch (err) {
      next(err);
    }
  }
}
