// components/settings/ProfileForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

const updateProfile = vi.fn(() => Promise.resolve(null));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => ({ _id: "1", name: "Ada", email: "ada@x.com", role: "creator" })),
  useMutation: vi.fn(() => updateProfile),
}));

import { ProfileForm } from "./ProfileForm";

describe("ProfileForm", () => {
  test("submits the edited name", async () => {
    render(<ProfileForm />);
    const input = screen.getByLabelText(/name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Ada Lovelace");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(updateProfile).toHaveBeenCalledWith({ name: "Ada Lovelace" });
  });
});
