// components/chat/ChatScreen.tsx — the chat layout: conversation list beside
// the thread from tablet width up; on phones the list slides in from a
// "Chats" button.
"use client";
import { useState } from "react";
import { MessagesSquareIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

export function ChatScreen({ conversationId }: { conversationId?: string }) {
  const [listOpen, setListOpen] = useState(false);

  const chatsButton = (
    <Sheet open={listOpen} onOpenChange={setListOpen}>
      <SheetTrigger
        aria-label="Show conversations"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <MessagesSquareIcon className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="pt-10">
        <SheetTitle className="sr-only">Conversations</SheetTitle>
        <ConversationList activeId={conversationId} onNavigate={() => setListOpen(false)} />
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <ConversationList activeId={conversationId} />
      </aside>
      <div className="min-w-0 flex-1">
        {/* key: a fresh thread (empty composer, default model) per conversation */}
        <ChatThread key={conversationId ?? "new"} conversationId={conversationId} headerStart={chatsButton} />
      </div>
    </div>
  );
}
