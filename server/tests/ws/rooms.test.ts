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

interface SocketError {
  message: string;
}

interface TestMessageEvent {
  text: string;
}

describe('WebSocket Room Management Tests', () => {
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

  it('should join group room when authorized and receive subsequent broadcasts', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket?.rooms.has(`group:${group.id}`)).toBe(false);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER' },
    });

    client.emit('group:join', { groupId: group.id });

    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (serverSocket?.rooms.has(`group:${group.id}`)) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(serverSocket?.rooms.has(`group:${group.id}`)).toBe(true);
    expect(serverSocket?.data.userGroupIds?.has(group.id)).toBe(true);

    const messagePromise = waitFor<TestMessageEvent>(client, 'custom:test');
    server.io.to(`group:${group.id}`).emit('custom:test', { text: 'hello' });
    const received = await messagePromise;
    expect(received.text).toBe('hello');
  });

  it('should reject unauthorized group:join and emit error', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const privateGroup = await prisma.group.create({
      data: { name: 'Secret Executives' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    const errorPromise = waitFor<SocketError>(client, 'error');
    client.emit('group:join', { groupId: privateGroup.id });

    const err = await errorPromise;
    expect(err.message).toBe('Unauthorized or group not found');

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket?.rooms.has(`group:${privateGroup.id}`)).toBe(false);
  });

  it('should reject group:join with non-existent group UUID', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    const errorPromise = waitFor<SocketError>(client, 'error');
    client.emit('group:join', {
      groupId: '00000000-0000-0000-0000-000000000000',
    });

    const err = await errorPromise;
    expect(err.message).toBe('Unauthorized or group not found');
  });

  it('should reject malformed payloads in group:join', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    const errorPromise1 = waitFor<SocketError>(client, 'error');
    client.emit('group:join', { groupId: 'not-a-uuid' });
    const err1 = await errorPromise1;
    expect(err1.message).toBe('Invalid group:join payload');

    const errorPromise2 = waitFor<SocketError>(client, 'error');
    client.emit('group:join', {});
    const err2 = await errorPromise2;
    expect(err2.message).toBe('Invalid group:join payload');
  });

  it('should leave group room and cease receiving broadcasts', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });
    const group = await prisma.group.create({
      data: { name: 'Engineering' },
    });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'MEMBER' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket?.rooms.has(`group:${group.id}`)).toBe(true);

    client.emit('group:leave', { groupId: group.id });

    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (!serverSocket?.rooms.has(`group:${group.id}`)) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(serverSocket?.rooms.has(`group:${group.id}`)).toBe(false);
    expect(serverSocket?.data.userGroupIds?.has(group.id)).toBe(false);

    server.io
      .to(`group:${group.id}`)
      .emit('custom:test', { text: 'after-leave' });
    await waitForEventOmission(client, 'custom:test', 200);
  });

  it('should handle malformed group:leave cleanly without throwing', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    client.emit('group:leave', { groupId: 'invalid' });
    client.emit('group:leave', null);
    client.emit('group:leave', {});

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(client.connected).toBe(true);
  });

  it('should safely handle group:leave for a room not joined', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    const client = trackSocket(
      createTestClient(server.port, createAuthToken(user.id)),
    );
    await waitFor(client, 'connect');

    client.emit('group:leave', {
      groupId: '11111111-1111-1111-1111-111111111111',
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(client.connected).toBe(true);
  });
});
