// components/admin/BrandingForm.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

let branding: Record<string, string | null> | undefined;
const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
const mutationFor = (name: string) => (mutations[name] ??= vi.fn(() => Promise.resolve(null)));
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => branding),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: vi.fn((ref: any) => mutationFor(getFunctionName(ref))),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { BrandingForm } from "./BrandingForm";

beforeEach(() => {
  branding = {
    name: null, description: null, brandColor: null, primaryColor: null, logoUrl: null, artworkUrl: null,
  };
  Object.values(mutations).forEach((m) => m.mockReset().mockResolvedValue(null));
  refresh.mockClear();
  toast.error.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("BrandingForm", () => {
  test("saves the name and colours, then refreshes so every page picks them up", async () => {
    render(<BrandingForm />);
    await userEvent.type(screen.getByLabelText(/^app name/i), "Fieldnote");
    await userEvent.type(screen.getByLabelText(/^description/i), "Notes for field teams.");
    const brand = screen.getByLabelText(/^brand colour hex/i);
    await userEvent.clear(brand);
    await userEvent.type(brand, "#0f3d2e");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mutations["branding:update"]).toHaveBeenCalledWith({
      name: "Fieldnote", description: "Notes for field teams.", brandColor: "#0f3d2e", primaryColor: null,
    });
    expect(refresh).toHaveBeenCalled();
  });

  test("starts from what's saved, and an untouched colour stays the default", async () => {
    branding = { ...branding, name: "Fieldnote", brandColor: "#0f3d2e" };
    render(<BrandingForm />);
    expect(screen.getByLabelText(/^app name/i)).toHaveValue("Fieldnote");
    expect(screen.getByLabelText(/^brand colour hex/i)).toHaveValue("#0f3d2e");

    await userEvent.click(screen.getByRole("button", { name: /use default brand colour/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mutations["branding:update"]).toHaveBeenCalledWith(expect.objectContaining({ brandColor: null }));
  });

  test("a colour that isn't #rrggbb is flagged and not saved", async () => {
    render(<BrandingForm />);
    const brand = screen.getByLabelText(/^brand colour hex/i);
    await userEvent.clear(brand);
    await userEvent.type(brand, "teal");
    expect(screen.getByText(/use #rrggbb/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  test("uploading a logo sends it to storage, then records it", async () => {
    mutationFor("branding:generateUploadUrl").mockResolvedValue("https://upload.test/x");
    mutationFor("branding:setImage").mockResolvedValue({ ok: true });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ storageId: "st_logo" })));
    vi.stubGlobal("fetch", fetchMock);

    render(<BrandingForm />);
    const file = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await userEvent.upload(screen.getByLabelText(/upload a logo/i), file);
    expect(fetchMock).toHaveBeenCalledWith("https://upload.test/x", expect.objectContaining({ method: "POST", body: file }));
    expect(mutations["branding:setImage"]).toHaveBeenCalledWith({ kind: "logo", storageId: "st_logo" });
    expect(refresh).toHaveBeenCalled();
  });

  test("a refused image shows why", async () => {
    mutationFor("branding:generateUploadUrl").mockResolvedValue("https://upload.test/x");
    mutationFor("branding:setImage").mockResolvedValue({ ok: false, error: "Use a PNG, JPEG, WebP or SVG image." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ storageId: "st_bad" }))));
    render(<BrandingForm />);
    await userEvent.upload(screen.getByLabelText(/upload sign-in artwork/i), new File(["x"], "a.png", { type: "image/png" }));
    expect(toast.error).toHaveBeenCalledWith("Use a PNG, JPEG, WebP or SVG image.");
  });

  test("reset asks first, then puts everything back to the defaults", async () => {
    render(<BrandingForm />);
    await userEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));
    expect(mutations["branding:reset"]).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^reset everything$/i }));
    expect(mutations["branding:reset"]).toHaveBeenCalledWith({});
    expect(refresh).toHaveBeenCalled();
  });
});
