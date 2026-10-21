// convex/chat.test.ts — AI chat: saved conversations, replies streamed from
// OpenRouter into the database (so every open tab sees them live).
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makePro, registerStripe, stubStripeApi, stubStripeEnv } from "../vitest/stripe";
import { DEFAULT_MODEL } from "./lib/aiModels";

const modules = import.meta.glob("./**/*.ts");
type T = TestConvex<typeof schema>;

function setupT() {
  const t = convexTest(schema, modules);
  registerStripe(t);
  return t;
}

async function makeUser(t: T, email: string, role: "admin" | "user" = "user") {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, role, status: "active", createdVia: "seed", createdAt: Date.now() }),
  );
}

async function giveOwnKey(t: T, userId: Id<"users">, key = "sk-or-v1-own-1234") {
  await t.run((ctx) =>
    ctx.db.insert("userApiKeys", { userId, provider: "openrouter", key, last4: key.slice(-4), createdAt: Date.now() }),
  );
}

/** An OpenRouter streaming response: SSE `data:` lines, a keep-alive comment, then [DONE]. */
function sse(chunks: string[]) {
  const lines = [
    ": OPENROUTER PROCESSING",
    ...chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`),
    "data: [DONE]",
  ];
  // Split mid-line on purpose: real streams don't break on line boundaries.
  const text = lines.join("\n\n") + "\n\n";
  const mid = Math.floor(text.length / 2);
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(text.slice(0, mid)));
        c.enqueue(enc.encode(text.slice(mid)));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

type FetchCall = { url: string; init: RequestInit };
function stubOpenRouterChat(respond: () => Response) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return respond();
    }),
  );
  return calls;
}

/** Run the scheduled reply generation to completion. */
async function settle(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("OPENROUTER_API_KEY", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("chat: sending and streaming", () => {
  test("first message creates a conversation titled from it, and the reply streams in", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    const calls = stubOpenRouterChat(() => sse(["Hel", "lo ", "there!"]));

    const { conversationId } = await amy.mutation(api.chat.send, {
      content: "  Plan my week\nwith some detail ",
      model: DEFAULT_MODEL,
    });

    // Immediately: your message plus an empty reply marked as streaming.
    let messages = await amy.query(api.chat.listMessages, { conversationId });
    expect(messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ["user", "Plan my week\nwith some detail", "done"],
      ["assistant", "", "streaming"],
    ]);
    expect(await amy.query(api.chat.getConversation, { conversationId })).toMatchObject({
      title: "Plan my week",
      model: DEFAULT_MODEL,
    });

    await settle(t);
    messages = await amy.query(api.chat.listMessages, { conversationId });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "Hello there!", status: "done" });

    // Sent to OpenRouter with the user's own key, the model, and the history.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer sk-or-v1-own-1234" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: DEFAULT_MODEL, stream: true });
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Plan my week\nwith some detail" });
  });

  test("follow-ups send the earlier turns as context", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    const calls = stubOpenRouterChat(() => sse(["First answer"]));
    const { conversationId } = await amy.mutation(api.chat.send, { content: "Q1", model: DEFAULT_MODEL });
    await settle(t);

    await amy.mutation(api.chat.send, { conversationId, content: "Q2", model: DEFAULT_MODEL });
    await settle(t);
    const sent = JSON.parse(String(calls[1].init.body)).messages.filter(
      (m: { role: string }) => m.role !== "system",
    );
    expect(sent).toEqual([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Q2" },
    ]);
  });

  test("can't send again while a reply is still streaming", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    stubOpenRouterChat(() => sse(["ok"]));
    const { conversationId } = await amy.mutation(api.chat.send, { content: "Q1", model: DEFAULT_MODEL });
    await expect(
      amy.mutation(api.chat.send, { conversationId, content: "Q2", model: DEFAULT_MODEL }),
    ).rejects.toThrow(/still replying/i);
  });

  test("an OpenRouter error is shown on the reply instead of hanging", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    stubOpenRouterChat(() => new Response('{"error":{"message":"no credits"}}', { status: 402 }));

    const { conversationId } = await amy.mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });
    await settle(t);
    const [, reply] = await amy.query(api.chat.listMessages, { conversationId });
    expect(reply.status).toBe("error");
    expect(reply.error).toMatch(/credits/i);

    // ...and the conversation isn't stuck: you can try again.
    stubOpenRouterChat(() => sse(["Now it works"]));
    await amy.mutation(api.chat.send, { conversationId, content: "Retry", model: DEFAULT_MODEL });
    await settle(t);
    const messages = await amy.query(api.chat.listMessages, { conversationId });
    expect(messages.at(-1)).toMatchObject({ content: "Now it works", status: "done" });
  });

  test("rejects empty messages and models that aren't on the list", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    await expect(amy.mutation(api.chat.send, { content: "   ", model: DEFAULT_MODEL })).rejects.toThrow(
      /type a message/i,
    );
    await expect(
      amy.mutation(api.chat.send, { content: "Hi", model: "openai/some-very-expensive-model" }),
    ).rejects.toThrow(/model isn't available/i);
  });
});

describe("chat: which key pays", () => {
  test("Free users without their own key are told how to turn AI on", async () => {
    const t = setupT();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app");
    const amy = t.withIdentity({ subject: await makeUser(t, "amy@x.com") });
    await expect(amy.mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL })).rejects.toThrow(
      /your own OpenRouter key.*or upgrade to Pro/i,
    );
  });

  test("Pro users without their own key use the app's key", async () => {
    const t = setupT();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-app");
    const userId = await makeUser(t, "pro@x.com");
    stubStripeEnv();
    stubStripeApi();
    await makePro(t, userId);
    const calls = stubOpenRouterChat(() => sse(["Hi!"]));

    await t.withIdentity({ subject: userId }).mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });
    await settle(t);
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer sk-or-app" });
  });
});

describe("chat: conversations are private", () => {
  test("someone else's conversation looks like a missing one", async () => {
    const t = setupT();
    const amyId = await makeUser(t, "amy@x.com");
    const benId = await makeUser(t, "ben@x.com");
    await giveOwnKey(t, amyId);
    await giveOwnKey(t, benId);
    const amy = t.withIdentity({ subject: amyId });
    const ben = t.withIdentity({ subject: benId });
    stubOpenRouterChat(() => sse(["secret answer"]));
    const { conversationId } = await amy.mutation(api.chat.send, { content: "secret", model: DEFAULT_MODEL });
    await settle(t);

    expect(await ben.query(api.chat.getConversation, { conversationId })).toBeNull();
    expect(await ben.query(api.chat.listMessages, { conversationId })).toEqual([]);
    await expect(
      ben.mutation(api.chat.send, { conversationId, content: "let me in", model: DEFAULT_MODEL }),
    ).rejects.toThrow(/conversation not found/i);
    await expect(ben.mutation(api.chat.remove, { conversationId })).rejects.toThrow(/conversation not found/i);
    const bensList = await ben.query(api.chat.listConversations, { paginationOpts: { numItems: 10, cursor: null } });
    expect(bensList.page).toEqual([]);
  });

  test("signed-out callers are rejected", async () => {
    const t = setupT();
    await expect(t.mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL })).rejects.toThrow(
      /not signed in/i,
    );
  });
});

describe("chat: managing conversations", () => {
  test("lists your conversations, most recently active first", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    stubOpenRouterChat(() => sse(["ok"]));
    const a = await amy.mutation(api.chat.send, { content: "Alpha", model: DEFAULT_MODEL });
    await settle(t);
    vi.advanceTimersByTime(1000);
    await amy.mutation(api.chat.send, { content: "Beta", model: DEFAULT_MODEL });
    await settle(t);
    vi.advanceTimersByTime(1000);
    await amy.mutation(api.chat.send, { conversationId: a.conversationId, content: "Alpha again", model: DEFAULT_MODEL });
    await settle(t);

    const list = await amy.query(api.chat.listConversations, { paginationOpts: { numItems: 10, cursor: null } });
    expect(list.page.map((c) => c.title)).toEqual(["Alpha", "Beta"]);
  });

  test("rename and delete (messages go too)", async () => {
    const t = setupT();
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    const amy = t.withIdentity({ subject: userId });
    stubOpenRouterChat(() => sse(["ok"]));
    const { conversationId } = await amy.mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });
    await settle(t);

    await amy.mutation(api.chat.rename, { conversationId, title: "Renamed" });
    expect((await amy.query(api.chat.getConversation, { conversationId }))?.title).toBe("Renamed");

    await amy.mutation(api.chat.remove, { conversationId });
    await settle(t);
    expect(await amy.query(api.chat.getConversation, { conversationId })).toBeNull();
    const left = await t.run((ctx) => ctx.db.query("chatMessages").take(10));
    expect(left).toEqual([]);
  });

  test("deleting a user deletes their conversations and messages", async () => {
    const t = setupT();
    stubStripeEnv();
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const adminId = await makeUser(t, "admin@x.com", "admin");
    const userId = await makeUser(t, "amy@x.com");
    await giveOwnKey(t, userId);
    stubOpenRouterChat(() => sse(["ok"]));
    await t.withIdentity({ subject: userId }).mutation(api.chat.send, { content: "Hi", model: DEFAULT_MODEL });
    await settle(t);

    stubStripeApi();
    await t.withIdentity({ subject: adminId }).mutation(api.admin.deleteUserAccount, { userId });
    await settle(t);
    expect(await t.run((ctx) => ctx.db.query("conversations").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("chatMessages").take(10))).toEqual([]);
  });
});
