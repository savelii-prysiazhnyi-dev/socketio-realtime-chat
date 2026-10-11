import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../../src/utils/prisma.js';
import {
  createTestWsServer,
  createTestClient,
  type TestWsServer,
  waitFor,
} from './wsHelper.js';

describe('WebSocket Rate Limiting and Concurrency Controls', () => {
  let server: TestWsServer;
  const clientSockets: ClientSocket[] = [];

  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let charlie: { id: string; token: string };
  let group: { id: string };
  let channel: { id: string };

  const trackSocket = (socket: ClientSocket): ClientSocket => {
    clientSockets.push(socket);
    return socket;
  };

  beforeEach(async () => {
    const userA = await prisma.user.create({
      data: { email: `alice-${Date.now()}@test.com`, name: 'Alice' },
    });
    const userB = await prisma.user.create({
      data: { email: `bob-${Date.now()}@test.com`, name: 'Bob' },
    });
    const userC = await prisma.user.create({
      data: { email: `charlie-${Date.now()}@test.com`, name: 'Charlie' },
    });

    const createdGroup = await prisma.group.create({
      data: {
        name: 'Rate Limit Test Group',
        members: {
          create: [
            { userId: userA.id, role: 'OWNER' },
            { userId: userB.id, role: 'MEMBER' },
            { userId: userC.id, role: 'MEMBER' },
          ],
        },
        channels: {
          create: { name: 'general' },
        },
      },
      include: { channels: true },
    });

    const { generateToken } = await import('../../src/utils/jwt.js');
    alice = { id: userA.id, token: generateToken({ userId: userA.id }) };
    bob = { id: userB.id, token: generateToken({ userId: userB.id }) };
    charlie = { id: userC.id, token: generateToken({ userId: userC.id }) };
    group = { id: createdGroup.id };
    channel = { id: createdGroup.channels[0].id };
  });

  afterEach(async () => {
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    clientSockets.length = 0;

    if (server) {
      await server.close();
    }
  });

  it('should reject connection when payload exceeds maxHttpBufferSize', async () => {
    server = await createTestWsServer({ maxHttpBufferSize: 512 });

    const client = trackSocket(
      createTestClient(server.port, alice.token, {
        reconnection: false,
      }),
    );

    await waitFor(client, 'connect');
    expect(client.connected).toBe(true);

    const oversizedPayload = {
      groupId: group.id,
      extra: 'x'.repeat(1024),
    };

    client.emit('group:join', oversizedPayload);

    await waitFor(client, 'disconnect');
    expect(client.connected).toBe(false);
  });

  it('should enforce global concurrency cap when max connections reached', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: { maxGlobalConnections: 2 },
    });

    const client1 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(client1, 'connect');
    expect(client1.connected).toBe(true);

    const client2 = trackSocket(
      createTestClient(server.port, bob.token, { reconnection: false }),
    );
    await waitFor(client2, 'connect');
    expect(client2.connected).toBe(true);

    const client3 = trackSocket(
      createTestClient(server.port, charlie.token, { reconnection: false }),
    );

    const error = await waitFor<Error>(client3, 'connect_error');
    expect(error.message).toBe(
      'Server capacity reached. Please try again later.',
    );
    expect(client3.connected).toBe(false);
  });

  it('should rate limit rapid handshakes from the same IP', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: {
        maxHandshakesPerIp: 2,
        handshakeWindowMs: 5000,
      },
    });

    const client1 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(client1, 'connect');
    expect(client1.connected).toBe(true);

    const client2 = trackSocket(
      createTestClient(server.port, bob.token, { reconnection: false }),
    );
    await waitFor(client2, 'connect');
    expect(client2.connected).toBe(true);

    const client3 = trackSocket(
      createTestClient(server.port, charlie.token, { reconnection: false }),
    );
    const error = await waitFor<Error>(client3, 'connect_error');
    expect(error.message).toBe(
      'Too many connection attempts. Please try again later.',
    );
    expect(client3.connected).toBe(false);
  });

  it('should enforce maximum concurrent connections per user', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: { maxSocketsPerUser: 2 },
    });

    const tab1 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(tab1, 'connect');
    expect(tab1.connected).toBe(true);

    const tab2 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(tab2, 'connect');
    expect(tab2.connected).toBe(true);

    const tab3 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    const error = await waitFor<Error>(tab3, 'connect_error');
    expect(error.message).toBe(
      'Maximum concurrent connections per user exceeded',
    );
    expect(tab3.connected).toBe(false);

    tab1.disconnect();
    await new Promise(resolve => setTimeout(resolve, 50));

    const tab4 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(tab4, 'connect');
    expect(tab4.connected).toBe(true);
  });

  it('should enforce maximum concurrent connections per IP', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: { maxSocketsPerIp: 2 },
    });

    const client1 = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(client1, 'connect');

    const client2 = trackSocket(
      createTestClient(server.port, bob.token, { reconnection: false }),
    );
    await waitFor(client2, 'connect');

    const client3 = trackSocket(
      createTestClient(server.port, charlie.token, { reconnection: false }),
    );
    const error = await waitFor<Error>(client3, 'connect_error');
    expect(error.message).toBe(
      'Maximum concurrent connections per IP exceeded',
    );
    expect(client3.connected).toBe(false);
  });

  it('should rate limit high-frequency events and disconnect on flooding', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: {
        maxEventsPerSocket: 3,
        eventWindowMs: 2000,
        eventFloodThreshold: 8,
      },
    });

    const client = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    await waitFor(client, 'connect');

    const receivedErrors: Array<{ code: string; message: string }> = [];
    client.on('error', err => {
      receivedErrors.push(err as { code: string; message: string });
    });

    client.emit('group:leave', { groupId: group.id });
    client.emit('group:leave', { groupId: group.id });
    client.emit('group:leave', { groupId: group.id });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(receivedErrors).toHaveLength(0);

    client.emit('group:leave', { groupId: group.id });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedErrors.length).toBeGreaterThanOrEqual(1);
    expect(receivedErrors[0]).toEqual({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
    });
    expect(client.connected).toBe(true);

    for (let i = 0; i < 10; i++) {
      client.emit('group:leave', { groupId: group.id });
    }

    await waitFor(client, 'disconnect');
    expect(client.connected).toBe(false);
  });

  it('should throttle rapid typing start events to prevent room broadcast flood', async () => {
    server = await createTestWsServer({
      rateLimiterConfig: { typingThrottleMs: 500 },
    });

    const aliceSocket = trackSocket(
      createTestClient(server.port, alice.token, { reconnection: false }),
    );
    const bobSocket = trackSocket(
      createTestClient(server.port, bob.token, { reconnection: false }),
    );

    await Promise.all([
      waitFor(aliceSocket, 'connect'),
      waitFor(bobSocket, 'connect'),
    ]);

    const typingEvents: Array<{ userId: string; isTyping: boolean }> = [];
    bobSocket.on('user:typing', event => {
      typingEvents.push(event as { userId: string; isTyping: boolean });
    });

    aliceSocket.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });
    aliceSocket.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });
    aliceSocket.emit('typing:start', {
      groupId: group.id,
      channelId: channel.id,
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(typingEvents).toHaveLength(1);
    expect(typingEvents[0]).toMatchObject({
      userId: alice.id,
      isTyping: true,
    });

    aliceSocket.emit('typing:stop', {
      groupId: group.id,
      channelId: channel.id,
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(typingEvents).toHaveLength(2);
    expect(typingEvents[1]).toMatchObject({
      userId: alice.id,
      isTyping: false,
    });
  });
});
