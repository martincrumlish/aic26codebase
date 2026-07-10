// components/admin/SignupLinksCard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = {
  _id: string; token: string; email?: string;
  targetRole: "operator" | "creator" | "member";
  usedCount: number; createdAt: number;
};
let rows: Row[] | undefined;
const revoke = vi.fn(() => Promise.resolve(null));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => rows),
  useMutation: vi.fn(() => revoke),
}));

import { SignupLinksCard } from "./SignupLinksCard";

beforeEach(() => revoke.mockClear());

describe("SignupLinksCard", () => {
  test("lists each active link with its join URL and signup count", () => {
    rows = [
      { _id: "t1", token: "tok-aaa", targetRole: "creator", usedCount: 3, createdAt: 1 },
      { _id: "t2", token: "tok-bbb", email: "locked@x.com", targetRole: "creator", usedCount: 0, createdAt: 2 },
    ];
    render(<SignupLinksCard />);
    expect(screen.getByDisplayValue(/\/join\/tok-aaa$/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/join\/tok-bbb$/)).toBeInTheDocument();
    expect(screen.getByText(/3 signups/i)).toBeInTheDocument();
    expect(screen.getByText(/locked@x\.com/)).toBeInTheDocument();
  });

  test("revoking a link calls the mutation with its id", async () => {
    rows = [{ _id: "t1", token: "tok-aaa", targetRole: "creator", usedCount: 0, createdAt: 1 }];
    render(<SignupLinksCard />);
    await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
    expect(revoke).toHaveBeenCalledWith({ tokenId: "t1" });
  });

  test("shows an empty state when there are no active links", () => {
    rows = [];
    render(<SignupLinksCard />);
    expect(screen.getByText(/no active signup links/i)).toBeInTheDocument();
  });
});
