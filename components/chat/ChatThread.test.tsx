// components/chat/ChatThread.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { AI_MODELS, DEFAULT_MODEL } from "@/convex/lib/aiModels";

type Msg = { _id: string; role: "user" | "assistant"; content: string; status: "streaming" | "done" | "error"; error?: string };
let messages: Msg[] = [];
let conversation: { _id: string; title: string; model: string } | null | undefined;
let aiStatus: { enabled: boolean; source?: "own" | "app"; appKeyNeedsPro?: boolean } | undefined;
const send = vi.fn((_args: unknown) => Promise.resolve({ conversationId: "c_new" }));
const mutations: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: vi.fn((ref: any, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "chat:listMessages") return messages;
    if (name === "chat:getConversation") return conversation;
    if (name === "ai:getAiStatus") return aiStatus;
    throw new Error(`unexpected query ${name}`);
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: vi.fn((ref: any) => {
    const name = getFunctionName(ref);
    if (name === "chat:send") return send;
    return (mutations[name] ??= vi.fn(() => Promise.resolve(null)));
  }),
}));
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ChatThread } from "./ChatThread";

beforeEach(() => {
  messages = [];
  conversation = { _id: "c1", title: "Plans", model: DEFAULT_MODEL };
  aiStatus = { enabled: true, source: "own" };
  send.mockClear();
  replace.mockClear();
  push.mockClear();
  toast.error.mockClear();
});

describe("ChatThread", () => {
  test("shows the conversation, with replies rendered as Markdown", () => {
    messages = [
      { _id: "m1", role: "user", content: "Make it **bold**", status: "done" },
      { _id: "m2", role: "assistant", content: "Here is **bold** text", status: "done" },
    ];
    render(<ChatThread conversationId="c1" />);
    expect(screen.getByText("Make it **bold**")).toBeInTheDocument(); // your text stays as typed
    expect(screen.getByText("bold", { selector: "strong" })).toBeInTheDocument();
  });

  test("a new chat: sending creates it and moves to its page", async () => {
    render(<ChatThread />);
    await userEvent.type(screen.getByLabelText(/message/i), "Hello there");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(send).toHaveBeenCalledWith({ content: "Hello there", model: DEFAULT_MODEL });
    expect(replace).toHaveBeenCalledWith("/chat/c_new");
  });

  test("Enter sends; Shift+Enter adds a new line", async () => {
    render(<ChatThread conversationId="c1" />);
    const box = screen.getByLabelText(/message/i);
    await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(send).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    expect(send).toHaveBeenCalledWith({ conversationId: "c1", content: "line one\nline two", model: DEFAULT_MODEL });
    expect(box).toHaveValue("");
  });

  test("the model picker chooses the model, starting from the conversation's", async () => {
    conversation = { _id: "c1", title: "Plans", model: AI_MODELS[1].id };
    render(<ChatThread conversationId="c1" />);
    const picker = screen.getByLabelText(/model/i);
    expect(picker).toHaveValue(AI_MODELS[1].id);
    await userEvent.selectOptions(picker, AI_MODELS[2].id);
    await userEvent.type(screen.getByLabelText(/message/i), "Hi{Enter}");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ model: AI_MODELS[2].id }));
  });

  test("while a reply streams: shows it's thinking and doesn't allow sending", async () => {
    messages = [
      { _id: "m1", role: "user", content: "Hi", status: "done" },
      { _id: "m2", role: "assistant", content: "", status: "streaming" },
    ];
    render(<ChatThread conversationId="c1" />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/message/i), "Another");
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  test("a failed reply shows why", () => {
    messages = [
      { _id: "m1", role: "user", content: "Hi", status: "done" },
      { _id: "m2", role: "assistant", content: "", status: "error", error: "The OpenRouter account is out of credits." },
    ];
    render(<ChatThread conversationId="c1" />);
    expect(screen.getByText(/out of credits/i)).toBeInTheDocument();
  });

  test("a send error (e.g. from the server) is shown and the text kept", async () => {
    send.mockRejectedValueOnce(new (await import("convex/values")).ConvexError("Still replying."));
    render(<ChatThread conversationId="c1" />);
    await userEvent.type(screen.getByLabelText(/message/i), "Keep me{Enter}");
    expect(toast.error).toHaveBeenCalledWith("Still replying.");
    expect(screen.getByLabelText(/message/i)).toHaveValue("Keep me");
  });

  test("AI off on Free: explains, links to Settings and Pricing, and hides the composer", () => {
    aiStatus = { enabled: false, appKeyNeedsPro: true };
    render(<ChatThread />);
    expect(screen.getByRole("link", { name: /add your key/i })).toHaveAttribute("href", "/settings/ai");
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument();
  });

  test("a conversation that's gone (or not yours) says so", () => {
    conversation = null;
    render(<ChatThread conversationId="c1" />);
    expect(screen.getByText(/conversation not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new chat/i })).toHaveAttribute("href", "/chat");
  });

  test("delete asks first, then goes back to a new chat", async () => {
    render(<ChatThread conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: /delete conversation/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(mutations["chat:remove"]).toHaveBeenCalledWith({ conversationId: "c1" });
    expect(push).toHaveBeenCalledWith("/chat");
  });
});
