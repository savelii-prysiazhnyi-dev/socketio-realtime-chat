import type { UserRepository } from '../repositories/user.repository.js';
import { NotFoundError } from '../common/errors/httpErrors.js';
import { generateToken } from '../utils/jwt.js';

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async demoLogin(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const token = generateToken({ userId: user.id });
    return { token, user };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
