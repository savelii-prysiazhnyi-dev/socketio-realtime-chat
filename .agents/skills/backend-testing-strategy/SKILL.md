---
name: backend-testing-strategy
description: Testing strategy and implementation guide for backend integration tests using Vitest, Supertest, Express, and PostgreSQL Prisma.
argument-hint: [test-file-or-feature]
---

# Backend Testing Strategy with Vitest

Comprehensive guide and conventions for writing and running integration tests for the backend API using Vitest, Supertest, Express, and PostgreSQL with Prisma.

## 1. Overview & Testing Philosophy

The backend employs an integration-first testing strategy:

- **Real Database & Real Routes**: Tests run against the Express application (`buildApp()`) and a real PostgreSQL test database (`testdb`) managed through Prisma.
- **No In-Memory Mocks for DB**: Services and repositories are not stubbed or mocked with in-memory doubles. Tests validate real PostgreSQL constraints, foreign keys, transactions, and cascade deletions.
- **HTTP Layer Verification**: Requests are dispatched through `supertest`, validating full HTTP lifecycles including routing, middleware, Zod request validation, status codes, and error formatting.
- **Dual Assertion Pattern**: Tests verify both the HTTP response (status code and JSON body) and the underlying database state via direct Prisma queries (`prisma.<model>.findUnique()`).

## 2. Environment & Vitest Configuration

### Test Environment File (`backend/.env.test`)

Tests use a dedicated test database to avoid affecting development or production data:

```env
NODE_ENV=test
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/testdb?schema=public"
```

### Vitest Config (`backend/vitest.config.ts`)

Vitest is configured with sequential file execution and a global setup file:

```typescript
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
  },
});
```

Key configuration details:
- `fileParallelism: false`: Disables parallel execution across test files. Because tests share a single PostgreSQL test database, running suites sequentially prevents deadlocks and data race conditions.
- `setupFiles: ['./tests/setup.ts']`: Executes global setup before running tests.

### Database Setup Hook (`backend/tests/setup.ts`)

The setup file executes before test suites run:

```typescript
import { execSync } from 'node:child_process';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Refusing to wipe database: NODE_ENV is not "test"');
}

execSync('npx prisma migrate reset --force');
```

- Enforces that `NODE_ENV === 'test'` before wiping any database.
- Runs `prisma migrate reset --force` to apply all migrations to a clean database schema.

## 3. Test Isolation & Lifecycle

To ensure complete test isolation without re-running slow migrations before every single test:

1. **Clean state before each test**: Use `beforeEach` to delete records across all tables.
2. **Order of deletion**: Delete child records before parent records to satisfy foreign key constraints:
   - `prisma.card.deleteMany()`
   - `prisma.column.deleteMany()`
   - `prisma.board.deleteMany()`
3. **Explicit seeding**: Seed required models inside `beforeEach` or within individual `it` blocks. Never assume records from previous tests exist.

## 4. Test Structure & File Naming

- **Location**: Test files live in `backend/tests/`.
- **Naming**: `<feature>.test.ts` (e.g., `boards.test.ts`, `cards.test.ts`).
- **Organization**:
  - Outer `describe('<Feature> API Integration Tests', ...)`
  - Inner `describe('<METHOD> <route-path>', ...)`
  - Individual `it('should <expected behavior>', ...)`

## 5. Boilerplate Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import buildApp from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const app = buildApp();

