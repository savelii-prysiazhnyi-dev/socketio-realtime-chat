# Rate Limiting & Abuse Prevention Specification

## 1. Overview and Objectives

This specification defines the multi-tiered rate limiting and abuse-prevention architecture for both WebSocket and REST layers of the real-time chat application.

The implementation is split into two distinct, independently testable phases and commits:
1. **Phase 1: WebSocket Rate Limiting & Concurrency Controls** (Transport, Handshake, Connection, and Event levels)
2. **Phase 2: REST API Rate Limiting** (Route-tiered Express middleware, Auth protection, and General API limits)

---

## 2. Phase 1: WebSocket Rate Limiting & Concurrency Architecture

WebSocket protection covers 5 distinct layers spanning transport, handshake, connection state, and event processing.

```
Incoming Connection
  │
  ├─► [Layer 1: Transport Payload Size]
  │     maxHttpBufferSize = 32 KB (Engine.IO drop before parsing)
  │
  ├─► [Layer 2: Global Concurrency Cap]
  │     io.engine.clientsCount >= MAX_GLOBAL_CONNECTIONS (e.g. 5,000)
  │
  ├─► [Layer 3: Handshake Connection Rate]
  │     Sliding window per IP: max 10 handshakes / 10 seconds
  │
  ├─► [Layer 4: Concurrency Caps (User & IP)]
  │     - User Concurrency: max 5 active sockets per authenticated userId
  │     - IP Concurrency: max 20 active sockets per IP
  │
  └─► Handshake Approved & Socket Connected
        │
        └─► [Layer 5: Inbound Message / Event Rate]
              socket.use() packet middleware: max 20 events / second per socket
              - Soft limit: emits 'error' { code: 'RATE_LIMIT_EXCEEDED' }
              - Abuse flood threshold (>3x limit): socket.disconnect(true)
```

### Layer 1: Transport Payload Size Cap
- **Mechanism**: Configured on the Socket.IO `Server` instance via `maxHttpBufferSize`.
- **Threshold**: `32 * 1024` bytes (32 KB).
- **Behavior**: Frames exceeding this size are dropped immediately at the transport layer by Engine.IO without allocating memory for JSON parsing, preventing memory exhaustion attacks.

### Layer 2: Global Concurrency Cap
- **Mechanism**: Evaluated at the top of the Socket.IO handshake middleware (`io.use`).
- **Threshold**: Configurable via `WS_MAX_GLOBAL_CONNECTIONS` (default: `5000`).
- **Check**: `io.engine.clientsCount >= MAX_GLOBAL_CONNECTIONS`.
- **Response**: Handshake rejected with `new Error('Server capacity reached. Please try again later.')`.

### Layer 3: Handshake Connection Rate Limiter (Per IP)
- **Mechanism**: In-memory sliding window or token bucket per client IP.
- **Threshold**: Maximum 10 connection attempts per 10-second window per IP.
- **IP Extraction**: Evaluated using client IP (`socket.handshake.address` with proxy fallback).
- **Response**: Handshake rejected with `new Error('Too many connection attempts. Please try again later.')`.

### Layer 4: Concurrency Caps (Per User and Per IP)
- **User Concurrency Cap**:
  - Leverages `presenceService.getUserSocketCount(userId)`.
  - **Threshold**: Maximum 5 active sockets per authenticated user.
  - **Response**: Handshake rejected with `new Error('Maximum concurrent connections per user exceeded')`.
- **IP Concurrency Cap**:
  - In-memory tracker of active socket counts keyed by IP address.
  - Incremented on approved handshake, decremented in socket `disconnect` event.
  - **Threshold**: Maximum 20 active sockets per IP.
  - **Response**: Handshake rejected with `new Error('Maximum concurrent connections per IP exceeded')`.

### Layer 5: Inbound Message / Event Rate Limiter (Per Socket)
- **Mechanism**: Socket.IO packet middleware registered via `socket.use(([event, ...args], next) => ...)`.
- **Threshold**: Maximum 20 events per second (or 50 events per 10-second sliding window) per socket.
- **Behavior**:
  - If event count exceeds the rate limit: event is dropped, `next(new Error('Rate limit exceeded'))` is called or a dedicated warning is emitted.
  - If event count exceeds 3x the threshold within the same window (deliberate flooding): the socket is forcibly closed via `socket.disconnect(true)`.

