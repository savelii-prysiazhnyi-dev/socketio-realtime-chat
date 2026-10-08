import type { PrismaClient } from '../../generated/prisma/client.js';

export class MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMessagesByChannel(
    channelId: string,
    limit: number,
    cursor?: string,
  ) {
    const rawMessages = await this.prisma.message.findMany({
      where: { channelId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    const hasMore = rawMessages.length > limit;
    if (hasMore) {
      rawMessages.pop();
    }

    const nextCursor =
      hasMore && rawMessages.length > 0
        ? rawMessages[rawMessages.length - 1].id
        : undefined;

    const messages = rawMessages.reverse();

    return {
      messages,
      nextCursor,
    };
  }

  async create(data: { content: string; channelId: string; userId: string }) {
    return this.prisma.message.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }
}
