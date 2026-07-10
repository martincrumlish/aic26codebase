// components/admin/GenerateCreatorLinkDialog.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

let emailEnabled = false;
const generate = vi.fn(() => Promise.resolve({ token: "tok-123" }));
const sendCreatorInvite = vi.fn(() => Promise.resolve({ sent: true, id: "email_1" }));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => emailEnabled),
  useMutation: vi.fn(() => generate),
  useAction: vi.fn(() => sendCreatorInvite),
}));

import { GenerateCreatorLinkDialog } from "./GenerateCreatorLinkDialog";

beforeEach(() => {
  generate.mockClear();
  sendCreatorInvite.mockClear();
});

async function openDialog() {
  render(<GenerateCreatorLinkDialog />);
  await userEvent.click(screen.getByRole("button", { name: /generate creator link/i }));
}

describe("GenerateCreatorLinkDialog", () => {
  test("hides the email-this-invite option when email is not configured", async () => {
    emailEnabled = false;
    await openDialog();
    expect(screen.queryByLabelText(/email this invite/i)).not.toBeInTheDocument();
  });

  test("creates a link without emailing when the option is unchecked", async () => {
    emailEnabled = true;
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));
    expect(generate).toHaveBeenCalled();
    expect(sendCreatorInvite).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(/\/join\/tok-123$/)).toBeInTheDocument();
  });

  test("emails the invite when checked, using the entered address", async () => {
    emailEnabled = true;
    await openDialog();
    await userEvent.type(screen.getByLabelText(/^email \(optional/i), "invitee@x.com");
    await userEvent.click(screen.getByLabelText(/email this invite/i));
    await userEvent.click(screen.getByRole("button", { name: /create link/i }));
    expect(generate).toHaveBeenCalledWith({ email: "invitee@x.com" });
    expect(sendCreatorInvite).toHaveBeenCalledWith({ email: "invitee@x.com", token: "tok-123" });
  });
});
