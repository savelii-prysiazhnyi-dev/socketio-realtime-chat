---
name: express-error-handling
description: Policy and guide for Express global error handling and custom HTTP error classes in service-oriented architecture.
---

# Express Error Handling Policy

This guide defines the standardized error handling strategy for our Express backend. The goal is to provide a decoupled, service-friendly architecture where business logic can dictate HTTP response codes and error details without directly coupling services to the Express `Response` object.

---

## 1. Core Principles

1. **Services Throw, Middleware Handles**: Services and repositories must never touch Express `req` or `res` objects. When business rules or validations are violated, services throw typed HTTP error classes.
2. **Centralized Response Formatting**: All error responses are formatted, sanitized, and sent by a single global error handler (`errorHandler`).
3. **Predictable JSON Error Schema**: All error responses conform to a consistent JSON structure:
   ```json
   {
     "error": "Human-readable error description",
     "details": { "field": "Additional validation or contextual info" }
   }
   ```
4. **Environment-Sensitive Safety**: Stack traces and raw error causes are hidden in production to prevent information disclosure, but included in development and testing.
5. **Structured Logging**: All 5xx server errors and unhandled exceptions are logged with structured metadata (method, path, status, error object) using Pino.

---

## 2. Error Hierarchy & Custom Error Classes

