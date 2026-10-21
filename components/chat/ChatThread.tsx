// components/chat/ChatThread.tsx — one conversation: messages, the composer,
// and the model picker. With no conversationId it's a new chat, and the first
// message creates the conversation.
//
// There's no streaming code here: the server writes the reply into the
// database as it arrives, and `useQuery(listMessages)` re-renders with it.
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AI_MODELS, DEFAULT_MODEL } from "@/convex/lib/aiModels";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "./Markdown";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ConvexError ? (err.data as string) : fallback;

export function ChatThread({
  conversationId: id,
  headerStart,
}: {
  conversationId?: string;
  /** Rendered at the start of the header (the phone layout puts a "Chats" button here). */
  headerStart?: React.ReactNode;
}) {
  const conversationId = id as Id<"conversations"> | undefined;
  const conversation = useQuery(api.chat.getConversation, conversationId ? { conversationId } : "skip");
  const messages = useQuery(api.chat.listMessages, conversationId ? { conversationId } : "skip");
  const aiStatus = useQuery(api.ai.getAiStatus, {});
  const send = useMutation(api.chat.send);
  const rename = useMutation(api.chat.rename);
  const remove = useMutation(api.chat.remove);
  const router = useRouter();

  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const model = picked ?? conversation?.model ?? DEFAULT_MODEL;
  const list = messages ?? [];
  const streaming = list.some((m) => m.status === "streaming");

  // Keep the newest message in view as it streams in.
  const lastContent = list.at(-1)?.content;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [list.length, lastContent]);

  if (aiStatus === undefined || (conversationId && (conversation === undefined || messages === undefined))) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (conversationId && conversation === null) {
    return (
      <div className="flex h-full flex-col">
        {headerStart && <div className="border-b px-3 py-2">{headerStart}</div>}
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold">Conversation not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
          <Link href="/chat" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            New chat
          </Link>
        </div>
      </div>
    );
  }

  async function submit() {
    const content = text.trim();
    if (!content || sending || streaming) return;
    setSending(true);
    try {
      const res = await send(conversationId ? { conversationId, content, model } : { content, model });
      setText("");
      if (!conversationId) router.replace(`/chat/${res.conversationId}`);
    } catch (err) {
      toast.error(errorText(err, "Couldn't send the message."));
    } finally {
      setSending(false);
    }
  }

  async function onRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!conversationId) return;
    const title = String(new FormData(e.currentTarget).get("title") ?? "");
    try {
      await rename({ conversationId, title });
      setRenaming(false);
    } catch (err) {
      toast.error(errorText(err, "Couldn't rename it."));
    }
  }

  async function onDelete() {
    if (!conversationId) return;
    try {
      await remove({ conversationId });
      setConfirmDelete(false);
      router.push("/chat");
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete it."));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        {headerStart}
        <h1 className="min-w-0 flex-1 truncate px-1 font-medium">{conversation?.title ?? "New chat"}</h1>
        {conversation && (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Rename conversation" onClick={() => setRenaming(true)}>
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete conversation" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
            </Button>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {list.length === 0 && (
            <p className="py-16 text-center text-muted-foreground">Ask anything to get started.</p>
          )}
          {list.map((m) =>
            m.role === "user" ? (
              <div key={m._id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m._id} className="text-sm leading-relaxed">
                {m.content ? <Markdown>{m.content}</Markdown> : null}
                {m.status === "streaming" && !m.content && (
                  <p className="animate-pulse text-muted-foreground">Thinking…</p>
                )}
                {m.status === "error" && (
                  <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                    {m.error ?? "Something went wrong."}
                  </p>
                )}
              </div>
            ),
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="border-t p-3">
        <div className="mx-auto max-w-3xl">
          {aiStatus.enabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring"
            >
              <textarea
                aria-label="Message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                rows={2}
                maxLength={8000}
                placeholder="Message the AI (Shift+Enter for a new line)"
                className="block w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <select
                  aria-label="Model"
                  value={model}
                  onChange={(e) => setPicked(e.target.value)}
                  className="min-w-0 rounded-md bg-transparent px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.note}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" disabled={!text.trim() || sending || streaming}>
                  <SendIcon />
                  Send
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              {aiStatus.appKeyNeedsPro ? (
                <p>AI chat is included with Pro. On the Free plan, use your own OpenRouter key.</p>
              ) : (
                <p>AI chat isn&apos;t set up yet. Add your own OpenRouter key to start.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/settings" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Add your key
                </Link>
                {aiStatus.appKeyNeedsPro && (
                  <Link href="/pricing" className={buttonVariants({ size: "sm" })}>
                    Upgrade to Pro
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={onRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chat-title">Title</Label>
              <Input id="chat-title" name="title" defaultValue={conversation?.title} maxLength={100} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <strong className="text-foreground">{conversation?.title}</strong> and all its
            messages.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onDelete()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
