// components/chat/ConversationList.tsx — your saved conversations, newest
// activity first.
"use client";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConversationList({ activeId, onNavigate }: { activeId?: string; onNavigate?: () => void }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.listConversations,
    {},
    { initialNumItems: 30 },
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b px-3">
        <Link href="/chat" onClick={onNavigate} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <PlusIcon className="size-4" />
          New chat
        </Link>
      </div>
      <p className="px-5 pb-1.5 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Recent
      </p>
      <nav aria-label="Conversations" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {results.length === 0 && status !== "LoadingFirstPage" && (
          <p className="px-2 py-1 text-sm text-muted-foreground">No conversations yet.</p>
        )}
        {results.map((c) => (
          <Link
            key={c._id}
            href={`/chat/${c._id}`}
            onClick={onNavigate}
            aria-current={c._id === activeId ? "page" : undefined}
            className={cn(
              "block truncate rounded-lg px-2.5 py-2 text-sm transition-colors",
              c._id === activeId
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {c.title}
          </Link>
        ))}
        {status === "CanLoadMore" && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => loadMore(30)}>
            Load more
          </Button>
        )}
      </nav>
    </div>
  );
}