### Layer 6: Typing Event Throttling (Amplification Protection)
- **Mechanism**: Timestamp debounce/throttle in `typing.handler.ts`.
- **Threshold**: Maximum 1 `typing:start` and 1 `typing:stop` event broadcast per 1,000 ms per user per channel.
- **Behavior**: Excess rapid typing packets are dropped locally before room broadcast fanout occurs.

---

## 3. Phase 2: REST API Rate Limiting Architecture

REST API rate limiting protects against credential stuffing, user enumeration, database load spikes, and endpoint abuse.

### Rate Limit Tiers

| Tier | Endpoints | Window | Max Requests | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Strict Auth** | `/api/auth/*` | 15 minutes | 15 per IP | Protects login, registration, and demo-auth against brute force and token hammering. |
| **User Creation** | `POST /api/users` | 15 minutes | 10 per IP | Protects user registration against account spam. |
| **General API** | `/api/*` | 1 minute | 100 per IP | Protects general queries, message creations, channel queries, and group management. |

### Technical Details & Standards
- **Middleware**: Built with `express-rate-limit` (standard Express rate limiting solution).
- **Standard Headers**: RFC 6585 / IETF Draft compliant headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- **Response Format**: Status 429 Too Many Requests with unified application JSON error body:
  ```json
  {
    "error": "Too many requests from this IP, please try again later."
  }
  ```
- **IP Determination**: Supports standard Express `req.ip` and reverse proxy environments.

---

## 4. Test Strategy

### WebSocket Rate Limiting Tests (`server/tests/ws/ratelimit.test.ts`)
1. **Payload Size Rejection**: Sending payload > 32 KB closes connection or errors.
2. **Per-IP Handshake Rate Limit**: Attempting 11 connection handshakes within 10s from the same IP rejects the 11th with a rate limit error.
3. **Per-User Concurrency Cap**: Opening a 6th concurrent socket for the same user is rejected.
4. **Per-IP Concurrency Cap**: Opening a 21st concurrent socket from the same IP is rejected.
5. **Event Rate Limit**: Spamming 25 events in under a second triggers rate limit errors and subsequent flood disconnect.
6. **Global Concurrency Cap**: Handshake rejected when active socket count reaches the configured global threshold.

### REST Rate Limiting Tests (`server/tests/rest/ratelimit.test.ts`)
1. **Auth Endpoint Rate Limit**: Exceeding 15 requests within 15 minutes to `/api/auth/login` returns HTTP 429 with standard headers.
2. **General API Rate Limit**: Exceeding 100 requests to `/api/groups` returns HTTP 429.
3. **Header Verification**: Confirms presence of `RateLimit-Limit`, `RateLimit-Remaining`, and `Retry-After`.

---

## 5. Execution & Commit Plan

1. **Phase 1: WebSocket Rate Limiting**:
   - Implement `wsRateLimiter` utility (in-memory token bucket / sliding window).
   - Integrate `maxHttpBufferSize` into `server.ts`.
   - Update `setupWebsocket` with global cap, IP connection rate, user/IP concurrency, and `socket.use` event rate limiter.
   - Implement typing event throttle in `typing.handler.ts`.
   - Add comprehensive tests in `server/tests/ws/ratelimit.test.ts`.
   - Run full verification (`tsc`, `lint`, `format`, `test:ws`).
   - Commit Phase 1.

2. **Phase 2: REST Rate Limiting**:
   - Install and configure `express-rate-limit`.
   - Define tier limiters in `server/src/middlewares/rateLimit.middleware.ts`.
   - Wire limiters into `app.ts` / route files.
   - Add integration tests in `server/tests/rest/ratelimit.test.ts`.
   - Run full verification (`tsc`, `lint`, `format`, `test:rest`, `test:ws`, client tests).
   - Commit Phase 2.
