import type { PrismaClient } from '../../generated/prisma/client.js';

export class ChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGroupId(groupId: string) {
    return this.prisma.channel.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(channelId: string) {
    return this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByNameAndGroupId(groupId: string, name: string) {
    return this.prisma.channel.findUnique({
      where: {
        groupId_name: {
          groupId,
          name,
        },
      },
    });
  }

  async create(data: { name: string; topic?: string; groupId: string }) {
    return this.prisma.channel.create({
      data: {
        name: data.name,
        topic: data.topic || null,
        groupId: data.groupId,
      },
    });
  }
}
