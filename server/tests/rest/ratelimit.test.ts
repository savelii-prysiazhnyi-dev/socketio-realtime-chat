import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import buildApp from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';
import { generateToken } from '../../src/utils/jwt.js';

const app = buildApp();

describe('REST API Rate Limiting Integration Tests', () => {
  let user: { id: string };
  let authToken: string;

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();

    user = await prisma.user.create({
      data: {
        name: 'Rate Limit Test User',
        email: `ratelimit-${Date.now()}@test.com`,
      },
    });

    authToken = generateToken({ userId: user.id });
  });

  describe('Strict Auth Rate Limiting (/api/auth/*)', () => {
    it('should return HTTP 429 after exceeding 15 requests within 15 minutes to /api/auth/login', async () => {
      const clientIp = '198.51.100.10';

      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', clientIp)
          .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).not.toBe(429);
        expect(res.headers['ratelimit-limit']).toBe('15');
        expect(res.headers['ratelimit-remaining']).toBe(String(14 - i));
        expect(res.headers).toHaveProperty('ratelimit-reset');
      }

      const blockedRes = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', clientIp)
        .send({ email: 'test@example.com', password: 'password123' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: 'Too many requests from this IP, please try again later.',
      });
      expect(blockedRes.headers['ratelimit-limit']).toBe('15');
      expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
      expect(blockedRes.headers).toHaveProperty('ratelimit-reset');
      expect(blockedRes.headers).toHaveProperty('retry-after');
    });

    it('should return HTTP 429 after exceeding 15 requests to /api/auth/demo-login', async () => {
      const clientIp = '198.51.100.11';

      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/auth/demo-login')
          .set('X-Forwarded-For', clientIp)
          .send({ userId: user.id });

        expect(res.status).toBe(200);
      }

      const blockedRes = await request(app)
        .post('/api/auth/demo-login')
        .set('X-Forwarded-For', clientIp)
        .send({ userId: user.id });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: 'Too many requests from this IP, please try again later.',
      });
      expect(blockedRes.headers['ratelimit-limit']).toBe('15');
    });
  });

  describe('User Creation Rate Limiting (POST /api/users)', () => {
    it('should return HTTP 429 after exceeding 10 requests within 15 minutes to POST /api/users', async () => {
      const clientIp = '198.51.100.20';

      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/users')
          .set('X-Forwarded-For', clientIp)
          .send({ name: 'Spam User', email: 'spam@example.com' });

        expect(res.status).not.toBe(429);
        expect(res.headers['ratelimit-limit']).toBe('10');
        expect(res.headers['ratelimit-remaining']).toBe(String(9 - i));
      }

      const blockedRes = await request(app)
        .post('/api/users')
        .set('X-Forwarded-For', clientIp)
        .send({ name: 'Spam User', email: 'spam@example.com' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: 'Too many requests from this IP, please try again later.',
      });
      expect(blockedRes.headers['ratelimit-limit']).toBe('10');
      expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
      expect(blockedRes.headers).toHaveProperty('retry-after');
    });
  });

  describe('General API Rate Limiting (/api/*)', () => {
    it('should return HTTP 429 after exceeding 100 requests to /api/groups', async () => {
      const clientIp = '198.51.100.30';

      for (let i = 0; i < 100; i++) {
        const res = await request(app)
          .get('/api/groups')
          .set('X-Forwarded-For', clientIp)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-limit']).toBe('100');
        expect(res.headers['ratelimit-remaining']).toBe(String(99 - i));
      }

      const blockedRes = await request(app)
        .get('/api/groups')
        .set('X-Forwarded-For', clientIp)
        .set('Authorization', `Bearer ${authToken}`);

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: 'Too many requests from this IP, please try again later.',
      });
      expect(blockedRes.headers['ratelimit-limit']).toBe('100');
      expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
      expect(blockedRes.headers).toHaveProperty('ratelimit-reset');
      expect(blockedRes.headers).toHaveProperty('retry-after');
    });
  });

  describe('IP Isolation and Whitelist Behaviors', () => {
    it('should isolate rate limits across different IP addresses', async () => {
      const clientIpA = '198.51.100.41';
      const clientIpB = '198.51.100.42';

      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/auth/demo-login')
          .set('X-Forwarded-For', clientIpA)
          .send({ userId: user.id });
      }

      const blockedA = await request(app)
        .post('/api/auth/demo-login')
        .set('X-Forwarded-For', clientIpA)
        .send({ userId: user.id });
      expect(blockedA.status).toBe(429);

      const allowedB = await request(app)
        .post('/api/auth/demo-login')
        .set('X-Forwarded-For', clientIpB)
        .send({ userId: user.id });
      expect(allowedB.status).toBe(200);
    });

    it('should not rate limit the health check endpoint /health', async () => {
      const clientIp = '198.51.100.50';

      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/groups')
          .set('X-Forwarded-For', clientIp)
          .set('Authorization', `Bearer ${authToken}`);
      }

      const apiBlocked = await request(app)
        .get('/api/groups')
        .set('X-Forwarded-For', clientIp)
        .set('Authorization', `Bearer ${authToken}`);
      expect(apiBlocked.status).toBe(429);

      const healthRes = await request(app)
        .get('/health')
        .set('X-Forwarded-For', clientIp);
      expect(healthRes.status).toBe(200);
      expect(healthRes.body).toEqual({ status: 'ok' });
    });
  });
});
