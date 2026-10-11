import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import buildApp from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';

const app = buildApp();

const getToken = async (userId: string): Promise<string> => {
  const res = await request(app).post('/api/auth/demo-login').send({ userId });
  return res.body.token;
};

describe('Auth & Users Integration Tests', () => {
  let alice: { id: string; name: string; email: string };

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();

    alice = await prisma.user.create({
      data: {
        name: 'Alice',
        email: 'alice@test.com',
      },
    });

    await prisma.user.create({
      data: {
        name: 'Bob',
        email: 'bob@test.com',
      },
    });
  });

  describe('GET /api/users', () => {
    it('should return all seeded users', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const dbUsers = await prisma.user.findMany({
        orderBy: { name: 'asc' },
      });
      expect(dbUsers).toHaveLength(2);
      expect(res.body[0].id).toBe(dbUsers[0].id);
      expect(res.body[1].id).toBe(dbUsers[1].id);
    });

    it('should include id, name, email, avatar fields', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      const user = res.body.find((u: { id: string }) => u.id === alice.id);
      expect(user).toBeDefined();
      expect(user).toHaveProperty('id', alice.id);
      expect(user).toHaveProperty('name', alice.name);
      expect(user).toHaveProperty('email', alice.email);
      expect(user).toHaveProperty('avatar', null);

      const dbUser = await prisma.user.findUnique({
        where: { id: alice.id },
      });
      expect(dbUser).not.toBeNull();
      expect(user.id).toBe(dbUser?.id);
      expect(user.name).toBe(dbUser?.name);
      expect(user.email).toBe(dbUser?.email);
      expect(user.avatar).toBe(dbUser?.avatar);
    });
  });

  describe('POST /api/auth/demo-login', () => {
    it('should return token and user for valid userId', async () => {
      const res = await request(app)
        .post('/api/auth/demo-login')
        .send({ userId: alice.id });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toMatchObject({
        id: alice.id,
        name: 'Alice',
        email: 'alice@test.com',
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: alice.id },
      });
      expect(dbUser).not.toBeNull();
      expect(res.body.user.id).toBe(dbUser?.id);
      expect(res.body.user.email).toBe(dbUser?.email);
    });

    it('should return 404 for non-existent userId', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post('/api/auth/demo-login')
        .send({ userId: nonExistentId });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');

      const dbUser = await prisma.user.findUnique({
        where: { id: nonExistentId },
      });
      expect(dbUser).toBeNull();
    });

    it('should return 400 for missing userId', async () => {
      const res = await request(app).post('/api/auth/demo-login').send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');

      const userCount = await prisma.user.count();
      expect(userCount).toBe(2);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app)
        .post('/api/auth/demo-login')
        .send({ userId: 'not-a-valid-uuid' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');

      const userCount = await prisma.user.count();
      expect(userCount).toBe(2);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user profile', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: alice.id,
        name: 'Alice',
        email: 'alice@test.com',
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: alice.id },
      });
      expect(dbUser).not.toBeNull();
      expect(res.body.id).toBe(dbUser?.id);
      expect(res.body.email).toBe(dbUser?.email);
    });

    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired authentication token');
    });

    it('should return 401 with malformed Authorization header (no Bearer prefix)', async () => {
      const token = await getToken(alice.id);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing or malformed Authorization header');
    });
  });
});
