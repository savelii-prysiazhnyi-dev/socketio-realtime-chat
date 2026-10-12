# Real-Time Chat & Workspace Collaboration Platform

A full-stack, real-time messaging application designed for team collaboration. Built with a decoupled monorepo architecture featuring an Express and Socket.io backend paired with a high-performance React 19 frontend powered by Vite, Tailwind CSS v4, Zustand, and TanStack React Query.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Monorepo Directory Layout](#monorepo-directory-layout)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Database Setup & Seeding](#2-database-setup--seeding)
  - [3. Start Development Servers](#3-start-development-servers)
- [Production Docker Deployment](#production-docker-deployment)
- [API & Event Specifications](#api--event-specifications)
  - [REST API Endpoints](#rest-api-endpoints)
  - [WebSocket Events](#websocket-events)
  - [Rate Limiting Policies](#rate-limiting-policies)
- [Scripts & Quality Verification](#scripts--quality-verification)
- [Security & Authentication](#security--authentication)

---

## Features

- **Workspaces & Groups**: Multi-tenant workspace structure supporting role-based access control (`OWNER`, `ADMIN`, `MEMBER`), invitations, and membership tracking.
- **Channels**: Group-scoped channels with topics, unread channel indicators, and dedicated real-time rooms.
- **Real-Time Messaging**: Instant message delivery across all connected workspace members powered by Socket.io, backed by cursor-based pagination for history browsing.
- **Typing Indicators**: Ephemeral typing feedback across channels with automatic inactivity expiration and client-side debouncing.
- **Live User Presence**: Multi-device socket presence tracking (`ONLINE` / `OFFLINE`) with state synchronization upon connection.
- **Tiered Rate Limiting**: Defense-in-depth protection covering both HTTP endpoints (strict auth, user creation, and general API tiers) and WebSocket connections (handshake throttling, per-socket event limits, and typing throttles).
- **In-Memory Session Security**: Stateless JWT authentication with in-memory token storage to eliminate local storage vulnerabilities.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (Vite)                         │
│  React 19  │  TanStack Query v5  │  Zustand v5  │  Tailwind │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTP Requests                │ Socket.io
               │ (Axios + In-Memory Token)    │ (JWT Auth)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Server (Node.js)                      │
│  Express 5   │  Socket.io Gateway   │   Prisma ORM (SQLite) │
│  Rate Limit  │  Presence Manager    │   Zod Validation      │
└─────────────────────────────────────────────────────────────┘
```

The system employs a layered service-oriented architecture:
1. **Controllers & Routes**: Handle incoming HTTP requests, apply tier-specific rate limiting, validate inputs via Zod schemas, and delegate business logic to services.
2. **Services & Repositories**: Encapsulate transactional logic and Prisma database operations using SQLite (`better-sqlite3`).
3. **WebSocket Gateway**: Authenticates incoming sockets via JWT handshake query/auth parameters, manages multi-socket presence tracking per user, and routes real-time broadcasts.
4. **Reactive Client Cache**: TanStack React Query manages server state and cursor-paginated message buffers, while Zustand manages real-time socket connections, presence sets, unread message notifications, and active channels.

---

## Monorepo Directory Layout

```
.
├── client/                     # Frontend Single Page Application
│   ├── src/
│   │   ├── api/                # Axios API service clients
│   │   ├── components/         # React components (layout, chat, auth, modals)
│   │   ├── context/            # AuthContext and in-memory session providers
│   │   ├── hooks/              # Custom React Query and application hooks
│   │   ├── lib/                # Axios client configuration and token getters
│   │   ├── stores/             # Zustand stores (useSocketStore)
│   │   └── types/              # Shared TypeScript definitions
│   ├── Dockerfile              # Multi-stage production Docker build (Vite + Nginx)
│   ├── .dockerignore
│   ├── nginx.conf              # Production Nginx reverse-proxy and SPA routing
│   ├── package.json
│   └── vite.config.ts
├── server/                     # Backend API & WebSocket Server
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma database schema definition
│   │   ├── migrations/         # Database migration history
│   │   └── seed.ts             # Development demo database seed script
│   ├── src/
│   │   ├── common/             # HTTP error classes and Zod validation schemas
│   │   ├── controllers/        # Express route controllers
│   │   ├── middlewares/        # Auth, error handling, and rate limiting middlewares
│   │   ├── repositories/       # Prisma database access layer
│   │   ├── routes/             # Express API route declarations
│   │   ├── services/           # Core domain and presence logic
│   │   ├── utils/              # JWT utilities, logging, request validation helpers
│   │   ├── ws/                 # Socket.io handlers, rate limiter, and event emitters
│   │   ├── app.ts              # Express application factory
│   │   └── server.ts           # HTTP and Socket.io server bootstrap entry point
│   ├── tests/
│   │   ├── rest/               # Integration tests for REST API routes
│   │   └── ws/                 # Integration tests for WebSocket gateway
│   ├── Dockerfile              # Multi-stage production Docker build (Node 22 slim)
│   ├── .dockerignore
│   └── package.json
├── docs/                       # Technical architecture & design documentation
│   ├── frontend-ui.md
│   ├── rate-limiting-specification.md
│   ├── websocket-architecture.md
│   ├── websocket-code-snippets.md
│   └── websocket-testing-specification.md
├── docker-compose.yml          # Production multi-container orchestration
└── AGENTS.md                   # Repository engineering and quality rules
```

---

## Prerequisites

- **Node.js**: `v20.18.0` or higher (Node `v22.x` recommended)
- **pnpm**: `v9.x` or higher (project defaults to `pnpm@12.9.1`)
- **SQLite3 / C++ Build Tools**: Required by `better-sqlite3` native bindings

---

## Environment Configuration

Both the server and client utilize `.env` files for runtime configuration. You **must** copy the example environment files to `.env` before running locally or with Docker:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Server (`server/.env`)

Copy the example file:
```bash
cp server/.env.example server/.env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP and WebSocket server port |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |
| `LOG_LEVEL` | `info` | Logging granularity (`trace`, `debug`, `info`, `warn`, `error`) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin (set to client URL in production) |
| `DATABASE_URL` | `"file:./dev.db"` | SQLite database file location |
| `JWT_SECRET` | `dev-chat-jwt-secret-key-32chars!!` | Secret key for signing and verifying JWT tokens (>= 32 chars) |
| `WS_MAX_PAYLOAD_BYTES` | `32768` | Maximum permissible WebSocket frame payload size (bytes) |

### Client (`client/.env`)

Copy the example file:
```bash
cp client/.env.example client/.env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the backend API and Socket.io server |

---

## Getting Started

### 1. Install Dependencies

Install dependencies for both projects:

```bash
# Install server dependencies
pnpm --dir server install

# Install client dependencies
pnpm --dir client install
```

### 2. Database Setup & Seeding

Run database migrations to generate the SQLite database and seed initial test fixtures (demo users, sample workspaces, channels, and messages):

```bash
# Apply existing migrations from prisma/migrations/
pnpm --dir server exec prisma migrate deploy

# Seed development users and workspaces
pnpm --dir server run seed
```

Default seeded demo accounts include:
- `alice@example.com` (Alice Johnson)
- `bob@example.com` (Bob Smith)
- `charlie@example.com` (Charlie Davis)
- `david@example.com` (David Wilson)
- `eva@example.com` (Eva Brown)

### 3. Start Development Servers

Run the backend and frontend servers in separate terminals:

```bash
# Terminal 1: Backend Server (runs on http://localhost:3000 with hot reload)
pnpm --dir server run dev

# Terminal 2: Frontend Client (runs on http://localhost:5173 with Vite HMR)
pnpm --dir client run dev
```

Visit `http://localhost:5173` to open the application.

---

## Production Docker Deployment

The application features a production-ready, multi-stage Docker configuration:

- **Server**: Minimal `node:22-slim` base with cached pnpm store, compiled TypeScript assets, automated Prisma migration deployment (`prisma migrate deploy`), persistent SQLite storage volume (`server_data:/app/data`), non-root `node` execution user, and graceful shutdown handling.
- **Client**: Multi-stage Vite production compilation served by an ultra-lightweight `nginx:alpine` image with gzip compression, immutable asset caching, and SPA fallback routing.
- **Orchestration**: `docker-compose.yml` connects the services together on an isolated bridge network with container names and persistent volume mounts.

### Running with Docker Compose

1. **Configure Environment Files (Mandatory Prerequisite)**:
   Docker Compose expects both `./server/.env` and `./client/.env` to exist. Copy both example files before starting containers:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

2. **Build and Start Containers**:
   ```bash
   docker compose up --build -d
   ```
   *Note: On initial boot with a fresh volume, the server automatically deploys database migrations and seeds initial demo personas (Alice, Bob, Charlie, etc.). On subsequent restarts, existing data is preserved.*

3. **Verify Status & Logs**:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

4. **Access Applications**:
   - Frontend Client: `http://localhost:5173`
   - Backend API & WebSockets: `http://localhost:3000`

5. **Stop Containers**:
   ```bash
   docker compose down
   ```

---

## API & Event Specifications

### REST API Endpoints

All authenticated routes require a `Bearer <token>` in the `Authorization` header.

#### Authentication & Users
- `POST /api/auth/demo-login`: Authenticate as a demo user (`{ userId }`) and receive a signed JWT token.
- `GET /api/auth/me`: Retrieve profile details of the currently authenticated user.
- `POST /api/auth/logout`: Invalidate client session.
- `GET /api/users`: Fetch list of all registered users.
- `POST /api/users`: Register a new user profile (`{ email, name, avatar? }`).

#### Workspaces (Groups)
- `GET /api/groups`: List all workspaces the current user belongs to.
- `POST /api/groups`: Create a new workspace (`{ name, icon? }`). Automatically provisions a `#general` channel.
- `GET /api/groups/:groupId`: Retrieve workspace details and the user's role.
- `GET /api/groups/:groupId/members`: List all members in the workspace.
- `POST /api/groups/:groupId/members`: Invite a user to the workspace (`{ userId, role? }`).

#### Channels
- `GET /api/groups/:groupId/channels`: List all channels in a workspace.
- `POST /api/groups/:groupId/channels`: Create a channel (`{ name, topic? }`). Requires `OWNER` or `ADMIN` role.
- `GET /api/channels/:channelId`: Retrieve channel details.

#### Messages
- `GET /api/channels/:channelId/messages`: Fetch cursor-paginated messages (`?limit=50&cursor=<messageId>`).
- `POST /api/channels/:channelId/messages`: Post a new message (`{ content }`). Triggers real-time broadcast.

---

### WebSocket Events

Connect to the Socket.io server with authentication:
```javascript
const socket = io("http://localhost:3000", {
  auth: { token: "<JWT_TOKEN>" }
});
```

#### Client to Server
| Event | Payload | Description |
| :--- | :--- | :--- |
| `group:join` | `{ groupId: string }` | Join the real-time room for a workspace group |
| `group:leave` | `{ groupId: string }` | Leave the real-time room for a workspace group |
| `typing:start` | `{ groupId: string, channelId: string }` | Notify channel members that the user has started typing |
| `typing:stop` | `{ groupId: string, channelId: string }` | Notify channel members that the user has stopped typing |

#### Server to Client
| Event | Payload | Description |
| :--- | :--- | :--- |
| `presence:sync` | `{ userIds: string[] }` | Initial list of currently online users sent upon connection |
| `user:presence` | `{ userId: string, status: 'ONLINE' \| 'OFFLINE' }` | Emitted when a user connects their first or disconnects their last socket |
| `message:created` | `{ channelId: string, groupId: string, message: Message }` | Broadcast when a new message is posted |
| `user:typing` | `{ channelId: string, userId: string, isTyping: boolean }` | Emitted to broadcast typing indicators in a channel |
| `channel:created`| `{ groupId: string, channel: Channel }` | Broadcast when an administrator creates a channel |
| `member:joined` | `{ groupId: string, member: GroupMember }` | Broadcast when a user joins or is added to a workspace |
| `group:invited` | `{ group: Group }` | Emitted directly to an invited user to update their workspace list |

---

### Rate Limiting Policies

The server enforces multi-layer protection against brute force attacks and denial of service:

#### REST API Limiting (`express-rate-limit`)
- **Strict Auth Limiter**: `15 requests / 15 minutes` on `/api/auth/*`
- **User Creation Limiter**: `10 requests / 15 minutes` on `POST /api/users`
- **General API Limiter**: `100 requests / 1 minute` on all `/api/*` endpoints
- **Standard Headers**: Emits `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` (Draft-6 standard).

#### WebSocket Gateway Limiting
- **Handshake Limit**: Maximum 30 connection handshakes per IP within a 10-second window.
- **Concurrent Connections**: Maximum 5 sockets per authenticated user; maximum 30 sockets per IP.
- **Event Flood Protection**: Maximum 30 events per second per socket; disconnection upon exceeding 90 events/sec.
- **Typing Throttling**: 1 typing event per second per user/channel.
- **Payload Size Limit**: Maximum packet payload size of `32 KB` (`32,768 bytes`) configured via `maxHttpBufferSize` (customizable via `WS_MAX_PAYLOAD_BYTES`). Excessively large frames or connection payloads are rejected to protect against buffer overflow and memory exhaustion.

---

## Scripts & Quality Verification

### Server Scripts

| Command | Action |
| :--- | :--- |
| `pnpm --dir server run dev` | Start development server with live watch mode |
| `pnpm --dir server run build` | Compile TypeScript into `dist/` |
| `pnpm --dir server run start` | Run compiled production server |
| `pnpm --dir server run seed` | Seed database with demo records |
| `pnpm --dir server test` | Run entire Vitest test suite (REST + WebSocket) |
| `pnpm --dir server run test:rest` | Run only REST integration tests |
| `pnpm --dir server run test:ws` | Run only WebSocket integration tests |
| `pnpm --dir server run lint` | Run Oxlint fast linter |
| `pnpm --dir server run format` | Run Prettier formatter across codebase |
| `pnpm --dir server exec tsc --noEmit` | Run TypeScript typechecker with zero errors |

### Client Scripts

| Command | Action |
| :--- | :--- |
| `pnpm --dir client run dev` | Start Vite development server with HMR |
| `pnpm --dir client run build` | Typecheck and build production bundle |
| `pnpm --dir client test` | Run client unit & store tests with Vitest |
| `pnpm --dir client run lint` | Run Oxlint across client components |
| `pnpm --dir client exec tsc --noEmit` | Run client TypeScript typechecker |

---

## Security & Authentication

1. **Stateless JWT Authorization**: User credentials or demo selections produce signed JSON Web Tokens bearing a 7-day expiration.
2. **In-Memory Storage Strategy**: To avoid XSS vulnerabilities prevalent with `localStorage` or `sessionStorage`, tokens are retained strictly in memory via Axios interceptors and React state.
3. **Automatic Session Cleanup**: Receiving an HTTP 401 response invokes the global unauthorized handler to immediately clear state and prompt user re-authentication.
4. **Input Sanitization**: Request bodies, route parameters, and query strings are validated against strict Zod schemas before hitting business logic.
