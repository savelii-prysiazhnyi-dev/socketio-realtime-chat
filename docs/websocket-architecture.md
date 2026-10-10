# WebSocket Architecture & Real-Time Event Hierarchy

This document outlines the real-time architecture, room scoping, connection lifecycle, and event schemas for the Chat Workspace application.

---

## 1. Architecture Overview

- **Transport**: Socket.IO with WebSocket priority.
- **Authentication**: JWT token validated at connection handshake via `authSocketMiddleware`.
- **Hybrid Write/Broadcast Pattern**:
  - **Writes** (e.g. posting messages, creating channels) are processed through REST API endpoints for validation, persistence, and HTTP status codes.
  - **Broadcasts** (e.g. new messages, presence updates, channel creation) are fanned out in real-time over Socket.IO rooms.

---

## 2. Room Hierarchy

```
Socket.IO Server
├── user:<userId>          [Personal Private Room]
│   └── Scope: The authenticated user across all their open tabs/devices.
│   └── Auto-joined on handshake connection.
│   └── Used for: Workspace invitations, direct alerts, private notifications.
│
└── group:<groupId>        [Workspace Room]
    └── Scope: All active members within a specific group workspace.
    └── Joined upon client 'group:join' request after server-side membership authorization.
    └── Used for:
        ├── Channel creation events
        ├── Member join events
        ├── Channel message broadcasts (enables cross-channel unread badges)
        └── Workspace member presence updates (ONLINE / OFFLINE)
```

---

## 3. Event Hierarchy & Schemas

### 3.1 Client to Server (Inbound)

| Event | Payload | Description |
| :--- | :--- | :--- |
| `group:join` | `{ groupId: string }` | Requests to join a workspace room. Server validates membership via `groupService` before calling `socket.join()`. |
| `group:leave` | `{ groupId: string }` | Leaves a workspace room. Calls `socket.leave()`. |
| `typing:start` | `{ groupId: string, channelId: string }` | Client started typing in a channel. Throttled on the client. |
| `typing:stop` | `{ groupId: string, channelId: string }` | Client stopped typing in a channel or submitted the message. |

#### Payload Examples
```json
// group:join
{
  "groupId": "223e4567-e89b-12d3-a456-426614174001"
}
```

```json
// typing:start / typing:stop
{
  "groupId": "223e4567-e89b-12d3-a456-426614174001",
  "channelId": "443e4567-e89b-12d3-a456-426614174003"
}
```

---

### 3.2 Server to Client (Outbound)

| Event | Target Room | Payload | Description |
| :--- | :--- | :--- | :--- |
| `message:created` | `group:<groupId>` | `{ channelId: string, message: Message }` | Broadcast when a new message is posted to any channel in the workspace. |
| `channel:created` | `group:<groupId>` | `{ groupId: string, channel: Channel }` | Broadcast when a new channel is created in the workspace. |
| `member:joined` | `group:<groupId>` | `{ groupId: string, member: GroupMember }` | Broadcast when a new user joins or is invited to the workspace. |
| `user:presence` | `group:<groupId>` | `{ userId: string, status: "ONLINE" \| "OFFLINE" }` | Broadcast when a member's global connection state transitions between online and offline. |
| `user:typing` | `group:<groupId>` | `{ groupId: string, channelId: string, userId: string, isTyping: boolean }` | Broadcast when a member starts or stops typing (sender excluded via `socket.to()`). |
| `group:invited` | `user:<userId>` | `{ group: Group }` | Pushed directly to an invited user so their client can auto-join the new workspace. |
| `error` | Socket Sender | `{ message: string }` | Emitted back to the caller on validation or authorization failure. |

#### Payload Examples

```json
// message:created
{
  "channelId": "443e4567-e89b-12d3-a456-426614174003",
  "message": {
    "id": "553e4567-e89b-12d3-a456-426614174004",
    "content": "Hello team, deployment is live!",
    "channelId": "443e4567-e89b-12d3-a456-426614174003",
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2026-10-08T12:05:00.000Z",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Alice Johnson",
      "avatar": null
    }
  }
}
```

```json
// channel:created
{
  "groupId": "223e4567-e89b-12d3-a456-426614174001",
  "channel": {
    "id": "443e4567-e89b-12d3-a456-426614174003",
    "name": "dev-updates",
    "topic": "Daily engineering updates",
    "groupId": "223e4567-e89b-12d3-a456-426614174001",
    "createdAt": "2026-10-08T12:00:00.000Z"
  }
}
```

