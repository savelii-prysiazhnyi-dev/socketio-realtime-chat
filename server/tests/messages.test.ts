import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import buildApp from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import { MemberRole } from '../generated/prisma/enums.js';

const app = buildApp();

const getToken = async (userId: string): Promise<string> => {
  const res = await request(app).post('/api/auth/demo-login').send({ userId });
  return res.body.token;
};

describe('Messages Integration Tests', () => {
  let alice: { id: string; name: string; email: string };
  let bob: { id: string; name: string; email: string };
  let generalChannel: { id: string; name: string; groupId: string };

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();

    alice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@test.com' },
    });

    bob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@test.com' },
    });

    const testGroup = await prisma.group.create({
      data: {
        name: 'Test Group',
        members: {
          create: [{ userId: alice.id, role: MemberRole.OWNER }],
        },
        channels: {
          create: [{ name: 'general' }],
        },
      },
      include: {
        channels: true,
      },
    });

    generalChannel = testGroup.channels[0];

    const baseTime = Date.now();
    for (let i = 0; i < 5; i++) {
      await prisma.message.create({
        data: {
          content: `Message ${i + 1}`,
          channelId: generalChannel.id,
          userId: alice.id,
          createdAt: new Date(baseTime + i * 1000),
        },
      });
    }
  });

  describe('GET /api/channels/:channelId/messages', () => {
    it('should return messages with author user info', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages).toHaveLength(5);

      const firstMsg = res.body.messages[0];
      expect(firstMsg).toHaveProperty('id');
      expect(firstMsg).toHaveProperty('content');
      expect(firstMsg).toHaveProperty('user');
      expect(firstMsg.user).toMatchObject({
        id: alice.id,
        name: 'Alice',
      });

      const count = await prisma.message.count({
        where: { channelId: generalChannel.id },
      });
      expect(count).toBe(5);
    });

    it('should respect limit parameter', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}/messages?limit=2`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.nextCursor).toBeDefined();
    });

    it('should support cursor-based pagination', async () => {
      const token = await getToken(alice.id);
      const firstPage = await request(app)
        .get(`/api/channels/${generalChannel.id}/messages?limit=2`)
        .set('Authorization', `Bearer ${token}`);

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.messages).toHaveLength(2);
      const nextCursor = firstPage.body.nextCursor;
      expect(nextCursor).toBeDefined();

      const secondPage = await request(app)
        .get(
          `/api/channels/${generalChannel.id}/messages?limit=2&cursor=${nextCursor}`,
        )
        .set('Authorization', `Bearer ${token}`);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.messages).toHaveLength(2);

      const firstPageIds = firstPage.body.messages.map(
        (m: { id: string }) => m.id,
      );
      const secondPageIds = secondPage.body.messages.map(
        (m: { id: string }) => m.id,
      );
      for (const id of secondPageIds) {
        expect(firstPageIds).not.toContain(id);
      }
    });

    it('should return 403 for non-member', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        "You are not a member of this channel's group",
      );
    });

    it('should return 404 for non-existent channel', async () => {
      const token = await getToken(alice.id);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/channels/${nonExistentId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Channel not found');
    });

    it('should return 400 for invalid channelId format', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/channels/invalid-uuid/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid cursor format', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}/messages?cursor=invalid-uuid`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get(
        `/api/channels/${generalChannel.id}/messages`,
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });
  });

  describe('POST /api/channels/:channelId/messages', () => {
    it('should create message and return it with user info', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello Vitest!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('Hello Vitest!');
      expect(res.body.channelId).toBe(generalChannel.id);
      expect(res.body.userId).toBe(alice.id);
      expect(res.body.user).toMatchObject({
        id: alice.id,
        name: 'Alice',
      });

      const dbMessage = await prisma.message.findUnique({
        where: { id: res.body.id },
      });
      expect(dbMessage).not.toBeNull();
      expect(dbMessage?.content).toBe('Hello Vitest!');
      expect(dbMessage?.userId).toBe(alice.id);
    });

    it('should return 400 for empty content', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for whitespace-only content', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '    ' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for content exceeding 4000 characters', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'a'.repeat(4001) });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for missing content field', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 403 for non-member', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Intruder message' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        "You are not a member of this channel's group",
      );

      const dbMessage = await prisma.message.findFirst({
        where: { content: 'Intruder message' },
      });
      expect(dbMessage).toBeNull();
    });

    it('should return 404 for non-existent channel', async () => {
      const token = await getToken(alice.id);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/channels/${nonExistentId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Ghost message' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Channel not found');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/channels/${generalChannel.id}/messages`)
        .send({ content: 'No auth message' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });
  });
});
