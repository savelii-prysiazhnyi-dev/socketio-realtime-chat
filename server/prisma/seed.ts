import { prisma } from '../src/utils/prisma.js';
import { MemberRole } from '../generated/prisma/enums.js';

export async function seed() {
  const isForce = process.env.FORCE_SEED === 'true';
  const existingUsers = await prisma.user.count();

  if (existingUsers > 0 && !isForce) {
    console.log('Database already contains data, skipping seed.');
    return;
  }

  if (isForce) {
    console.log('Clearing existing data...');
    await prisma.message.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();
  }

  console.log('Creating demo users (personas)...');
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces',
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&crop=faces',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      avatar:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=128&h=128&fit=crop&crop=faces',
    },
  });

  console.log('Creating groups and channels...');
  const engineeringGroup = await prisma.group.create({
    data: {
      name: 'Engineering Hub',
      icon: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=128&h=128&fit=crop',
      members: {
        create: [
          { userId: alice.id, role: MemberRole.OWNER },
          { userId: bob.id, role: MemberRole.ADMIN },
          { userId: charlie.id, role: MemberRole.MEMBER },
        ],
      },
      channels: {
        create: [
          {
            name: 'general',
            topic: 'General discussion and company announcements',
          },
          { name: 'frontend', topic: 'React, Tailwind, and UI components' },
          { name: 'backend', topic: 'Node, Express, Prisma, and WebSockets' },
        ],
      },
    },
    include: {
      channels: true,
    },
  });

  await prisma.group.create({
    data: {
      name: 'Design Studio',
      icon: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=128&h=128&fit=crop',
      members: {
        create: [
          { userId: bob.id, role: MemberRole.OWNER },
          { userId: alice.id, role: MemberRole.MEMBER },
        ],
      },
      channels: {
        create: [
          { name: 'general', topic: 'Design team sync' },
          { name: 'ui-ux-reviews', topic: 'Figma reviews and mockups' },
        ],
      },
    },
    include: {
      channels: true,
    },
  });

  console.log('Creating starter messages...');
  const generalChannel = engineeringGroup.channels.find(
    c => c.name === 'general',
  )!;
  const backendChannel = engineeringGroup.channels.find(
    c => c.name === 'backend',
  )!;

  await prisma.message.createMany({
    data: [
      {
        channelId: generalChannel.id,
        userId: alice.id,
        content: 'Welcome everyone to the Engineering Hub! 🎉',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        channelId: generalChannel.id,
        userId: bob.id,
        content: 'Hey Alice! Excited to collaborate here.',
        createdAt: new Date(Date.now() - 1000 * 60 * 55),
      },
      {
        channelId: generalChannel.id,
        userId: charlie.id,
        content: 'Checking in. Real-time chat looking great!',
        createdAt: new Date(Date.now() - 1000 * 60 * 10),
      },
      {
        channelId: backendChannel.id,
        userId: alice.id,
        content: 'Backend REST API and WebSockets are being configured.',
        createdAt: new Date(Date.now() - 1000 * 60 * 30),
      },
      {
        channelId: backendChannel.id,
        userId: bob.id,
        content: 'Nice! Testing with SQLite and better-sqlite3 adapter.',
        createdAt: new Date(Date.now() - 1000 * 60 * 15),
      },
    ],
  });

  console.log('Database seeded successfully!');
}

seed()
  .catch(e => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
