---
name: express-api-architecture
description: Guide for developing the Express API with manual Dependency Injection (DI) and Zod request validation.
---

# Express API Architecture

This project uses Express, Zod, and Prisma. The architecture follows a layered design with manual Dependency Injection (DI) and utilizes Zod for request validation.

## 1. Dependency Injection (DI)

We use manual constructor-based Dependency Injection. This avoids the overhead of complex DI libraries while keeping the code highly testable and decoupled.

- **Repositories**: Handle database interactions via Prisma. They receive the Prisma client via their constructor.
- **Services**: Contain business logic. They should be implemented as classes and receive repositories via their constructor.
- **Controllers**: Handle HTTP requests and responses. They receive services via their constructor.
- **Instantiation**: Singletons are created and exported in `index.ts` files within their respective directories.

### Example: Repositories

```typescript
// src/repositories/ticket.repository.ts
import type { PrismaClient } from '@prisma/client';

export class TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}
  
  async getTickets() {
    return this.prisma.ticket.findMany();
  }
}

// src/repositories/index.ts
import { prisma } from '../lib/prisma.js';
import { TicketRepository } from './ticket.repository.js';

export const ticketRepository = new TicketRepository(prisma);
```

### Example: Services

```typescript
// src/services/ticket.service.ts
import type { TicketRepository } from '../repositories/ticket.repository.js';

export class TicketService {
  constructor(private readonly ticketRepository: TicketRepository) {}
  
  async getTickets() {
    return this.ticketRepository.getTickets();
  }
}

// src/services/index.ts
import { ticketRepository } from '../repositories/index.js';
import { TicketService } from './ticket.service.js';

export const ticketService = new TicketService(ticketRepository);
```

### Example: Controllers

```typescript
// src/controllers/ticket.controller.ts
import type { Request, Response, NextFunction } from 'express';
import type { TicketService } from '../services/ticket.service.js';

export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await this.ticketService.getTickets();
      res.status(200).json(tickets);
    } catch (err) {
      next(err);
    }
  }
}

// src/controllers/index.ts
import { ticketService } from '../services/index.js';
import { TicketController } from './ticket.controller.js';

export const ticketController = new TicketController(ticketService);
```

## 2. Request Validation

We use a custom `validateRequest` utility to validate requests using Zod schemas. If validation fails, it throws an appropriate error, which will be caught by the Express global error handler. (Note: Express 5 natively supports throwing in async functions, or you can use `next(error)` inside a `try/catch` block).

### Example: Validation Utility

```typescript
// src/lib/validateRequest.ts
import { ZodType } from 'zod';
import type { Request } from 'express';
// Assumes you have a custom AppError class configured
import { AppError } from '../common/interfaces/error/AppError.js';

type RequestSource = 'body' | 'params' | 'query';

const validateRequest = <T extends Record<string, unknown>>(
  req: Request,
  schema: ZodType<T>,
  errorMessage: string,
  source: RequestSource = 'body',
): T => {
  const parseResult = schema.safeParse(req[source]);

  if (!parseResult.success) {
    // Construct your standard application error
    const error = new Error(errorMessage) as any;
    error.statusCode = 400;
    error.details = parseResult.error;
    throw error;
  }

  return parseResult.data;
};

export default validateRequest;
```

### Example: Schemas

```typescript
// src/common/schemas/ticket.schema.ts
import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']),
});

export const idParamsSchema = z.object({
  id: z.coerce.number().positive(),
});
```

### Example: Controllers using Validation Provider

```typescript
// src/controllers/ticket.controller.ts
import type { Request, Response, NextFunction } from 'express';
import type { TicketService } from '../services/ticket.service.js';
import validateRequest from '../lib/validateRequest.js';
import { createTicketSchema, idParamsSchema } from '../common/schemas/ticket.schema.js';

export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validateRequest(req, createTicketSchema, 'Invalid request body');
      // data is fully typed and validated!
      
      // const ticket = await this.ticketService.createTicket(data);
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validateRequest(req, idParamsSchema, 'Invalid path parameters', 'params');
      // id is successfully extracted and validated as a number
      
      // const ticket = await this.ticketService.getTicketById(id);
      res.status(200).json({ id });
    } catch (err) {
      next(err);
    }
  }
}
```

## 3. Route Definition

Routes are defined using the Express Router. We bind the controller methods directly to the route definitions.

```typescript
// src/routes/ticket.routes.ts
import { Router } from 'express';
import { ticketController } from '../controllers/index.js';

export const ticketRoutes = Router();

ticketRoutes.post(
  '/',
  ticketController.create.bind(ticketController)
);

ticketRoutes.get(
  '/:id',
  ticketController.getById.bind(ticketController)
);

// src/routes/index.ts
import { ticketRoutes } from './ticket.routes.js';

export { ticketRoutes };
```

## 4. App Initialization

In your main app file, make sure to register your routes and set up the global error handler. The error handler should always be added *after* all routes.

```typescript
// src/app.ts
import express from 'express';
import { ticketRoutes } from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js'; // Use your existing error handler

export const buildApp = () => {
  const app = express();

  app.use(express.json());

  app.use('/tickets', ticketRoutes);

  // Global error handler must be the last middleware
  app.use(errorHandler);

  return app;
};
```
