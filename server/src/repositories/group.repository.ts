import type { PrismaClient } from '../../generated/prisma/client.js';
import { MemberRole } from '../../generated/prisma/enums.js';

export class GroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserGroups(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true, channels: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findById(groupId: string) {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { members: true, channels: true },
        },
      },
    });
  }

  async createGroup(data: { name: string; icon?: string; ownerId: string }) {
    return this.prisma.$transaction(async tx => {
      const group = await tx.group.create({
        data: {
          name: data.name,
          icon: data.icon || null,
          members: {
            create: {
              userId: data.ownerId,
              role: MemberRole.OWNER,
            },
          },
          channels: {
            create: {
              name: 'general',
              topic: 'General discussion',
            },
          },
        },
        include: {
          channels: true,
          members: true,
        },
      });

      return group;
    });
  }

  async findMember(groupId: string, userId: string) {
    return this.prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
  }

  async findMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });
  }

  async addMember(
    groupId: string,
    userId: string,
    role: MemberRole = MemberRole.MEMBER,
  ) {
    return this.prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }
}
