import type { UserRepository } from '../repositories/user.repository.js';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getAllUsers() {
    return this.userRepository.findAll();
  }
}
