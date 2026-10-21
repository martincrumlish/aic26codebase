// components/admin/UsersTable.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

// One spy per mutation, keyed by function name ("admin:revokeUser", ...), so
// mutations that share the same { userId } argument can be told apart.
const spies: Record<string, ReturnType<typeof vi.fn>> = {};
const spyFor = (name: string) => (spies[name] ??= vi.fn(() => Promise.resolve(null)));

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => [
    { _id: "me", _creationTime: 4, email: "me@x.com", role: "admin", status: "active" },
    { _id: "a2", _creationTime: 3, email: "other-admin@x.com", role: "admin", status: "active" },
    { _id: "u1", _creationTime: 2, email: "amy@x.com", name: "Amy", role: "user", status: "active" },
    { _id: "u2", _creationTime: 1, email: "ben@x.com", name: "Ben", role: "user", status: "revoked" },
  ]),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: vi.fn((ref: any) => spyFor(getFunctionName(ref))),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAction: vi.fn((ref: any) => spyFor(getFunctionName(ref))),
}));

import { UsersTable } from "./UsersTable";

const row = (email: string) => within(screen.getByText(email).closest("tr")!);

beforeEach(() => Object.values(spies).forEach((s) => s.mockClear()));

describe("UsersTable", () => {
  test("your own row has no actions; other admins can only have admin rights removed", () => {
    render(<UsersTable currentUserId="me" />);
    expect(row("me@x.com").queryAllByRole("button")).toHaveLength(0);
    expect(row("me@x.com").getByText(/you/i)).toBeInTheDocument();

    expect(row("other-admin@x.com").getByRole("button", { name: /remove admin/i })).toBeInTheDocument();
    expect(row("other-admin@x.com").queryByRole("button", { name: /revoke|delete/i })).not.toBeInTheDocument();
  });

  test("make admin, remove admin, revoke and restore call the right mutations", async () => {
    render(<UsersTable currentUserId="me" />);
    await userEvent.click(row("amy@x.com").getByRole("button", { name: /make admin/i }));
    expect(spies["admin:setUserRole"]).toHaveBeenCalledWith({ userId: "u1", role: "admin" });

    await userEvent.click(row("other-admin@x.com").getByRole("button", { name: /remove admin/i }));
    expect(spies["admin:setUserRole"]).toHaveBeenCalledWith({ userId: "a2", role: "user" });

    await userEvent.click(row("amy@x.com").getByRole("button", { name: /revoke/i }));
    expect(spies["admin:revokeUser"]).toHaveBeenCalledWith({ userId: "u1" });

    await userEvent.click(row("ben@x.com").getByRole("button", { name: /restore/i }));
    expect(spies["admin:restoreUser"]).toHaveBeenCalledWith({ userId: "u2" });
  });

  test("set password opens a dialog and calls setUserPassword for that user", async () => {
    render(<UsersTable currentUserId="me" />);
    const user = userEvent.setup();
    await user.click(row("amy@x.com").getByRole("button", { name: /set password/i }));
    await user.type(screen.getByLabelText(/^new password$/i), "admin-chosen-pw");
    await user.click(screen.getByRole("button", { name: /^save password$/i }));
    expect(spies["admin:setUserPassword"]).toHaveBeenCalledWith({
      userId: "u1",
      password: "admin-chosen-pw",
    });
  });

  test("other admins have no set-password action", () => {
    render(<UsersTable currentUserId="me" />);
    expect(
      row("other-admin@x.com").queryByRole("button", { name: /set password/i }),
    ).not.toBeInTheDocument();
  });

  test("delete is gated by typing the email, then calls deleteUserAccount", async () => {
    render(<UsersTable currentUserId="me" />);
    const user = userEvent.setup();
    await user.click(row("amy@x.com").getByRole("button", { name: /^delete$/i }));
    const confirmBtn = screen.getByRole("button", { name: /delete forever/i });
    expect(confirmBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/type the email/i), "amy@x.com");
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);
    expect(spies["admin:deleteUserAccount"]).toHaveBeenCalledWith({ userId: "u1" });
  });
});
