import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
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

interface TypingEvent {
  groupId: string;
  channelId: string;
  userId: string;
  isTyping: boolean;
}

describe('WebSocket Typing Indicators Tests', () => {
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

  it('should relay typing:start to other room members with isTyping true', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Dev Team' },
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

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    const bobTypingPromise = waitFor<TypingEvent>(bobClient, 'user:typing');

    aliceClient.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });

    const event = await bobTypingPromise;
    expect(event).toEqual({
      groupId: group.id,
      channelId: channel.id,
      userId: alice.id,
      isTyping: true,
    });
  });

  it('should exclude the typing sender from receiving user:typing', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Dev Team' },
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

    aliceClient.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });

    await waitForEventOmission(aliceClient, 'user:typing', 200);
  });

  it('should relay typing:stop with isTyping false', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Dev Team' },
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

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    const bobTypingPromise = waitFor<TypingEvent>(bobClient, 'user:typing');

    aliceClient.emit('typing:stop', {
      groupId: group.id,
      channelId: channel.id,
    });

    const event = await bobTypingPromise;
    expect(event).toEqual({
      groupId: group.id,
      channelId: channel.id,
      userId: alice.id,
      isTyping: false,
    });
  });

  it('should silently discard typing events when sender is not in the group room', async () => {
    const charlie = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Private Team' },
    });
    const channel = await prisma.channel.create({
      data: { name: 'general', groupId: group.id },
    });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: bob.id, role: 'MEMBER' },
    });

    const bobClient = trackSocket(
      createTestClient(server.port, createAuthToken(bob.id)),
    );
    await waitFor(bobClient, 'connect');

    const charlieClient = trackSocket(
      createTestClient(server.port, createAuthToken(charlie.id)),
    );
    await waitFor(charlieClient, 'connect');

    charlieClient.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });

    await waitForEventOmission(bobClient, 'user:typing', 200);
  });

  it('should safely drop malformed typing payloads without throwing', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Dev Team' },
    });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: alice.id, role: 'OWNER' },
    });

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    aliceClient.emit('typing:start', { groupId: group.id });
    aliceClient.emit('typing:start', { channelId: 'not-uuid' });
    aliceClient.emit('typing:start', 'string');
    aliceClient.emit('typing:start', null);
    aliceClient.emit('typing:stop', {});

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(aliceClient.connected).toBe(true);
  });

  it('should not leak typing indicators across isolated groups', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const dave = await prisma.user.create({
      data: { name: 'Dave', email: 'dave@test.com' },
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
      data: { groupId: group2.id, userId: dave.id, role: 'OWNER' },
    });

    const daveClient = trackSocket(
      createTestClient(server.port, createAuthToken(dave.id)),
    );
    await waitFor(daveClient, 'connect');

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    aliceClient.emit('typing:start', {
      groupId: group1.id,
      channelId: channel1.id,
    });

    await waitForEventOmission(daveClient, 'user:typing', 200);
  });

  it('should handle rapid consecutive typing events without degradation', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Dev Team' },
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

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    for (let i = 0; i < 25; i++) {
      aliceClient.emit('typing:start', {
        groupId: group.id,
        channelId: channel.id,
      });
      aliceClient.emit('typing:stop', {
        groupId: group.id,
        channelId: channel.id,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(aliceClient.connected).toBe(true);
    expect(bobClient.connected).toBe(true);
  });
});
