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

describe('Groups Integration Tests', () => {
  let alice: { id: string; name: string; email: string };
  let bob: { id: string; name: string; email: string };
  let charlie: { id: string; name: string; email: string };
  let testGroup: { id: string; name: string };

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
          create: [{ name: 'general' }],
        },
      },
    });
  });

  describe('GET /api/groups', () => {
    it('should return groups for authenticated user', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(testGroup.id);
      expect(res.body[0].name).toBe('Test Group');
      expect(res.body[0].members[0].role).toBe(MemberRole.OWNER);

      const dbMemberships = await prisma.groupMember.findMany({
        where: { userId: alice.id },
      });
      expect(dbMemberships).toHaveLength(1);
      expect(dbMemberships[0].groupId).toBe(testGroup.id);
    });

    it('should return empty array for user not in any group', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/groups');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });
  });

  describe('POST /api/groups', () => {
    it('should create group with default general channel and OWNER membership', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Engineering' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Engineering');
      expect(res.body.channels).toHaveLength(1);
      expect(res.body.channels[0].name).toBe('general');
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe(MemberRole.OWNER);

      const dbGroup = await prisma.group.findUnique({
        where: { id: res.body.id },
        include: { members: true, channels: true },
      });
      expect(dbGroup).not.toBeNull();
      expect(dbGroup?.name).toBe('Engineering');
      expect(dbGroup?.members[0].userId).toBe(alice.id);
      expect(dbGroup?.members[0].role).toBe(MemberRole.OWNER);
      expect(dbGroup?.channels[0].name).toBe('general');
    });

    it('should return 400 for empty name', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');

      const count = await prisma.group.count({
        where: { name: '' },
      });
      expect(count).toBe(0);
    });

    it('should return 400 for missing body', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/groups/:groupId', () => {
    it('should return group with user role for member', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testGroup.id);
      expect(res.body.name).toBe('Test Group');
      expect(res.body.role).toBe(MemberRole.MEMBER);
    });

    it('should return 403 for non-member', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You are not a member of this group');
    });

    it('should return 404 for non-existent groupId', async () => {
      const token = await getToken(alice.id);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/groups/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Group not found');
    });

    it('should return 400 for invalid UUID groupId', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/groups/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/groups/:groupId/members', () => {
    it('should return all members with user info', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const aliceMember = res.body.find(
        (m: { userId: string }) => m.userId === alice.id,
      );
      expect(aliceMember).toBeDefined();
      expect(aliceMember.role).toBe(MemberRole.OWNER);
      expect(aliceMember.user.name).toBe('Alice');

      const bobMember = res.body.find(
        (m: { userId: string }) => m.userId === bob.id,
      );
      expect(bobMember).toBeDefined();
      expect(bobMember.role).toBe(MemberRole.MEMBER);
      expect(bobMember.user.name).toBe('Bob');
    });

    it('should return 403 for non-member', async () => {
      const token = await getToken(charlie.id);
      const res = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You are not a member of this group');
    });
  });

  describe('POST /api/groups/:groupId/members', () => {
    it('should allow OWNER to add a member', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: charlie.id, role: 'MEMBER' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(charlie.id);
      expect(res.body.groupId).toBe(testGroup.id);
      expect(res.body.role).toBe(MemberRole.MEMBER);

      const dbMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: charlie.id,
            groupId: testGroup.id,
          },
        },
      });
      expect(dbMember).not.toBeNull();
      expect(dbMember?.role).toBe(MemberRole.MEMBER);
    });

    it('should return 403 when regular MEMBER tries to add', async () => {
      const token = await getToken(bob.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: charlie.id, role: 'MEMBER' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        'Only group owners or admins can invite new members',
      );

      const dbMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: charlie.id,
            groupId: testGroup.id,
          },
        },
      });
      expect(dbMember).toBeNull();
    });

    it('should return 409 when adding existing member', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: bob.id, role: 'MEMBER' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('User is already a member of this group');
    });

    it('should return 404 when adding non-existent user', async () => {
      const token = await getToken(alice.id);
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: nonExistentId, role: 'MEMBER' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User to invite does not exist');
    });

    it('should return 400 for invalid userId format', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .post(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'not-a-valid-uuid' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
