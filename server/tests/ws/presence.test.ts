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
import { presenceService } from '../../src/services/presence.service.js';
import {
  createTestWsServer,
  createTestClient,
  waitFor,
  waitForEventOmission,
  createAuthToken,
  type TestWsServer,
} from './wsHelper.js';

interface PresenceEvent {
  userId: string;
  status: 'ONLINE' | 'OFFLINE';
}

describe('WebSocket Presence Integration Tests', () => {
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
    presenceService.clear();
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

  it('should broadcast ONLINE to group members when a user connects for the first time', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Shared Team' },
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

    const bobPresencePromise = waitFor<PresenceEvent>(
      bobClient,
      'user:presence',
    );

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    const presenceEvent = await bobPresencePromise;
    expect(presenceEvent).toEqual({
      userId: alice.id,
      status: 'ONLINE',
    });
    expect(presenceService.isOnline(alice.id)).toBe(true);
  });

  it('should exclude the connecting sender from receiving their own ONLINE broadcast', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Shared Team' },
    });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: alice.id, role: 'OWNER' },
    });

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    await waitForEventOmission(aliceClient, 'user:presence', 200);
  });

  it('should not emit duplicate ONLINE broadcast when user opens a second tab', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Shared Team' },
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

    const aliceTab1 = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(bobClient, 'user:presence');
    await waitFor(aliceTab1, 'connect');

    const aliceTab2 = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceTab2, 'connect');

    await waitForEventOmission(bobClient, 'user:presence', 200);
  });

  it('should not broadcast OFFLINE when closing one tab of a multi-tab session', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Shared Team' },
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

    const aliceTab1 = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceTab1, 'connect');

    const aliceTab2 = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceTab2, 'connect');

    aliceTab1.disconnect();

    await waitForEventOmission(bobClient, 'user:presence', 200);
    expect(presenceService.isOnline(alice.id)).toBe(true);
  });

  it('should broadcast OFFLINE when the final tab disconnects', async () => {
    const alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Shared Team' },
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
    await waitFor(bobClient, 'user:presence');

    const bobOfflinePromise = waitFor<PresenceEvent>(
      bobClient,
      'user:presence',
    );
    aliceClient.disconnect();

    const offlineEvent = await bobOfflinePromise;
    expect(offlineEvent).toEqual({
      userId: alice.id,
      status: 'OFFLINE',
    });
    expect(presenceService.isOnline(alice.id)).toBe(false);
  });

  it('should not leak presence events across isolated groups', async () => {
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

    const aliceClient = trackSocket(
      createTestClient(server.port, createAuthToken(alice.id)),
    );
    await waitFor(aliceClient, 'connect');

    await waitForEventOmission(charlieClient, 'user:presence', 200);

    aliceClient.disconnect();
    await waitForEventOmission(charlieClient, 'user:presence', 200);
  });
});
