// components/admin/UsersTable.test.tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

// One spy per mutation, keyed by function name ("admin:revokeUser", ...), so
// mutations that share the same { userId } argument can be told apart.
const spies: Record<string, ReturnType<typeof vi.fn>> = {};
const spyFor = (name: string) => (spies[name] ??= vi.fn(() => Promise.resolve(null)));

const USERS = [
  { _id: "me", _creationTime: 4, email: "me@x.com", role: "admin", status: "active" },
  { _id: "a2", _creationTime: 3, email: "other-admin@x.com", role: "admin", status: "active" },
  { _id: "u1", _creationTime: 2, email: "amy@x.com", name: "Amy", role: "user", status: "active" },
  { _id: "u2", _creationTime: 1, email: "ben@x.com", name: "Ben", role: "user", status: "revoked" },
];
let results = USERS;
let status = "Exhausted";
const loadMore = vi.fn();
const paginated = vi.fn((_ref: unknown, _args: unknown) => ({ results, status, loadMore }));

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  usePaginatedQuery: (ref: unknown, args: unknown) => paginated(ref, args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: vi.fn((ref: any) => spyFor(getFunctionName(ref))),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAction: vi.fn((ref: any) => spyFor(getFunctionName(ref))),
}));

import { UsersTable } from "./UsersTable";

const row = (email: string) => within(screen.getByText(email).closest("tr")!);

/** Open a row's actions menu and pick an item. */
async function act(email: string, item: RegExp) {
  await userEvent.click(screen.getByRole("button", { name: `Actions for ${email}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

async function menuItems(email: string) {
  await userEvent.click(screen.getByRole("button", { name: `Actions for ${email}` }));
  await screen.findAllByRole("menuitem");
  return screen.getAllByRole("menuitem").map((m) => m.textContent);
}

beforeEach(() => {
  Object.values(spies).forEach((s) => s.mockClear());
  results = USERS;
  status = "Exhausted";
  loadMore.mockClear();
  paginated.mockClear();
});

describe("UsersTable", () => {
  test("search sends what you type (after a pause), and says when nothing matches", async () => {
    render(<UsersTable currentUserId="me" />);
    await userEvent.type(screen.getByRole("searchbox", { name: /search users/i }), "amy");
    await waitFor(() => expect(paginated).toHaveBeenLastCalledWith(expect.anything(), { search: "amy" }));
  });

  test("says when a search matches nobody", async () => {
    results = [];
    render(<UsersTable currentUserId="me" />);
    await userEvent.type(screen.getByRole("searchbox", { name: /search users/i }), "zed");
    expect(await screen.findByText(/no users match "zed"/i)).toBeInTheDocument();
  });

  test("Load more fetches the next page", async () => {
    status = "CanLoadMore";
    render(<UsersTable currentUserId="me" />);
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalledWith(25);
  });

  test("your own row has no actions; other admins can only have admin rights removed", async () => {
    render(<UsersTable currentUserId="me" />);
    expect(row("me@x.com").queryAllByRole("button")).toHaveLength(0);
    expect(row("me@x.com").getByText(/you/i)).toBeInTheDocument();

    expect(await menuItems("other-admin@x.com")).toEqual(["Remove admin"]);
  });

  test("make admin, remove admin, revoke and restore call the right mutations", async () => {
    render(<UsersTable currentUserId="me" />);
    await act("amy@x.com", /make admin/i);
    expect(spies["admin:setUserRole"]).toHaveBeenCalledWith({ userId: "u1", role: "admin" });

    await act("other-admin@x.com", /remove admin/i);
    expect(spies["admin:setUserRole"]).toHaveBeenCalledWith({ userId: "a2", role: "user" });

    await act("amy@x.com", /revoke/i);
    expect(spies["admin:revokeUser"]).toHaveBeenCalledWith({ userId: "u1" });

    await act("ben@x.com", /restore/i);
    expect(spies["admin:restoreUser"]).toHaveBeenCalledWith({ userId: "u2" });
  });

  test("set password opens a dialog and calls setUserPassword for that user", async () => {
    render(<UsersTable currentUserId="me" />);
    const user = userEvent.setup();
    await act("amy@x.com", /set password/i);
    await user.type(screen.getByLabelText(/^new password$/i), "admin-chosen-pw");
    await user.click(screen.getByRole("button", { name: /^save password$/i }));
    expect(spies["admin:setUserPassword"]).toHaveBeenCalledWith({
      userId: "u1",
      password: "admin-chosen-pw",
    });
  });

  test("other admins have no set-password action", async () => {
    render(<UsersTable currentUserId="me" />);
    expect(await menuItems("other-admin@x.com")).not.toContain("Set password");
  });

  test("delete is gated by typing the email, then calls deleteUserAccount", async () => {
    render(<UsersTable currentUserId="me" />);
    const user = userEvent.setup();
    await act("amy@x.com", /delete account/i);
    const confirmBtn = screen.getByRole("button", { name: /delete forever/i });
    expect(confirmBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/type the email/i), "amy@x.com");
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);
    expect(spies["admin:deleteUserAccount"]).toHaveBeenCalledWith({ userId: "u1" });
  });
});
