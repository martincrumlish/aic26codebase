// convex/chat.ts — AI chat with saved conversations.
//
// How a reply streams:
//   1. `send` (mutation) saves your message plus an empty assistant message
//      with status "streaming", and schedules `generate`.
//   2. `generate` (action) calls OpenRouter with `stream: true` and writes the
//      growing reply into that message a few times a second.
//   3. The page's `listMessages` query is reactive, so the reply appears live,
//      in every open tab, with no streaming code in the browser.
//
// Which key pays: lib/aiKey.ts (the user's own key, else the app key if their
// plan includes it). Which models: lib/aiModels.ts.
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./access";
import { resolveOpenRouterKey } from "./lib/aiKey";
import { isAllowedModel } from "./lib/aiModels";

// Change this to give the assistant your product's voice and knowledge.
const SYSTEM_PROMPT = "You are a helpful assistant. Answer clearly and concisely. Use Markdown when it helps.";

const MAX_MESSAGE = 8000; // characters per message you send
const HISTORY = 40; // earlier messages sent as context
const SHOWN = 200; // messages shown per conversation
const FLUSH_MS = 250; // how often a streaming reply is written
const STALE_MS = 5 * 60 * 1000; // a reply still "streaming" after this is treated as dead
const PURGE_BATCH = 200;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** For writes: the caller's own conversation, or "Conversation not found". */
async function ownConversation(ctx: QueryCtx | MutationCtx, conversationId: Id<"conversations">) {
  const user = await requireUser(ctx);
  const convo = await ctx.db.get(conversationId);
  if (!convo || convo.ownerId !== user._id) throw new ConvexError("Conversation not found.");
  return convo;
}

/** For reads: the caller's own conversation, or null. */
async function readableConversation(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const user = await requireUser(ctx);
  const convo = await ctx.db.get(conversationId);
  return convo && convo.ownerId === user._id ? convo : null;
}

function titleFrom(content: string) {
  const firstLine = content.split("\n")[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

function noKeyMessage(appKeyNeedsPro: boolean) {
  return appKeyNeedsPro
    ? "To use AI chat, add your own OpenRouter key in Settings, or upgrade to Pro to use the built-in AI."
    : "AI chat isn't set up yet. Add your own OpenRouter key in Settings.";
}

function httpErrorMessage(status: number) {
  if (status === 401) return "OpenRouter rejected the API key. Check it in Settings > AI.";
  if (status === 402) return "The OpenRouter account is out of credits. Add credits at openrouter.ai.";
  if (status === 429) return "Too many requests right now. Wait a moment and try again.";
  if (status === 400 || status === 404) return "OpenRouter couldn't use that model. Pick another one and try again.";
  return `OpenRouter had a problem (status ${status}). Try again.`;
}

const Message = v.object({
  _id: v.id("chatMessages"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
  error: v.optional(v.string()),
});

const ConversationSummary = v.object({
  _id: v.id("conversations"),
  _creationTime: v.number(),
  title: v.string(),
  model: v.string(),
  updatedAt: v.number(),
});

function summary(c: Doc<"conversations">) {
  return { _id: c._id, _creationTime: c._creationTime, title: c.title, model: c.model, updatedAt: c.updatedAt };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const listConversations = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(ConversationSummary),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const result = await ctx.db
      .query("conversations")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(summary) };
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  returns: v.union(v.object({ _id: v.id("conversations"), title: v.string(), model: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const convo = await readableConversation(ctx, args.conversationId);
    return convo ? { _id: convo._id, title: convo.title, model: convo.model } : null;
  },
});

/** The latest messages, oldest first. Empty for a conversation that isn't yours. */
export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(Message),
  handler: async (ctx, args) => {
    const convo = await readableConversation(ctx, args.conversationId);
    if (!convo) return [];
    const latest = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
      .order("desc")
      .take(SHOWN);
    return latest.reverse().map((m) => ({
      _id: m._id,
      role: m.role,
      content: m.content,
      status: m.status,
      error: m.error,
    }));
  },
});

// ── Writes ───────────────────────────────────────────────────────────────────

/** Send a message (starting a new conversation if no id is given). */
export const send = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    content: v.string(),
    model: v.string(),
  },
  returns: v.object({ conversationId: v.id("conversations") }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const content = args.content.trim();
    if (!content) throw new ConvexError("Type a message first.");
    if (content.length > MAX_MESSAGE) {
      throw new ConvexError(`Keep messages under ${MAX_MESSAGE.toLocaleString("en-US")} characters.`);
    }
    if (!isAllowedModel(args.model)) throw new ConvexError("That model isn't available.");
    const resolved = await resolveOpenRouterKey(ctx, user._id);
    if (resolved.key === null) throw new ConvexError(noKeyMessage(resolved.appKeyNeedsPro));

    const now = Date.now();
    let conversationId = args.conversationId;
    if (conversationId) {
      const convo = await ownConversation(ctx, conversationId);
      const last = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
        .order("desc")
        .first();
      if (last?.status === "streaming" && now - last._creationTime < STALE_MS) {
        throw new ConvexError("Still replying. Wait for it to finish, then send again.");
      }
      await ctx.db.patch(convo._id, { model: args.model, updatedAt: now });
    } else {
      conversationId = await ctx.db.insert("conversations", {
        ownerId: user._id,
        title: titleFrom(content),
        model: args.model,
        updatedAt: now,
      });
    }

    await ctx.db.insert("chatMessages", {
      conversationId, ownerId: user._id, role: "user", content, status: "done",
    });
    const replyId = await ctx.db.insert("chatMessages", {
      conversationId, ownerId: user._id, role: "assistant", content: "", status: "streaming",
    });
    await ctx.scheduler.runAfter(0, internal.chat.generate, { messageId: replyId });
    return { conversationId };
  },
});

