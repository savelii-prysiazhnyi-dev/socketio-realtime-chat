import type { GroupRepository } from '../repositories/group.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';
import { MemberRole } from '../../generated/prisma/enums.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../common/errors/httpErrors.js';
import type { CreateGroupInput } from '../common/schemas/group.schema.js';

export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getUserGroups(userId: string) {
    return this.groupRepository.findUserGroups(userId);
  }

  async getGroupById(groupId: string, userId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const member = await this.groupRepository.findMember(groupId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this group');
    }

    return {
      ...group,
      role: member.role,
    };
  }

  async createGroup(userId: string, data: CreateGroupInput) {
    return this.groupRepository.createGroup({
      name: data.name,
      icon: data.icon,
      ownerId: userId,
    });
  }

  async getGroupMembers(groupId: string, userId: string) {
    const member = await this.groupRepository.findMember(groupId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this group');
    }

    return this.groupRepository.findMembers(groupId);
  }

  async addMember(
    groupId: string,
    actorUserId: string,
    targetUserId: string,
    role: MemberRole = MemberRole.MEMBER,
  ) {
    const actorMember = await this.groupRepository.findMember(
      groupId,
      actorUserId,
    );
    if (
      !actorMember ||
      (actorMember.role !== MemberRole.OWNER &&
        actorMember.role !== MemberRole.ADMIN)
    ) {
      throw new ForbiddenError(
        'Only group owners or admins can invite new members',
      );
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User to invite does not exist');
    }

    const existingMember = await this.groupRepository.findMember(
      groupId,
      targetUserId,
    );
    if (existingMember) {
      throw new ConflictError('User is already a member of this group');
    }

    return this.groupRepository.addMember(groupId, targetUserId, role);
  }
}
