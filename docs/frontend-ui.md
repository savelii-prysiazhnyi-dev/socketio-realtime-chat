# Frontend UI Specification: Real-Time Chat Application

This document outlines the architecture, layout structure, design tokens, and real-time interaction patterns for the Discord/Slack-style chat interface.

---

## 1. Spatial Layout & Grid Hierarchy

The application interface follows a **4-column layout** using fixed-width ergonomic navigation rails (`rem`) paired with a fluid, flexible chat viewport (`flex-1 min-w-0`).

```
┌───────────────┬─────────────────┬───────────────────────────────────────────┬─────────────────┐
│ Server Rail   │ Channel Sidebar │ Main Chat Area                            │ Member List     │
│ [w-[4.5rem]]  │ [w-60]          │ [flex-1 min-w-0]                          │ [w-60]          │
│               │                 ├───────────────────────────────────────────┤ (Collapsible)   │
│               │                 │ Top Bar (h-12)                            │                 │
│               │                 ├───────────────────────────────────────────┤                 │
│               │                 │                                           │                 │
│               │                 │ Message Feed                              │                 │
│               │                 │ (Scrollable, auto-anchored)               │                 │
│               │                 │                                           │                 │
│               │                 ├───────────────────────────────────────────┤                 │
│               │                 │ Typing Indicator (h-6)                    │                 │
│               │                 │ Message Input Bar                         │                 │
└───────────────┴─────────────────┴───────────────────────────────────────────┴─────────────────┘
```

### Why Relative Units (`rem` and `flex-1`)?
- **Ergonomic Rails (`rem`)**: Sidebars are styled using `rem` (`4.5rem` = 72px base, `15rem` / `w-60` = 240px base). This ensures that if users increase browser font size for accessibility, sidebar widths expand proportionally rather than truncating text.
- **Fluid Chat (`flex-1 min-w-0`)**: The chat area consumes 100% of the remaining horizontal space. `min-w-0` prevents Flexbox from overflowing when long code blocks, URLs, or unbroken words are posted.

---

## 2. Color Palette & Visual Depth

The interface employs layered dark-mode contrast to naturally guide user attention toward the active chat:

| Section | Role | Background Color (Tailwind) | Hex Estimate |
| :--- | :--- | :--- | :--- |
| **Server Rail** | Primary navigation | `bg-neutral-900` | `#1e1f22` |
| **Channel Sidebar** | Group context & topics | `bg-neutral-800` | `#2b2d31` |
| **Main Chat Area** | Active reading surface | `bg-neutral-700/60` | `#313338` |
| **Member List** | Secondary reference | `bg-neutral-800` | `#2b2d31` |
| **Top Bar** | Header metadata | `bg-neutral-750 border-b border-neutral-800` | `#2e3035` |
| **Input Container** | Action surface | `bg-neutral-600/50` | `#383a40` |

---

## 3. Component Hierarchy & Breakdown

### Column 1: Server Rail (`w-[4.5rem] flex-shrink-0`)
- **Direct Messages Icon**: Pinned at the top with a pill indicator.
- **Server Icons**:
  - Circular / rounded-rectangle badges (`w-12 h-12`).
  - Hover / active state transitions smoothly to rounded square.
  - Left-hand vertical white indicator pill (expands on hover/select).
- **Unread Server Badges**: Small red badge with count or a white dot for unread activity.
- **Add Server Button (`+`)**: Opens a modal to create a new group.

---

### Column 2: Channel Sidebar (`w-60 flex-shrink-0`)
- **Server Header**:
  - Server title with dropdown arrow.
- **Channel Categories**:
  - Collapsible category header (e.g., `TEXT CHANNELS`) with a `+` button to create channels.
- **Channel Rows**:
  - `# channel-name` format.
  - Active channel marked with a subtle highlight pill.
  - Unread channels rendered in bold white text with a left indicator dot.
- **Bottom Tray (Current User)**:
  - User avatar with status dot.
  - Display name and identifier.
  - Quick User Switcher toggle (useful for local multi-user testing) / settings icon.

---

### Column 3: Main Chat View (`flex-1 min-w-0 flex flex-col`)

#### A. Top Bar (`h-12 flex-shrink-0`)
- **Left**: `# active-channel` + separator + topic description.
- **Right**:
  - **Connection Status Badge**: `🟢 Live` / `🟡 Reconnecting...` (reactively bound to `socket.connected`).
  - **Member Sidebar Toggle**: "Person" icon button that toggles Column 4.

#### B. Message Feed (`flex-1 overflow-y-auto px-4 py-3`)
- **Message Item**:
  - Avatar (`w-10 h-10 rounded-full`).
  - Header: Author name (bold) + timestamp (e.g., `"Today at 10:32 AM"`).
  - Body text with markdown-ready typography.
- **Optimistic Send State**:
  - While waiting for WebSocket server confirmation: `opacity-60` with a subtle clock/sending indicator.
  - Swaps to confirmed state upon socket broadcast.
- **Scroll Pinning**:
  - Automatically sticks to bottom when new messages arrive, unless the user has scrolled up to inspect older messages.

#### C. Typing Banner & Input Bar (`px-4 pb-4 flex-shrink-0`)
- **Typing Status Indicator (`h-5 text-xs text-neutral-400`)**:
  - Displays `"Alice is typing..."` or `"Alice and Bob are typing..."` with animated bouncing dots.
- **Input Field**:
  - Rounded container (`rounded-lg bg-neutral-600/50 px-4 py-2.5`).
  - Placeholder: `"Message #channel-name"`.
  - Supports `Enter` to submit, `Shift + Enter` for new lines.

---

### Column 4: Member List Sidebar (`w-60 flex-shrink-0`, Collapsible)
- **Role Categorization**: Grouped into `ONLINE — N` and `OFFLINE — N`.
- **Member Row**:
  - Avatar with **Status Dot** in the bottom-right corner:
    - `🟢 Green`: User currently has an active WebSocket session.
    - `⚪ Grey`: User is offline.
  - Username and role badge (e.g., `Owner`, `Admin`).

---

## 4. Mapping WebSocket Events to UI State

| UI Element | Triggering WebSocket Event | Local React State Updated |
| :--- | :--- | :--- |
| **Connection Pill** | `connect` / `disconnect` | `isConnected: boolean` |
| **Active Chat Feed** | `message:new` | `messages: Message[]` |
| **Optimistic Message** | `message:send` ACK callback | Replaces temporary `tempId` with database `id` |
| **Typing Banner** | `channel:typing` | `typingUsers: Set<string>` (with 3-second debounce) |
| **Member Status Dots** | `user:status_change` | `members: Member[]` (`status: "online" \| "offline"`) |
| **Channel Unread Dot** | `group:message_created` | `unreadChannels: Set<number>` |
| **Active Room Scope** | Channel switch | Emits `channel:leave` (old) & `channel:join` (new) |

---

## 5. Responsive Behavior (Mobile / Small Screens)

- **Desktop (`>= 1024px`)**: Full 4-column layout displayed simultaneously.
- **Tablet (`768px - 1023px`)**: Member list (Column 4) is hidden by default and opens as an overlay drawer when the Person icon is toggled.
- **Mobile (`< 768px`)**:
  - Main Chat takes 100% viewport width (`100vw`).
  - Hamburger menu opens Columns 1 & 2 as a slide-out navigation sheet.
