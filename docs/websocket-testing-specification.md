# WebSocket Integration Testing Specification & Test Matrix

This document outlines the end-to-end testing specification, test suites, event expectations, and edge cases for the Socket.IO real-time layer in the Chat Workspace application.

Testing conventions and setup follow the [official Socket.IO testing documentation](https://socket.io/docs/v4/testing/) adapted for **Vitest**, **Node.js HTTP Server**, and **Prisma SQLite**.

---

## 1. Test Architecture & Directory Structure

Tests are separated by protocol boundary:

```
server/tests/
├── rest/                      # HTTP REST endpoint integration tests
│   ├── auth.test.ts
│   ├── channels.test.ts
│   ├── groups.test.ts
│   └── messages.test.ts
├── ws/                        # Socket.IO integration tests
│   ├── connection.test.ts     # Handshake, JWT auth & initial room allocation
│   ├── presence.test.ts       # Presence tracking & multi-tab lifecycle
│   ├── rooms.test.ts          # Inbound group:join / group:leave management
│   ├── typing.test.ts         # Inbound typing:start / typing:stop indicators
│   └── broadcasts.test.ts     # REST mutation fanouts (messages, channels, invites)
└── setup.ts                   # Global Prisma test database reset
```

### Vitest & Socket.IO Test Pattern
Following the official Socket.IO Vitest specification:
1. An HTTP server is created and bound to port `0` (`httpServer.listen(0)`) to let the OS assign an ephemeral port, eliminating port collisions.
2. Sockets connect via `ioc("http://localhost:" + port, { auth: { token } })`.
3. An event utility `waitFor(socket, event)` wraps `.once()` in a Promise to await asynchronous events deterministically without arbitrary `setTimeout` sleeps.
4. Clean teardown in `afterEach` and `afterAll`:
   - Disconnect all client sockets (`clientSocket.disconnect()`).
   - Close Socket.IO server (`io.close()`).
   - Close HTTP server (`httpServer.close()`).
   - Clean up Prisma records to guarantee clean isolation between tests.

---

## 2. Event Catalog & Directionality

### 2.1 Connection Lifecycle & Control
| Direction | Event Name | Payload Format | Description |
| :--- | :--- | :--- | :--- |
| Handshake | `auth.token` / `headers.authorization` | `{ token: string }` | JWT passed in handshake auth or authorization header |
| Client -> Server | `group:join` | `{ groupId: UUID }` | Request to join a workspace room |
| Client -> Server | `group:leave` | `{ groupId: UUID }` | Request to leave a workspace room |
| Client -> Server | `typing:start` | `{ groupId: UUID, channelId: UUID }` | User started typing in a channel |
| Client -> Server | `typing:stop` | `{ groupId: UUID, channelId: UUID }` | User stopped typing in a channel |

### 2.2 Server to Client Broadcasts
| Direction | Target Room | Event Name | Payload Format |
| :--- | :--- | :--- | :--- |
| Server -> Client | `group:<groupId>` | `user:presence` | `{ userId: UUID, status: "ONLINE" \| "OFFLINE" }` |
| Server -> Client | `group:<groupId>` | `user:typing` | `{ groupId: UUID, channelId: UUID, userId: UUID, isTyping: boolean }` |
| Server -> Client | `group:<groupId>` | `message:created` | `{ channelId: UUID, groupId: UUID, message: MessageWithUser }` |
| Server -> Client | `group:<groupId>` | `channel:created` | `{ groupId: UUID, channel: Channel }` |
| Server -> Client | `group:<groupId>` | `member:joined` | `{ groupId: UUID, member: MemberWithUser }` |
| Server -> Client | `user:<userId>` | `group:invited` | `{ group: Group }` |
| Server -> Caller | Socket Only | `error` | `{ message: string }` |

---

## 3. Test Suites & Test Cases

---

### Suite 1: Handshake, Authentication & Connection Lifecycle (`tests/ws/connection.test.ts`)

#### TC 1.1: Successful Handshake via `auth.token`
- **Preconditions**: User Alice exists in DB and belongs to Workspace Group 1 and Workspace Group 2. Valid JWT generated for Alice.
- **Trigger**: Client connects with `auth: { token: aliceToken }`.
- **Expected Behavior**:
  - Connection succeeds; client receives `'connect'` event.
  - Server assigns `socket.data.userId = alice.id`.
  - Server joins personal private room `user:${alice.id}`.
  - Server queries `groupService.getUserGroups(alice.id)` and joins rooms `group:${group1.id}` and `group:${group2.id}`.
  - `socket.data.userGroupIds` contains both group IDs.

#### TC 1.2: Successful Handshake via `headers.authorization` with Bearer Prefix
- **Preconditions**: Valid JWT for Alice.
- **Trigger**: Client connects with `extraHeaders: { authorization: "Bearer " + aliceToken }`.
- **Expected Behavior**:
  - Handshake middleware strips `"Bearer "` and validates JWT.
  - Connection succeeds identically to TC 1.1.

#### TC 1.3: Rejection on Missing Token
- **Trigger**: Client attempts connection with `{ auth: {} }` and no authorization header.
- **Expected Behavior**:
  - Server rejects handshake: `next(new Error("Missing authentication token"))`.
  - Client receives `'connect_error'` with message `"Missing authentication token"`.
  - Socket does not connect (`client.connected === false`).

#### TC 1.4: Rejection on Empty or Whitespace Token
- **Trigger**: Client attempts connection with `auth: { token: "   " }` or `auth: { token: "Bearer " }`.
- **Expected Behavior**:
  - Server rejects handshake with `"Authentication token cannot be empty"`.
  - Client receives `'connect_error'`.

#### TC 1.5: Rejection on Malformed or Tampered Token
- **Trigger**: Client attempts connection with `auth: { token: "invalid.jwt.signature" }`.
- **Expected Behavior**:
  - Handshake rejected with `"Invalid or expired authentication token"`.
  - Socket does not connect.

#### TC 1.6: Rejection on Expired Token
- **Trigger**: Client attempts connection with a JWT whose `exp` timestamp is in the past.
- **Expected Behavior**:
  - Handshake rejected with `"Invalid or expired authentication token"`.

#### TC 1.7 (Edge Case): User with Zero Group Memberships
- **Preconditions**: User Bob exists in DB but has not joined any groups.
- **Trigger**: Bob connects with valid JWT.
- **Expected Behavior**:
  - Connection succeeds without errors.
  - Socket joins `user:${bob.id}`.
  - `socket.data.userGroupIds` is an empty set.
  - No group room joins attempted; no presence events broadcast.

#### TC 1.8 (Edge Case): Database Query Failure During Connection
- **Preconditions**: Database throws an error during `groupService.getUserGroups`.
- **Trigger**: User connects.
- **Expected Behavior**:
  - Server catches exception inside `try/catch` in `onConnection`.
  - Error is logged without uncaught process crash.
  - Socket remains connected in `user:${userId}`.

---

### Suite 2: Global Presence Tracking & Multi-Tab Lifecycle (`tests/ws/presence.test.ts`)

#### TC 2.1: Initial Connection Broadcasts `ONLINE` to Workspace Members
- **Preconditions**: Alice and Bob are members of Group 1. Bob is already connected.
- **Trigger**: Alice establishes her first socket connection.
- **Expected Behavior**:
  - `presenceService.track(alice.id, socket.id)` returns `isFirstConnection = true`.
  - Server broadcasts `user:presence` with `{ userId: alice.id, status: "ONLINE" }` to `group:${group1.id}`.
  - Bob receives the `user:presence` event.

#### TC 2.2: Originating Sender is Excluded from Connection Presence Broadcast
- **Trigger**: Alice connects.
- **Expected Behavior**:
  - Because `socket.to("group:" + groupId)` is used, Alice's own socket does NOT receive the `ONLINE` presence event.

#### TC 2.3: Multi-Tab Connection Does Not Duplicate `ONLINE` Broadcast
- **Preconditions**: Alice already has Socket A connected. Bob is listening on Group 1.
- **Trigger**: Alice opens a second browser tab, connecting Socket B with the same user JWT.
- **Expected Behavior**:
  - `presenceService.track(alice.id, socketB.id)` returns `isFirstConnection = false`.
  - Socket B connects successfully.
  - Bob receives **no** duplicate `user:presence` event.

#### TC 2.4: Multi-Tab Partial Disconnect Does Not Broadcast `OFFLINE`
- **Preconditions**: Alice has two active sockets (Socket A and Socket B). Bob is listening on Group 1.
- **Trigger**: Alice closes tab 1 (Socket A disconnects).
- **Expected Behavior**:
  - `presenceService.untrack(alice.id, socketA.id)` returns `isLastConnection = false`.
  - Bob receives **no** `OFFLINE` event because Alice is still online on Socket B.
  - `presenceService.isOnline(alice.id)` remains `true`.

#### TC 2.5: Final Disconnect Broadcasts `OFFLINE` to Workspace Members
- **Preconditions**: Alice has one active socket remaining. Bob is listening on Group 1.
- **Trigger**: Alice's remaining socket disconnects.
- **Expected Behavior**:
  - `presenceService.untrack(alice.id, socket.id)` returns `isLastConnection = true`.
  - Server emits `user:presence` with `{ userId: alice.id, status: "OFFLINE" }` to all rooms in `socket.data.userGroupIds`.
  - Bob receives the `OFFLINE` presence event.
  - `presenceService.isOnline(alice.id)` returns `false`.

#### TC 2.6 (Edge Case): Group Isolation for Presence
- **Preconditions**: Alice is in Group 1. Charlie is only in Group 2.
- **Trigger**: Alice connects or disconnects.
- **Expected Behavior**:
  - Bob (in Group 1) receives presence updates.
  - Charlie (in Group 2) receives **no** presence updates for Alice.

---

### Suite 3: Inbound Room Management (`tests/ws/rooms.test.ts`)

#### TC 3.1: Authorized `group:join` Adds Socket to Room
- **Preconditions**: Alice is a member of Group 1 in DB, but connected before being added (or needs to resubscribe).
- **Trigger**: Alice emits `group:join` with `{ groupId: group1.id }`.
- **Expected Behavior**:
  - Server checks `groupService.getGroupById(group1.id, alice.id)`: succeeds.
  - Server executes `socket.join("group:" + group1.id)`.
  - `socket.data.userGroupIds` includes `group1.id`.
  - Subsequent broadcasts to `group:${group1.id}` are received by Alice.

#### TC 3.2: Unauthorized `group:join` Rejection
- **Preconditions**: Alice is NOT a member of Group 2.
- **Trigger**: Alice emits `group:join` with `{ groupId: group2.id }`.
- **Expected Behavior**:
  - Server checks `groupService.getGroupById(group2.id, alice.id)`: throws authorization/not-found error.
  - Server emits `'error'` event back to Alice with `{ message: "Unauthorized or group not found" }`.
  - Alice does NOT join `group:${group2.id}`.
  - Messages broadcast to Group 2 are NOT received by Alice.

#### TC 3.3: `group:join` with Non-Existent UUID
- **Trigger**: Alice emits `group:join` with `{ groupId: "00000000-0000-0000-0000-000000000000" }`.
- **Expected Behavior**:
  - Server emits `'error'` with `{ message: "Unauthorized or group not found" }`.

#### TC 3.4: `group:join` with Malformed or Invalid Payload
- **Trigger**: Alice emits `group:join` with:
  - `{ groupId: "invalid-uuid" }`
  - `{}`
  - `null`
  - `"not-an-object"`
- **Expected Behavior**:
  - `validateSocketPayload(groupRoomPayloadSchema, data)` fails.
  - Server emits `'error'` with `{ message: "Invalid group:join payload" }`.
  - No database query is executed; server does not crash.

#### TC 3.5: Authorized `group:leave` Removes Socket from Room
- **Preconditions**: Alice is currently in room `group:${group1.id}`.
- **Trigger**: Alice emits `group:leave` with `{ groupId: group1.id }`.
- **Expected Behavior**:
  - Server executes `socket.leave("group:" + group1.id)`.
  - `socket.data.userGroupIds` deletes `group1.id`.
  - Subsequent messages broadcast to `group:${group1.id}` are no longer received by Alice.

#### TC 3.6 (Edge Case): `group:leave` with Malformed Payload
- **Trigger**: Alice emits `group:leave` with `{}` or invalid UUID.
- **Expected Behavior**:
  - Zod validation fails; handler returns early without errors or crash.

#### TC 3.7 (Edge Case): `group:leave` for a Room Not Joined
- **Trigger**: Alice emits `group:leave` for a group she was never in.
- **Expected Behavior**:
  - `socket.leave` is a safe no-op; socket remains healthy.

---

### Suite 4: Inbound Typing Indicators (`tests/ws/typing.test.ts`)

#### TC 4.1: Valid `typing:start` Relays to Other Room Members
- **Preconditions**: Alice and Bob are connected and in `group:${group1.id}`.
- **Trigger**: Alice emits `typing:start` with `{ groupId: group1.id, channelId: channel1.id }`.
- **Expected Behavior**:
  - Server validates payload via `typingPayloadSchema`.
  - Server checks `socket.rooms.has("group:" + group1.id)`: returns `true`.
  - Server emits `user:typing` with:
    ```json
    {
      "groupId": "<group1-id>",
      "channelId": "<channel1-id>",
      "userId": "<alice-id>",
      "isTyping": true
    }
    ```
  - Bob receives the event.

#### TC 4.2: Typing Sender is Excluded from Indicator Relay
- **Trigger**: Alice emits `typing:start`.
- **Expected Behavior**:
  - Because `socket.to("group:" + groupId)` is used, Alice does NOT receive `user:typing`.

#### TC 4.3: Valid `typing:stop` Relays `isTyping: false`
- **Preconditions**: Alice and Bob in `group:${group1.id}`.
- **Trigger**: Alice emits `typing:stop` with `{ groupId: group1.id, channelId: channel1.id }`.
- **Expected Behavior**:
  - Bob receives `user:typing` with `isTyping: false`.
  - Alice does not receive the event.

#### TC 4.4 (Security / Spoofing Guard): Typing from Non-Room Member is Discarded
- **Preconditions**: Charlie is connected, but is NOT in room `group:${group1.id}`.
- **Trigger**: Charlie attempts to emit `typing:start` with `{ groupId: group1.id, channelId: channel1.id }`.
- **Expected Behavior**:
  - Server checks `socket.rooms.has("group:" + group1.id)`: returns `false`.
  - Event is silently discarded.
  - Bob and Alice in Group 1 receive **no** typing event.
  - No database query is executed.

#### TC 4.5 (Edge Case): Malformed Typing Payloads
- **Trigger**: Client emits `typing:start` or `typing:stop` with:
  - Missing `channelId` (`{ groupId: group1.id }`)
  - Missing `groupId` (`{ channelId: channel1.id }`)
  - Invalid UUID format
  - Non-object / empty object
- **Expected Behavior**:
  - Zod safeParse returns null; handler returns early without error or broadcast.

#### TC 4.6 (Isolation): Typing Indicators Do Not Cross Groups
- **Preconditions**: Alice in Group 1; Dave in Group 2.
- **Trigger**: Alice emits `typing:start` in Group 1.
- **Expected Behavior**:
  - Dave receives **no** event.

#### TC 4.7: Typing Inactivity Fallback ("Ghost Typing" Prevention) & Architecture Boundary
- **Architecture Boundary Analysis**:
  - The WebSocket server is a stateless, low-latency event relay. It checks room membership and relays `user:typing` with `isTyping: true` to the group room, excluding the sender.
  - The server **does not maintain per-user typing inactivity timers in memory** (avoiding timer leaks and memory overhead at scale).
  - The client (`useSocketStore`) manages the indicator lifecycle: upon receiving `user:typing` with `isTyping: true`, the client mounts the indicator and arms a 3-second fallback timer (`setTimeout(..., 3000)`).
  - If Alice's client freezes, loses power, or pauses without emitting `typing:stop`, Bob's client's 3-second timer expires and automatically removes Alice from `typingUsers[channelId]`.
- **Server-Side Test (`tests/ws/typing.test.ts`)**:
  - Verify server properly relays `typing:start` (`isTyping: true`) and `typing:stop` (`isTyping: false`).
  - Verify that when Alice posts a message via REST instead of `typing:stop`, the server broadcasts `message:created` containing `userId`, giving the client the signal to immediately dismiss Alice's typing indicator.
  - Verify that if Alice's connection drops, the server broadcasts `user:presence` with `OFFLINE`.
- **Client-Side Store Test (`useSocketStore.test.ts`)**:
  - Setup: Mock socket receives `user:typing` with `{ channelId, userId: alice.id, isTyping: true }`.
  - Assert: `typingUsers[channelId]` contains `alice.id`.
  - Trigger: Advance virtual timers by 3000ms (`vi.advanceTimersByTime(3000)`).
  - Assert: `typingUsers[channelId]` automatically removes `alice.id` without requiring an incoming `typing:stop` event.

---

### Suite 5: Cross-Layer Outbound Broadcasts (`tests/ws/broadcasts.test.ts`)

#### TC 5.1: REST Message Creation Triggers `message:created` Broadcast
- **Preconditions**: Alice and Bob are in Group 1. Both connected via WebSocket.
- **Trigger**: Alice calls HTTP `POST /api/channels/:channelId/messages` with `{ content: "Hello world" }`.
- **Expected Behavior**:
  - HTTP response returns status `201` with created message object.
  - `MessageController` triggers `wsEmitter.emitMessageCreated(groupId, { channelId, groupId, message })`.
  - Bob receives `message:created` over WebSocket with matching `channelId`, `groupId`, and `message`.
  - `message` includes author user details (`id`, `name`, `avatar`).

#### TC 5.2: Message Broadcast Isolation Across Groups
- **Preconditions**: Group 1 and Group 2 exist. Charlie is only in Group 2.
- **Trigger**: Message created in Group 1 via REST.
- **Expected Behavior**:
  - Bob (Group 1) receives `message:created`.
  - Charlie (Group 2) receives **no** event.

#### TC 5.3: REST Channel Creation Triggers `channel:created` Broadcast
- **Preconditions**: Alice and Bob in Group 1.
- **Trigger**: Alice calls HTTP `POST /api/groups/:groupId/channels` with `{ name: "announcements" }`.
- **Expected Behavior**:
  - HTTP returns `201`.
  - `ChannelController` triggers `wsEmitter.emitChannelCreated(groupId, { groupId, channel })`.
  - Bob receives `channel:created` over WebSocket with the new channel data.

#### TC 5.4: REST Add Member Triggers `member:joined` and `group:invited` with Dynamic Socket Room Join
- **Preconditions**: Alice is in Group 1. Bob is connected to WebSocket in private room `user:${bob.id}` but is not yet in Group 1.
- **Trigger**: Alice calls HTTP `POST /api/groups/:groupId/members` inviting Bob.
- **Expected Behavior**:
  - HTTP returns `201`.
  - Existing members in Group 1 receive `member:joined` with `{ groupId, member }`.
  - Bob receives `group:invited` in his private room with `{ group }`.
  - Server executes `wsEmitter.joinUserSocketsToGroup(bob.id, group.id)`:
    - Bob's active socket is dynamically joined to `group:${group1.id}` via `socketsJoin`.
  - **Verification**: Alice immediately posts a message in Group 1 via REST; Bob receives `message:created` in real time without having to reconnect or emit `group:join`.

#### TC 5.5: REST Group Creation Dynamically Joins Creator's Sockets
- **Preconditions**: Alice is connected via WebSocket.
- **Trigger**: Alice calls HTTP `POST /api/groups` to create a new group.
- **Expected Behavior**:
  - HTTP returns `201`.
  - `GroupController.create` executes `wsEmitter.joinUserSocketsToGroup(alice.id, group.id)`.
  - Alice's connected socket joins `group:${newGroup.id}` immediately.
  - Subsequent broadcasts in the new group reach Alice live.

#### TC 5.6: Cross-Channel Message Fanout for Real-Time Unread Badges
- **Preconditions**:
  - Group 1 contains Channel A ("general") and Channel B ("random").
  - Alice and Bob are members of Group 1 and connected to WebSocket.
  - Bob's active channel in the client is Channel A (`activeChannelId === channelA.id`).
- **Trigger**: Alice creates a message in Channel B (`POST /api/channels/:channelBId/messages`).
- **Expected Behavior (Server WebSocket Layer)**:
  - Server broadcasts `message:created` to the entire room `group:${group1.id}` (not restricted to `channel:${channelB.id}`).
  - Bob receives `message:created` even though he is currently reading Channel A.
  - The payload contains `{ channelId: channelB.id, groupId: group1.id, message: Message }`.
- **Expected Behavior (Client Store Layer)**:
  - Bob's `useSocketStore` receives the event and checks `activeChannelId !== channelB.id`.
  - Adds `channelB.id` to `unreadChannelIds`.
  - Adds `channelB.id` to `unreadGroupChannels[group1.id]`.
  - ChannelSidebar renders an unread badge on Channel B, and the workspace group button reflects unread messages.
  - When Bob switches to Channel B (`setActiveChannel(channelB.id)`), `channelB.id` is removed from both unread collections.

---

### Suite 6: Client-Side WebSocket Store Integration Tests (`useSocketStore.test.ts`)

While backend tests verify protocol transport and room routing, client-side store tests verify state transitions, unread tracking, and typing indicator timeouts:

#### TC 6.1: Cross-Channel Message Marks Channel as Unread
- **Trigger**: Mock socket emits `message:created` for `channel-2` while `activeChannelId` is `channel-1`.
- **Expected Behavior**:
  - `unreadChannelIds.has("channel-2")` is `true`.
  - `unreadGroupChannels[groupId].has("channel-2")` is `true`.

#### TC 6.2: Active Channel Message Does Not Mark as Unread
- **Trigger**: Mock socket emits `message:created` for `channel-1` while `activeChannelId` is `channel-1`.
- **Expected Behavior**:
  - `unreadChannelIds.has("channel-1")` is `false`.

#### TC 6.3: Switching Active Channel Dismisses Unread Badges
- **Trigger**: Channel 2 is in `unreadChannelIds`. Client calls `setActiveChannel("channel-2")`.
- **Expected Behavior**:
  - `channel-2` is removed from `unreadChannelIds` and `unreadGroupChannels[groupId]`.

#### TC 6.4: Manual `markChannelAsRead` Dismisses Unread Badges
- **Trigger**: Channel 2 is unread. Client calls `markChannelAsRead("channel-2")`.
- **Expected Behavior**:
  - `channel-2` is removed from `unreadChannelIds` and `unreadGroupChannels[groupId]`.

#### TC 6.5: Typing Inactivity Auto-Dismissal (3-Second Timeout)
- **Trigger**: Mock socket emits `user:typing` with `{ channelId: "ch-1", userId: "alice", isTyping: true }`.
- **Assert**: Alice is present in `typingUsers["ch-1"]`.
- **Trigger**: Virtual time advanced by 3000ms (`vi.advanceTimersByTime(3000)`).
- **Expected Behavior**:
  - Alice is automatically removed from `typingUsers["ch-1"]` without any incoming `typing:stop` packet.

#### TC 6.6: Message Arrival Instantly Dismisses Active Typing Indicator
- **Trigger**: Alice is currently typing in Channel 1 (`typingUsers["ch-1"].has("alice") === true`).
- **Trigger**: Mock socket emits `message:created` for Channel 1 authored by Alice.
- **Expected Behavior**:
  - Alice is immediately removed from `typingUsers["ch-1"]`.
  - The pending 3000ms inactivity timer is cancelled (`clearTimeout`).

---

### Suite 7: Edge Cases, Concurrency & Resilience

#### TC 7.1: Rapid Consecutive Typing Events (Debounce / High Frequency Resilience)
- **Trigger**: Alice emits 50 `typing:start` and `typing:stop` events within 50ms.
- **Expected Behavior**:
  - Server processes events without dropping connection, throwing unhandled rejections, or leaking memory.

#### TC 7.2: Rapid Connect and Disconnect Cycling
- **Trigger**: Client opens and closes connection 10 times in rapid succession.
- **Expected Behavior**:
  - `presenceService` correctly registers and deregisters sockets without negative counts or stuck `ONLINE` status.

#### TC 7.3: Large Frame Disconnect Guard
- **Trigger**: Client attempts to send an oversized packet (>1MB).
- **Expected Behavior**:
  - Engine.IO terminates sender's socket cleanly without crashing process or affecting other connected clients.

#### TC 7.4: Zero Leaked Handles on Test Teardown
- **Trigger**: Vitest suite completes.
- **Expected Behavior**:
  - All HTTP servers, Socket.IO instances, timers, and sockets close cleanly.
  - Vitest exits with code 0 without hanging or reporting open asynchronous handles.

---

## 4. Implementation Checklist for Task `tasks/20261010-130525`

- [ ] Install `socket.io-client` in `server` devDependencies.
- [ ] Create test helper `server/tests/ws/wsHelper.ts`:
  - `createTestWsServer()`: creates Express app + HTTP server + Socket.IO server on dynamic port.
  - `createTestSocket(port, token)`: initializes connected client socket.
  - `waitFor(socket, event, timeoutMs)`: Promise helper with timeout failure guard.
- [ ] Implement `server/tests/ws/connection.test.ts` (TC 1.1 - 1.8).
- [ ] Implement `server/tests/ws/presence.test.ts` (TC 2.1 - 2.6).
- [ ] Implement `server/tests/ws/rooms.test.ts` (TC 3.1 - 3.7).
- [ ] Implement `server/tests/ws/typing.test.ts` (TC 4.1 - 4.6).
- [ ] Implement `server/tests/ws/broadcasts.test.ts` (TC 5.1 - 5.5).
- [ ] Run test suite with `pnpm --dir server test` and verify 100% pass rate.
