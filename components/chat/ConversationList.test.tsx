// components/chat/ConversationList.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

let results: { _id: string; title: string }[] = [];
let status = "Exhausted";
const loadMore = vi.fn();
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  usePaginatedQuery: vi.fn(() => ({ results, status, loadMore })),
}));

import { ConversationList } from "./ConversationList";

describe("ConversationList", () => {
  test("lists conversations linking to them, marks the open one, and offers New chat", () => {
    results = [
      { _id: "c1", title: "Trip plan" },
      { _id: "c2", title: "Email draft" },
    ];
    render(<ConversationList activeId="c2" />);
    expect(screen.getByRole("link", { name: /new chat/i })).toHaveAttribute("href", "/chat");
    expect(screen.getByRole("link", { name: "Trip plan" })).toHaveAttribute("href", "/chat/c1");
    expect(screen.getByRole("link", { name: "Email draft" })).toHaveAttribute("aria-current", "page");
  });

  test("empty, and Load more when there are more", async () => {
    results = [];
    status = "CanLoadMore";
    render(<ConversationList />);
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });
});
