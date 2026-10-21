// components/settings/GoogleConnect.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

let status: { enabled: boolean; connected: boolean; email?: string } | undefined;
const disconnect = vi.fn(() => Promise.resolve(null));
const signIn = vi.fn((_p: string, _o?: unknown) => Promise.resolve({ signingIn: false }));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => status),
  useMutation: vi.fn(() => disconnect),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn, signOut: vi.fn() }) }));
let params = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ replace, push: vi.fn() }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { GoogleConnect } from "./GoogleConnect";

beforeEach(() => {
  status = { enabled: true, connected: false };
  params = new URLSearchParams();
  [disconnect, signIn, replace, toast.success, toast.error].forEach((f) => f.mockClear());
});

describe("GoogleConnect", () => {
  test("not connected: Connect starts Google sign-in and comes back to Settings", async () => {
    render(<GoogleConnect />);
    await userEvent.click(screen.getByRole("button", { name: /connect google/i }));
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/settings?connect=google" });
  });

  test("connected: shows the address, and Disconnect removes it", async () => {
    status = { enabled: true, connected: true, email: "amy@gmail.com" };
    render(<GoogleConnect />);
    expect(screen.getByText(/amy@gmail\.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalledWith({});
  });

  test("back from Google: says whether it worked, then tidies the URL", () => {
    params = new URLSearchParams("connect=google");
    status = { enabled: true, connected: true, email: "amy@gmail.com" };
    const { unmount } = render(<GoogleConnect />);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/google connected/i));
    expect(replace).toHaveBeenCalledWith("/settings");
    unmount();

    status = { enabled: true, connected: false };
    render(<GoogleConnect />);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn't connect google/i));
  });

  test("hidden when Google isn't set up (unless already connected)", () => {
    status = { enabled: false, connected: false };
    const { container } = render(<GoogleConnect />);
    expect(container).toBeEmptyDOMElement();
  });
});