```json
// member:joined
{
  "groupId": "223e4567-e89b-12d3-a456-426614174001",
  "member": {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "groupId": "223e4567-e89b-12d3-a456-426614174001",
    "role": "MEMBER",
    "joinedAt": "2026-10-08T12:00:00.000Z",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Bob Smith",
      "email": "bob@test.com",
      "avatar": null
    }
  }
}
```

```json
// user:presence
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "ONLINE"
}
```

```json
// user:typing
{
  "groupId": "223e4567-e89b-12d3-a456-426614174001",
  "channelId": "443e4567-e89b-12d3-a456-426614174003",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "isTyping": true
}
```

---

## 4. Connection Lifecycle & Multi-Tab Handling

### 4.1 Handshake & Authentication
1. Client connects with token:
   ```ts
   io('http://localhost:3000', {
     auth: { token: inMemoryToken }
   })
   ```
2. `authSocketMiddleware` extracts and verifies the JWT.
3. Sets `socket.data.userId = payload.userId`.
4. If missing or invalid, denies the handshake with `next(new Error(...))`.

### 4.2 On Connection
1. **Auto-join personal room**: `socket.join('user:' + userId)`.
2. **Multi-tab presence tracking**:
   - Register `socket.id` under `userId` in connection registry.
   - If user socket count transitions from `0 -> 1`:
     - Broadcast `user:presence` with `{ userId, status: "ONLINE" }` to user's workspace groups.

### 4.3 On Disconnect
1. Socket.IO automatically leaves all rooms for that socket instance.
2. Remove `socket.id` from `userId`'s connection registry.
3. If remaining socket count drops from `1 -> 0` (user closed all tabs):
   - Broadcast `user:presence` with `{ userId, status: "OFFLINE" }` to user's workspace groups.

### 4.4 Reconnection & State Catch-Up
1. Upon network reconnect (`socket.on('connect')`), the client re-emits `group:join` for active workspaces.
2. Client triggers TanStack Query cache invalidation (`queryClient.invalidateQueries(...)`) for the active channel to seamlessly fetch any messages created during the connection gap.
3. Client-side message lists deduplicate by `message.id` to prevent double-renders between HTTP response acknowledgments and socket broadcast echoes.

---

## 5. Typing Indicators & Ephemeral State

Typing indicators are high-frequency, ephemeral events that do not touch the database.

### 5.1 Client Emission Strategy (Throttle + Debounce)
1. **Leading Edge (Immediate)**:
   - On the very first keystroke in a channel's input box, emit `typing:start` immediately with `{ groupId, channelId }`.
2. **Throttled Sustained Typing**:
   - While the user continues typing, throttle further emissions so at most one event is sent every 2–3 seconds.
3. **Trailing Edge (Inactivity Stop)**:
   - Reset a 2.5-second inactivity timer on every keystroke.
   - If the timer expires without further keystrokes, emit `typing:stop` with `{ groupId, channelId }`.
4. **Immediate Submit Dismissal**:
   - When the user presses `Enter` or clicks "Send", cancel the inactivity timer and immediately emit `typing:stop` (or let the incoming `message:created` event dismiss it).

### 5.2 Server Relay (Sender Exclusion)
- The server validates that the socket is a member of the group.
- Emits to the room using `socket.to("group:" + groupId)` so the **originating sender is excluded**:
  ```ts
  socket.to(`group:${groupId}`).emit('user:typing', {
    groupId,
    channelId,
    userId: socket.data.userId,
    isTyping: true, // or false on typing:stop
  });
  ```

### 5.3 Receiver Handling & Ghost Typing Protection
1. **Channel Filter**:
   - Receiver clients only display the indicator if the event's `channelId` matches the currently viewed channel and `userId !== currentUserId`.
2. **Auto-Expiring Fallback (Crash / Disconnect Resilience)**:
   - Whenever `isTyping: true` is received, the client displays the indicator and sets a local 3.5-second fallback timer.
   - If no new typing heartbeat or `typing:stop` is received within 3.5 seconds (e.g. the typing user closed their browser tab or lost connection), the indicator automatically unmounts. This completely eliminates "ghost" permanent typing indicators.

