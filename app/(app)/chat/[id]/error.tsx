"use client";
// app/(app)/chat/[id]/error.tsx — shown when the URL isn't a valid
// conversation id at all. A valid id that's gone or not yours is handled
// inside ChatThread.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ChatError() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
      <h1 className="text-xl font-semibold">Conversation not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The link may be wrong.</p>
      <Link href="/chat" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        New chat
      </Link>
    </div>
  );
}
