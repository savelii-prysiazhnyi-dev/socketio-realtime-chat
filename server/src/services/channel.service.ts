import type { ChannelRepository } from '../repositories/channel.repository.js';
import type { GroupRepository } from '../repositories/group.repository.js';
import { MemberRole } from '../../generated/prisma/enums.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../common/errors/httpErrors.js';
import type { CreateChannelInput } from '../common/schemas/channel.schema.js';
import { Prisma } from '../../generated/prisma/client.js';

export class ChannelService {
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly groupRepository: GroupRepository,
  ) {}

  async getChannelsByGroup(groupId: string, userId: string) {
    const member = await this.groupRepository.findMember(groupId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this group');
    }

    return this.channelRepository.findByGroupId(groupId);
  }

  async getChannelById(channelId: string, userId: string) {
    const channel = await this.channelRepository.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    const member = await this.groupRepository.findMember(
      channel.groupId,
      userId,
    );
    if (!member) {
      throw new ForbiddenError("You are not a member of this channel's group");
    }

    return channel;
  }

  async createChannel(
    groupId: string,
    userId: string,
    data: CreateChannelInput,
  ) {
    const member = await this.groupRepository.findMember(groupId, userId);
    if (
      !member ||
      (member.role !== MemberRole.OWNER && member.role !== MemberRole.ADMIN)
    ) {
      throw new ForbiddenError(
        'Only group owners or admins can create channels',
      );
    }

    const normalizedName = data.name.toLowerCase().trim();
    const existing = await this.channelRepository.findByNameAndGroupId(
      groupId,
      normalizedName,
    );
    if (existing) {
      throw new ConflictError(
        `Channel '#${normalizedName}' already exists in this group`,
      );
    }

    try {
      return await this.channelRepository.create({
        name: normalizedName,
        topic: data.topic,
        groupId,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictError(
          `Channel '#${normalizedName}' already exists in this group`,
        );
      }
      throw err;
    }
  }
}
