// app/(app)/chat/[id]/page.tsx — a saved conversation.
import { ChatScreen } from "@/components/chat/ChatScreen";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatScreen conversationId={id} />;
}
