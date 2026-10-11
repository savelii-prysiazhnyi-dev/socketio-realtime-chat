import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import jwt from 'jsonwebtoken';
import { type Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../../src/utils/prisma.js';
import { getJwtSecret } from '../../src/utils/jwt.js';
import {
  createTestWsServer,
  createTestClient,
  waitFor,
  createAuthToken,
  type TestWsServer,
} from './wsHelper.js';

describe('WebSocket Connection & Authentication Tests', () => {
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

  it('should successfully authenticate and auto-join user and group rooms', async () => {
    const user = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@example.com' },
    });
    const group1 = await prisma.group.create({
      data: { name: 'Workspace One' },
    });
    const group2 = await prisma.group.create({
      data: { name: 'Workspace Two' },
    });

    await prisma.groupMember.createMany({
      data: [
        { groupId: group1.id, userId: user.id, role: 'OWNER' },
        { groupId: group2.id, userId: user.id, role: 'MEMBER' },
      ],
    });

    const token = createAuthToken(user.id);
    const client = trackSocket(createTestClient(server.port, token));

    await waitFor(client, 'connect');
    expect(client.connected).toBe(true);

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket).toBeDefined();
    expect(serverSocket?.data.userId).toBe(user.id);
    expect(serverSocket?.rooms.has(`user:${user.id}`)).toBe(true);
    expect(serverSocket?.rooms.has(`group:${group1.id}`)).toBe(true);
    expect(serverSocket?.rooms.has(`group:${group2.id}`)).toBe(true);
  });

  it('should authenticate with Bearer prefix in extraHeaders authorization', async () => {
    const user = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@example.com' },
    });
    const token = createAuthToken(user.id);

    const client = trackSocket(
      createTestClient(server.port, undefined, {
        extraHeaders: {
          authorization: `Bearer ${token}`,
        },
      }),
    );

    await waitFor(client, 'connect');
    expect(client.connected).toBe(true);

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket?.data.userId).toBe(user.id);
    expect(serverSocket?.rooms.has(`user:${user.id}`)).toBe(true);
  });

  it('should reject handshake when token is missing', async () => {
    const client = trackSocket(createTestClient(server.port));

    const err = await waitFor<Error>(client, 'connect_error');
    expect(client.connected).toBe(false);
    expect(err.message).toBe('Missing authentication token');
  });

  it('should reject handshake when token is empty or whitespace', async () => {
    const client = trackSocket(createTestClient(server.port, '   '));

    const err = await waitFor<Error>(client, 'connect_error');
    expect(client.connected).toBe(false);
    expect(err.message).toBe('Authentication token cannot be empty');
  });

  it('should reject handshake when token is malformed', async () => {
    const client = trackSocket(
      createTestClient(server.port, 'invalid.tampered.token'),
    );

    const err = await waitFor<Error>(client, 'connect_error');
    expect(client.connected).toBe(false);
    expect(err.message).toBe('Invalid or expired authentication token');
  });

  it('should reject handshake when token is expired', async () => {
    const user = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@example.com' },
    });
    const secret = getJwtSecret();
    const expiredToken = jwt.sign({ userId: user.id }, secret, {
      expiresIn: '-1s',
    });

    const client = trackSocket(createTestClient(server.port, expiredToken));

    const err = await waitFor<Error>(client, 'connect_error');
    expect(client.connected).toBe(false);
    expect(err.message).toBe('Invalid or expired authentication token');
  });

  it('should connect cleanly when user has no group memberships', async () => {
    const user = await prisma.user.create({
      data: { name: 'Solo', email: 'solo@example.com' },
    });
    const token = createAuthToken(user.id);

    const client = trackSocket(createTestClient(server.port, token));
    await waitFor(client, 'connect');

    const serverSocket = server.io.sockets.sockets.get(client.id!);
    expect(serverSocket).toBeDefined();
    expect(serverSocket?.rooms.has(`user:${user.id}`)).toBe(true);
    expect(serverSocket?.data.userGroupIds?.size).toBe(0);
  });
});
