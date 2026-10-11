import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import request from 'supertest';
import { type Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../../src/utils/prisma.js';
import {
  createTestWsServer,
  createTestClient,
  waitFor,
  waitForEventOmission,
  createAuthToken,
  type TestWsServer,
} from './wsHelper.js';

interface MessageCreatedEvent {
  channelId: string;
  groupId: string;
  message: {
    id: string;
    content: string;
    channelId: string;
    userId: string;
    createdAt: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

interface ChannelCreatedEvent {
  groupId: string;
  channel: {
    id: string;
    name: string;
    topic: string | null;
    groupId: string;
  };
}

interface MemberJoinedEvent {
  groupId: string;
  member: {
    groupId: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

interface GroupInvitedEvent {
  group: {
    id: string;
    name: string;
  };
}

describe('WebSocket Outbound Broadcasts from REST Mutations', () => {
  let server: TestWsServer;
  let openSockets: ClientSocket[] = [];

  const trackSocket = (socket: ClientSocket): ClientSocket => {
    openSockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    server = await createTestWsServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    openSockets = [];
    await prisma.message.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    for (const socket of openSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
  });

  it('should broadcast message:created with author details when message is created via REST', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });
    const channel = await prisma.channel.create({
      data: { name: 'general', groupId: group.id },
    });

    await prisma.groupMember.createMany({
      data: [
        { groupId: group.id, userId: alice.id, role: 'OWNER' },
        { groupId: group.id, userId: bob.id, role: 'MEMBER' },
      ],
    });

    const bobClient = trackSocket(
      createTestClient(server.port, createAuthToken(bob.id)),
    );
    await waitFor(bobClient, 'connect');

    const bobMessagePromise = waitFor<MessageCreatedEvent>(
      bobClient,
      'message:created',
    );

    const aliceToken = createAuthToken(alice.id);
    const res = await request(server.app)
      .post(`/api/channels/${channel.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Hello team!' });

    expect(res.status).toBe(201);

    const event = await bobMessagePromise;
    expect(event.channelId).toBe(channel.id);
    expect(event.groupId).toBe(group.id);
    expect(event.message.id).toBe(res.body.id);
    expect(event.message.content).toBe('Hello team!');
    expect(event.message.user.name).toBe('Alice');
  });

  it('should isolate message:created broadcasts to the targeted group', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const charlie = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@test.com' },
    });
    const group1 = await prisma.group.create({
      data: { name: 'Group 1' },
    });
    const group2 = await prisma.group.create({
      data: { name: 'Group 2' },
    });
    const channel1 = await prisma.channel.create({
      data: { name: 'general-1', groupId: group1.id },
    });

    await prisma.groupMember.create({
      data: { groupId: group1.id, userId: alice.id, role: 'OWNER' },
    });
    await prisma.groupMember.create({
      data: { groupId: group2.id, userId: charlie.id, role: 'OWNER' },
    });

    const charlieClient = trackSocket(
      createTestClient(server.port, createAuthToken(charlie.id)),
    );
    await waitFor(charlieClient, 'connect');

    const aliceToken = createAuthToken(alice.id);
    await request(server.app)
      .post(`/api/channels/${channel1.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Confidential group 1 message' });

    await waitForEventOmission(charlieClient, 'message:created', 200);
  });

  it('should broadcast channel:created when a new channel is created via REST', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });

    await prisma.groupMember.createMany({
      data: [
        { groupId: group.id, userId: alice.id, role: 'OWNER' },
        { groupId: group.id, userId: bob.id, role: 'MEMBER' },
      ],
    });

    const bobClient = trackSocket(
      createTestClient(server.port, createAuthToken(bob.id)),
    );
    await waitFor(bobClient, 'connect');

    const channelCreatedPromise = waitFor<ChannelCreatedEvent>(
      bobClient,
      'channel:created',
    );

    const aliceToken = createAuthToken(alice.id);
    const res = await request(server.app)
      .post(`/api/groups/${group.id}/channels`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'deployments', topic: 'CI/CD pipeline updates' });

    expect(res.status).toBe(201);

    const event = await channelCreatedPromise;
    expect(event.groupId).toBe(group.id);
    expect(event.channel.name).toBe('deployments');
    expect(event.channel.topic).toBe('CI/CD pipeline updates');
  });

  it('should broadcast member:joined, emit group:invited, and dynamically join user sockets on invite', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });
    const channel = await prisma.channel.create({
      data: { name: 'general', groupId: group.id },
    });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: alice.id, role: 'OWNER' },
    });

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    const bobClient = trackSocket(
      createTestClient(server.port, createAuthToken(bob.id)),
    );
    await waitFor(bobClient, 'connect');

    const aliceMemberJoinedPromise = waitFor<MemberJoinedEvent>(
      aliceClient,
      'member:joined',
    );
    const bobGroupInvitedPromise = waitFor<GroupInvitedEvent>(
      bobClient,
      'group:invited',
    );

    const aliceToken = createAuthToken(alice.id);
    const res = await request(server.app)
      .post(`/api/groups/${group.id}/members`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: bob.id, role: 'MEMBER' });

    expect(res.status).toBe(201);

    const memberJoinedEvent = await aliceMemberJoinedPromise;
    expect(memberJoinedEvent.groupId).toBe(group.id);
    expect(memberJoinedEvent.member.userId).toBe(bob.id);

    const groupInvitedEvent = await bobGroupInvitedPromise;
    expect(groupInvitedEvent.group.id).toBe(group.id);

    const bobMessagePromise = waitFor<MessageCreatedEvent>(
      bobClient,
      'message:created',
    );

    await request(server.app)
      .post(`/api/channels/${channel.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Welcome Bob!' });

    const messageEvent = await bobMessagePromise;
    expect(messageEvent.message.content).toBe('Welcome Bob!');
  });

  it('should dynamically join creator active sockets into newly created group room', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    const aliceToken = createAuthToken(alice.id);
    const res = await request(server.app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Startup Incubator' });

    expect(res.status).toBe(201);
    const newGroup = res.body;

    const channelRes = await request(server.app)
      .post(`/api/groups/${newGroup.id}/channels`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'pitch-deck' });

    expect(channelRes.status).toBe(201);
    const newChannel = channelRes.body;

    const aliceMessagePromise = waitFor<MessageCreatedEvent>(
      aliceClient,
      'message:created',
    );

    await request(server.app)
      .post(`/api/channels/${newChannel.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'First message in new group' });

    const messageEvent = await aliceMessagePromise;
    expect(messageEvent.groupId).toBe(newGroup.id);
    expect(messageEvent.message.content).toBe('First message in new group');
  });

  it('should broadcast cross-channel message within group to power unread indicators', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });
    await prisma.channel.create({
      data: { name: 'general', groupId: group.id },
    });
    const channelB = await prisma.channel.create({
      data: { name: 'random', groupId: group.id },
    });

    await prisma.groupMember.createMany({
      data: [
        { groupId: group.id, userId: alice.id, role: 'OWNER' },
        { groupId: group.id, userId: bob.id, role: 'MEMBER' },
      ],
    });

    const bobClient = trackSocket(
      createTestClient(server.port, createAuthToken(bob.id)),
    );
    await waitFor(bobClient, 'connect');

    const bobCrossChannelPromise = waitFor<MessageCreatedEvent>(
      bobClient,
      'message:created',
    );

    const aliceToken = createAuthToken(alice.id);
    await request(server.app)
      .post(`/api/channels/${channelB.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Message in channel B for unread testing' });

    const event = await bobCrossChannelPromise;
    expect(event.channelId).toBe(channelB.id);
    expect(event.groupId).toBe(group.id);
    expect(event.message.content).toBe(
      'Message in channel B for unread testing',
    );
  });
});
