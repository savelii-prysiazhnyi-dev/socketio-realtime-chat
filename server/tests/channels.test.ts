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

describe('Channels Integration Tests', () => {
  let alice: { id: string; name: string; email: string };
  let bob: { id: string; name: string; email: string };
  let charlie: { id: string; name: string; email: string };
  let testGroup: { id: string; name: string };
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

    charlie = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@test.com' },
    });

    testGroup = await prisma.group.create({
      data: {
        name: 'Test Group',
        members: {
          create: [
            { userId: alice.id, role: MemberRole.OWNER },
            { userId: bob.id, role: MemberRole.MEMBER },
          ],
        },
        channels: {
          create: [
            { name: 'general', topic: 'General discussion' },
            { name: 'random', topic: 'Random chatter' },
          ],
        },
      },
    });

    const channels = await prisma.channel.findMany({
      where: { groupId: testGroup.id },
      orderBy: { name: 'asc' },
    });
    generalChannel = channels.find(c => c.name === 'general')!;
  });

  describe('GET /api/groups/:groupId/channels', () => {
    it('should return all channels for group member', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const names = res.body.map((c: { name: string }) => c.name);
      expect(names).toContain('general');
      expect(names).toContain('random');

      const dbChannels = await prisma.channel.findMany({
        where: { groupId: testGroup.id },
      });
      expect(dbChannels).toHaveLength(2);
    });

    it('should return all channels for regular member', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should return 403 for non-member', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You are not a member of this group');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get(
        `/api/groups/${testGroup.id}/channels`,
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });

    it('should return 400 for invalid UUID groupId', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/groups/invalid-id/channels')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/groups/:groupId/channels', () => {
    it('should create channel when OWNER', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'announcements', topic: 'Company announcements' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('announcements');
      expect(res.body.topic).toBe('Company announcements');
      expect(res.body.groupId).toBe(testGroup.id);

      const dbChannel = await prisma.channel.findUnique({
        where: { id: res.body.id },
      });
      expect(dbChannel).not.toBeNull();
      expect(dbChannel?.name).toBe('announcements');
      expect(dbChannel?.groupId).toBe(testGroup.id);
    });

    it('should return 403 when regular MEMBER tries to create channel', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'dev-chat' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        'Only group owners or admins can create channels',
      );

      const dbChannel = await prisma.channel.findFirst({
        where: { name: 'dev-chat', groupId: testGroup.id },
      });
      expect(dbChannel).toBeNull();
    });

    it('should return 403 when non-member tries to create channel', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'charlie-chat' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        'Only group owners or admins can create channels',
      );
    });

    it('should return 409 for duplicate channel name in same group', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'general' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        "Channel '#general' already exists in this group",
      );
    });

    it('should return 400 for empty channel name', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for channel name with invalid characters', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'hello world' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for channel name exceeding 50 characters', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a'.repeat(51) });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/channels/:channelId', () => {
    it('should return channel details for group member', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(generalChannel.id);
      expect(res.body.name).toBe('general');
      expect(res.body.groupId).toBe(testGroup.id);
    });

    it('should return 403 for non-member of the group', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .get(`/api/channels/${generalChannel.id}`)
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
        .get(`/api/channels/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Channel not found');
    });

    it('should return 400 for invalid UUID channelId', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/channels/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get(`/api/channels/${generalChannel.id}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });
  });
});