### `AppError` Interface
Located at [`src/common/interfaces/error/AppError.ts`](file:///home/prisyaga/projects/ws/server/src/common/interfaces/error/AppError.ts):

```typescript
export interface AppError extends Error {
  statusCode?: number;
  details?: Record<string, unknown>;
}
```

### Custom HTTP Error Classes
Located at [`src/common/errors/httpErrors.ts`](file:///home/prisyaga/projects/ws/server/src/common/errors/httpErrors.ts). All custom error classes extend `HttpError` and implement `AppError`:

| Class | HTTP Status | Use Case |
| :--- | :--- | :--- |
| **`BadRequestError`** | `400` | Malformed payloads, validation failures, invalid IDs |
| **`UnauthorizedError`** | `401` | Missing, expired, or invalid authentication tokens |
| **`ForbiddenError`** | `403` | Authenticated user lacks permission (e.g. not a group member) |
| **`NotFoundError`** | `404` | Resource does not exist (user, group, channel, message) |
| **`ConflictError`** | `409` | Unique constraint collision (e.g. email or channel name already taken) |
| **`InternalServerError`** | `500` | Explicit internal failures |

#### Implementation:

```typescript
import type { AppError } from '../interfaces/error/AppError.js';

export class HttpError extends Error implements AppError {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(401, message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(403, message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', details?: Record<string, unknown>) {
    super(404, message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(409, message, details);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', details?: Record<string, unknown>) {
    super(500, message, details);
    this.name = 'InternalServerError';
  }
}
```

---

## 3. How to Use Custom Errors in Services

Services throw custom errors directly. They do not need to know about HTTP status numbers; using the semantic error class communicates intent clearly:

```typescript
import { NotFoundError, ForbiddenError, ConflictError } from '../common/errors/httpErrors.js';
import type { ChannelRepository } from '../repositories/channel.repository.js';
import type { GroupRepository } from '../repositories/group.repository.js';

export class ChannelService {
  constructor(
    private readonly channelRepo: ChannelRepository,
    private readonly groupRepo: GroupRepository,
  ) {}

  async createChannel(userId: string, groupId: string, name: string) {
    // 1. Verify membership/permissions
    const isMember = await this.groupRepo.isMember(userId, groupId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this server');
    }

    // 2. Check for duplicate name
    const existing = await this.channelRepo.findByName(groupId, name);
    if (existing) {
      throw new ConflictError(`Channel '#${name}' already exists in this server`);
    }

    return this.channelRepo.create({ groupId, name });
  }

  async getChannelById(channelId: string) {
    const channel = await this.channelRepo.findById(channelId);
    if (!channel) {
      throw new NotFoundError(`Channel with ID '${channelId}' was not found`);
    }
    return channel;
  }
}
```

---

## 4. Integration with Zod Request Validation

Schema validation errors use `validateRequest` ([`src/utils/validateRequest.ts`](file:///home/prisyaga/projects/ws/server/src/utils/validateRequest.ts)). When validation fails, it throws a `BadRequestError` carrying structured Zod issue details:

```typescript
// src/utils/validateRequest.ts
import type { ZodType } from 'zod';
import type { Request } from 'express';
import { BadRequestError } from '../common/errors/httpErrors.js';

type RequestSource = 'body' | 'params' | 'query';

export const validateRequest = <T>(
  request: Request,
  schema: ZodType<T>,
  errorMessage: string,
  source: RequestSource = 'body',
): T => {
  const parseResult = schema.safeParse(request[source]);

  if (!parseResult.success) {
    throw new BadRequestError(
      errorMessage,
      parseResult.error as unknown as Record<string, unknown>,
    );
  }

  return parseResult.data;
};
```

---

## 5. Global Error Handler Middleware

Located at [`src/utils/errorHandler.ts`](file:///home/prisyaga/projects/ws/server/src/utils/errorHandler.ts), this middleware catches all thrown or forwarded errors:

```typescript
import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../common/interfaces/error/AppError.js';
import { logger } from './logger.js';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // If response has already started streaming, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const isErrorObj = typeof err === 'object' && err !== null;
  const appErr = (isErrorObj ? err : {}) as AppError;
  const statusCode = appErr.statusCode;
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle known AppError / HttpError instances
  if (typeof statusCode === 'number') {
    if (statusCode >= 500) {
      logger.error(
        {
          err,
          status: statusCode,
          method: req.method,
          path: req.path,
        },
        appErr.message || 'Internal server error',
      );

      res.status(statusCode).json({
        error: appErr.message || 'Internal server error',
        ...(appErr.details && !isProduction ? { details: appErr.details } : {}),
        cause: isProduction ? undefined : appErr.cause,
      });
      return;
    }

    // 4xx Client Errors: Do not pollute server error logs
    res.status(statusCode).json({
      error: appErr.message,
      ...(appErr.details && !isProduction ? { details: appErr.details } : {}),
      cause: isProduction ? undefined : appErr.cause,
    });
    return;
  }

  // Unhandled / native unexpected exceptions (always 500)
  logger.error(
    {
      err,
      method: req.method,
      path: req.path,
    },
    'Unhandled error',
  );

  res.status(500).json({ error: 'Internal server error' });
};
```

### Key Behaviors:
1. **`res.headersSent` Guard**: Prevents crashing if headers were already sent to the client.
2. **Log Level Distinction**: 4xx errors (client faults) return JSON without logging errors; 5xx errors log structured details with stack traces.
3. **Production Sanitization**: Detailed error objects and causes are omitted in production to prevent leaking database table names or internal structure.

---

## 6. Registration in `app.ts`

The global error handler **must be the very last middleware** registered in [`src/app.ts`](file:///home/prisyaga/projects/ws/server/src/app.ts), after all routes:

```typescript
// src/app.ts
import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { getCorsSettings } from './utils/cors.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './utils/errorHandler.js';

export const buildApp = (): Express => {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors(getCorsSettings()));
  app.use(express.json());

  // Mount API routers here
  // app.use('/api', apiRouter);

  // Global Error Handler MUST be last
  app.use(errorHandler);

  return app;
};
```

---

## 7. Express 5 Native Async Support

Because this project uses **Express 5 (`express: ^5.2.1`)**, rejected Promises in async route handlers and middleware are **automatically** passed to `errorHandler`. You do not need `try/catch` blocks in controllers solely to call `next(err)`:

```typescript
// Controller with Express 5 native async error forwarding:
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  async getChannel(req: Request, res: Response) {
    const { id } = validateRequest(req, idSchema, 'Invalid channel ID', 'params');
    const channel = await this.channelService.getChannelById(id);
    res.status(200).json(channel);
  }
}
```
If `getChannelById` throws `NotFoundError`, Express 5 automatically routes the exception straight to `errorHandler`.
