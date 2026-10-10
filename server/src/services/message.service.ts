import type { MessageRepository } from '../repositories/message.repository.js';
import type { ChannelRepository } from '../repositories/channel.repository.js';
import type { GroupRepository } from '../repositories/group.repository.js';
import { NotFoundError, ForbiddenError } from '../common/errors/httpErrors.js';

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly groupRepository: GroupRepository,
  ) {}

  async getChannelMessages(
    channelId: string,
    userId: string,
    limit: number,
    cursor?: string,
  ) {
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

    return this.messageRepository.findMessagesByChannel(
      channelId,
      limit,
      cursor,
    );
  }

  async createMessage(channelId: string, userId: string, content: string) {
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

    const message = await this.messageRepository.create({
      channelId,
      userId,
      content,
    });

    return {
      ...message,
      groupId: channel.groupId,
    };
  }
}