describe('Feature API Integration Tests', () => {
  beforeEach(async () => {
    await prisma.card.deleteMany();
    await prisma.column.deleteMany();
    await prisma.board.deleteMany();
  });

  describe('POST /api/resource', () => {
    it('should create resource and persist in database', async () => {
      const response = await request(app)
        .post('/api/resource')
        .send({ name: 'Sample' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Sample');

      const dbRecord = await prisma.board.findUnique({
        where: { id: response.body.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.name).toBe('Sample');
    });

    it('should return 400 Bad Request when payload is invalid', async () => {
      const response = await request(app)
        .post('/api/resource')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
```

## 6. Testing Patterns

### Happy Path with Relations
When creating an aggregate or entity with relations, verify both returned structure and database persistence:

```typescript
const response = await request(app)
  .post('/api/boards')
  .send({ name: 'Development Sprint' });

expect(response.status).toBe(201);
expect(response.body.columns).toHaveLength(3);

const [todo, inProgress, done] = response.body.columns;
expect(todo.name).toBe('ToDo');
expect(todo.order).toBe(0);
expect(inProgress.name).toBe('In Progress');
expect(inProgress.order).toBe(1);
expect(done.name).toBe('Done');
expect(done.order).toBe(2);
```

### Zod Validation Failure (400)
Validate that missing, empty, or whitespace-only inputs trigger validation errors:

```typescript
const emptyRes = await request(app)
  .post('/api/boards')
  .send({ name: '' });
expect(emptyRes.status).toBe(400);
expect(emptyRes.body).toHaveProperty('error');

const whitespaceRes = await request(app)
  .post('/api/boards')
  .send({ name: '   ' });
expect(whitespaceRes.status).toBe(400);

const missingRes = await request(app)
  .post('/api/boards')
  .send({});
expect(missingRes.status).toBe(400);
```

### Resource Not Found (404)
Verify non-existent IDs return a 404 status and error message:

```typescript
const response = await request(app).get('/api/boards/non-existent-id');

expect(response.status).toBe(404);
expect(response.body.error).toBe('Board not found');
```

### Cascade Deletion
Verify that deleting a parent resource automatically cascades to child records in the database:

```typescript
const response = await request(app).delete(`/api/boards/${board.id}`);
expect(response.status).toBe(204);

const dbBoard = await prisma.board.findUnique({ where: { id: board.id } });
const dbColumn = await prisma.column.findUnique({ where: { id: columnId } });
const dbCard = await prisma.card.findUnique({ where: { id: cardId } });

expect(dbBoard).toBeNull();
expect(dbColumn).toBeNull();
expect(dbCard).toBeNull();
```

### State Transitions & Ordering
Verify repositioning logic across columns and order changes within the same column:

```typescript
const response = await request(app)
  .patch(`/api/cards/${cardId}/move`)
  .send({
    targetColumnId: targetColumn.id,
    newPosition: 0,
  });

expect(response.status).toBe(200);
expect(response.body.columnId).toBe(targetColumn.id);
expect(response.body.position).toBe(0);

const remainingSourceCards = await prisma.card.findMany({
  where: { columnId: sourceColumn.id },
  orderBy: { position: 'asc' },
});
expect(remainingSourceCards.map((c) => c.position)).toEqual([0]);
```

## 7. Execution Commands

### Environment Setup
Ensure the test environment file exists before running tests:

```bash
cd backend
cp .env.test.example .env.test
npx prisma generate
```

### Run All Tests

```bash
cd backend && npm test
```

### Run Vitest in Watch Mode

```bash
cd backend && npx vitest
```

### Run a Single Test File

```bash
cd backend && npx vitest run tests/boards.test.ts
```

### Run Tests Matching a Pattern

```bash
cd backend && npx vitest run -t "should create a board"
```

## 8. Reference Implementations

- Configuration: [backend/vitest.config.ts](file:///home/prisyaga/projects/kanban-test-task/backend/vitest.config.ts)
- Test Database Setup: [backend/tests/setup.ts](file:///home/prisyaga/projects/kanban-test-task/backend/tests/setup.ts)
- Board Integration Tests: [backend/tests/boards.test.ts](file:///home/prisyaga/projects/kanban-test-task/backend/tests/boards.test.ts)
- Card Integration Tests: [backend/tests/cards.test.ts](file:///home/prisyaga/projects/kanban-test-task/backend/tests/cards.test.ts)
- CI Workflow: [.github/workflows/backend-ci.yml](file:///home/prisyaga/projects/kanban-test-task/.github/workflows/backend-ci.yml)
