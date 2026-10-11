import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useSocketStore } from "./useSocketStore.ts";

type ListenerCallback = (...args: unknown[]) => void;

const listeners = new Map<string, ListenerCallback[]>();

const mockSocket = {
  on: (event: string, callback: ListenerCallback) => {
    const handlers = listeners.get(event) ?? [];
    handlers.push(callback);
    listeners.set(event, handlers);
    return mockSocket;
  },
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

vi.mock("socket.io-client", () => ({
  io: () => mockSocket,
}));

const triggerSocketEvent = (event: string, payload: unknown) => {
  const handlers = listeners.get(event) ?? [];
  for (const handler of handlers) {
    handler(payload);
  }
};

describe("useSocketStore - Unread Channels & Typing Lifecycle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useSocketStore.getState().disconnect();
    useSocketStore.getState().connect("test-token", queryClient);
  });

  afterEach(() => {
    useSocketStore.getState().disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("marks channel as unread when message arrives in non-active channel", () => {
    useSocketStore.getState().setActiveChannel("channel-1");

    triggerSocketEvent("message:created", {
      channelId: "channel-2",
      groupId: "group-1",
      message: {
        id: "msg-1",
        content: "Hello",
        channelId: "channel-2",
        userId: "alice",
        createdAt: new Date().toISOString(),
      },
    });

    const state = useSocketStore.getState();
    expect(state.unreadChannelIds.has("channel-2")).toBe(true);
    expect(state.unreadGroupChannels["group-1"]?.has("channel-2")).toBe(true);
  });

  it("does not mark active channel as unread upon message arrival", () => {
    useSocketStore.getState().setActiveChannel("channel-1");

    triggerSocketEvent("message:created", {
      channelId: "channel-1",
      groupId: "group-1",
      message: {
        id: "msg-2",
        content: "Active message",
        channelId: "channel-1",
        userId: "alice",
        createdAt: new Date().toISOString(),
      },
    });

    const state = useSocketStore.getState();
    expect(state.unreadChannelIds.has("channel-1")).toBe(false);
  });

  it("dismisses unread state when switching active channel", () => {
    useSocketStore.getState().setActiveChannel("channel-1");

    triggerSocketEvent("message:created", {
      channelId: "channel-2",
      groupId: "group-1",
      message: {
        id: "msg-3",
        content: "Unread alert",
        channelId: "channel-2",
        userId: "bob",
        createdAt: new Date().toISOString(),
      },
    });

    expect(useSocketStore.getState().unreadChannelIds.has("channel-2")).toBe(
      true,
    );

    useSocketStore.getState().setActiveChannel("channel-2");

    const state = useSocketStore.getState();
    expect(state.unreadChannelIds.has("channel-2")).toBe(false);
    expect(state.unreadGroupChannels["group-1"]).toBeUndefined();
  });

  it("dismisses unread state via markChannelAsRead", () => {
    useSocketStore.getState().setActiveChannel("channel-1");

    triggerSocketEvent("message:created", {
      channelId: "channel-3",
      groupId: "group-1",
      message: {
        id: "msg-4",
        content: "Notice",
        channelId: "channel-3",
        userId: "alice",
        createdAt: new Date().toISOString(),
      },
    });

    expect(useSocketStore.getState().unreadChannelIds.has("channel-3")).toBe(
      true,
    );

    useSocketStore.getState().markChannelAsRead("channel-3");

    const state = useSocketStore.getState();
    expect(state.unreadChannelIds.has("channel-3")).toBe(false);
  });

  it("automatically removes typing user after 3 seconds without typing:stop (ghost typing prevention)", () => {
    triggerSocketEvent("user:typing", {
      groupId: "group-1",
      channelId: "channel-1",
      userId: "alice",
      isTyping: true,
    });

    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(true);

    vi.advanceTimersByTime(2999);
    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(true);

    vi.advanceTimersByTime(1);
    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(false);
  });

  it("immediately removes typing user on receiving typing:stop", () => {
    triggerSocketEvent("user:typing", {
      groupId: "group-1",
      channelId: "channel-1",
      userId: "alice",
      isTyping: true,
    });

    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(true);

    triggerSocketEvent("user:typing", {
      groupId: "group-1",
      channelId: "channel-1",
      userId: "alice",
      isTyping: false,
    });

    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(false);
  });

  it("immediately removes typing indicator when a message from typing user arrives", () => {
    triggerSocketEvent("user:typing", {
      groupId: "group-1",
      channelId: "channel-1",
      userId: "alice",
      isTyping: true,
    });

    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(true);

    triggerSocketEvent("message:created", {
      channelId: "channel-1",
      groupId: "group-1",
      message: {
        id: "msg-5",
        content: "Done typing",
        channelId: "channel-1",
        userId: "alice",
        createdAt: new Date().toISOString(),
      },
    });

    expect(
      useSocketStore.getState().typingUsers["channel-1"]?.has("alice"),
    ).toBe(false);
  });
});
