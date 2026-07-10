// components/admin/CreatorsTable.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

// One shared mutation spy stands in for BOTH revokeCreator and deleteUserAccount;
// the call ARGUMENTS distinguish them ({ creatorId } vs { userId }).
const mut = vi.fn(() => Promise.resolve(null));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => [
    { _id: "c1", _creationTime: 1, email: "a@x.com", name: "Amy", role: "creator", status: "active" },
    { _id: "c2", _creationTime: 2, email: "b@x.com", name: "Ben", role: "creator", status: "revoked" },
  ]),
  useMutation: vi.fn(() => mut),
}));

import { CreatorsTable } from "./CreatorsTable";

beforeEach(() => mut.mockClear());

describe("CreatorsTable", () => {
  test("lists creators and revokes an active one", async () => {
    render(<CreatorsTable />);
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
    // Only the active creator (c1) has an enabled Revoke button.
    const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);
    expect(mut).toHaveBeenCalledWith({ creatorId: "c1" });
  });

  test("delete is gated by typing the email, then calls deleteUserAccount with the userId", async () => {
    render(<CreatorsTable />);
    const user = userEvent.setup();
    // Open the confirm dialog for the first creator.
    await user.click(screen.getAllByRole("button", { name: /^delete$/i })[0]);
    const confirmBtn = screen.getByRole("button", { name: /delete forever/i });
    // Disabled until the exact email is typed.
    expect(confirmBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/type the email/i), "a@x.com");
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);
    expect(mut).toHaveBeenCalledWith({ userId: "c1" });
  });
});