export const rename = mutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownConversation(ctx, args.conversationId);
    const title = args.title.trim();
    if (!title) throw new ConvexError("A conversation needs a title.");
    await ctx.db.patch(args.conversationId, { title: title.slice(0, 100) });
    return null;
  },
});

export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownConversation(ctx, args.conversationId);
    await ctx.db.delete(args.conversationId);
    // Messages are deleted in batches (a long chat can have thousands).
    await ctx.scheduler.runAfter(0, internal.chat.purge, { conversationId: args.conversationId });
    return null;
  },
});

// ── Generating a reply (internal) ────────────────────────────────────────────

/** What `generate` needs: the key, model, and history. Null if there's nothing to do. */
export const generationInput = internalQuery({
  args: { messageId: v.id("chatMessages") },
  returns: v.union(
    v.object({
      key: v.union(v.string(), v.null()),
      model: v.string(),
      messages: v.array(v.object({ role: v.string(), content: v.string() })),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get(args.messageId);
    if (!reply || reply.status !== "streaming") return null;
    const convo = await ctx.db.get(reply.conversationId);
    if (!convo) return null;
    const earlier = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
      .order("desc")
      .take(HISTORY + 1);
    const history = earlier
      .filter((m) => m._id !== reply._id && m.status === "done")
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));
    return {
      key: (await resolveOpenRouterKey(ctx, reply.ownerId)).key,
      model: convo.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    };
  },
});

/** Write the reply so far. Returns false if it was deleted (stop streaming). */
export const writeReply = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
    error: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const reply = await ctx.db.get(args.messageId);
    if (!reply) return false;
    await ctx.db.patch(args.messageId, { content: args.content, status: args.status, error: args.error });
    if (args.status !== "streaming") {
      const convo = await ctx.db.get(reply.conversationId);
      if (convo) await ctx.db.patch(convo._id, { updatedAt: Date.now() });
    }
    return true;
  },
});

export const generate = internalAction({
  args: { messageId: v.id("chatMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }): Promise<null> => {
    const input = await ctx.runQuery(internal.chat.generationInput, { messageId });
    if (!input) return null;

    let content = "";
    const write = (status: "streaming" | "done" | "error", error?: string): Promise<boolean> =>
      ctx.runMutation(internal.chat.writeReply, { messageId, content, status, error });

    if (!input.key) {
      await write("error", "AI isn't available on your account right now. Check Settings > AI.");
      return null;
    }

    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.key}`,
          "Content-Type": "application/json",
          // Optional: shows your app in OpenRouter's usage dashboard.
          ...(process.env.SITE_URL ? { "HTTP-Referer": process.env.SITE_URL } : {}),
        },
        body: JSON.stringify({ model: input.model, messages: input.messages, stream: true }),
      });
    } catch {
      await write("error", "Couldn't reach OpenRouter. Check your connection and try again.");
      return null;
    }
    if (!res.ok || !res.body) {
      await write("error", httpErrorMessage(res.status));
      return null;
    }

    // Server-sent events: lines of `data: {json}`, `: comment` keep-alives,
    // and a final `data: [DONE]`. Chunks can split a line, so buffer.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastWrite = Date.now();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          let event: { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }
          if (event.error) {
            await write("error", event.error.message ?? "The model stopped with an error. Try again.");
            return null;
          }
          content += event.choices?.[0]?.delta?.content ?? "";
        }
        if (Date.now() - lastWrite >= FLUSH_MS) {
          lastWrite = Date.now();
          if (!(await write("streaming"))) {
            await reader.cancel(); // the conversation was deleted
            return null;
          }
        }
      }
    } catch {
      await write("error", "The reply was cut off. Try again.");
      return null;
    }

    if (!content) await write("error", "The model sent back an empty reply. Try again or pick another model.");
    else await write("done");
    return null;
  },
});

// ── Cleanup (internal) ───────────────────────────────────────────────────────

/** Delete a conversation's messages, or everything a user has, in batches. */
export const purge = internalMutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    ownerId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { conversationId, ownerId } = args;
    const messages = conversationId
      ? await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
          .take(PURGE_BATCH)
      : ownerId
        ? await ctx.db
            .query("chatMessages")
            .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
            .take(PURGE_BATCH)
        : [];
    for (const m of messages) await ctx.db.delete(m._id);
    if (messages.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.chat.purge, args);
      return null;
    }
    if (ownerId) {
      const convos = await ctx.db
        .query("conversations")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .take(PURGE_BATCH);
      for (const c of convos) await ctx.db.delete(c._id);
      if (convos.length === PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.chat.purge, args);
    }
    return null;
  },
});
