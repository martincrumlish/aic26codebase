// components/projects/ProjectDetail.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

let project: {
  _id: string; name: string; description?: string; updatedAt: number;
  attachment: { name: string; url: string | null } | null;
} | null | undefined;
const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
const mutationFor = (name: string) => (mutations[name] ??= vi.fn(() => Promise.resolve(null)));

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  useQuery: vi.fn(() => project),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: vi.fn((ref: any) => mutationFor(getFunctionName(ref))),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ProjectDetail } from "./ProjectDetail";

beforeEach(() => {
  project = { _id: "p1", name: "Website", description: "Relaunch", updatedAt: 1, attachment: null };
  Object.values(mutations).forEach((m) => m.mockReset().mockResolvedValue(null));
  push.mockClear();
  toast.error.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("ProjectDetail", () => {
  test("edits and saves the name and description", async () => {
    render(<ProjectDetail projectId="p1" />);
    const name = screen.getByLabelText(/^name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Website v2");
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(mutations["projects:update"]).toHaveBeenCalledWith({
      projectId: "p1", name: "Website v2", description: "Relaunch",
    });
  });

  test("attaching a file uploads it to Convex storage, then records it", async () => {
    mutationFor("projects:generateUploadUrl").mockResolvedValue("https://upload.test/abc");
    mutationFor("projects:setAttachment").mockResolvedValue({ ok: true });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ storageId: "st_1" })));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectDetail projectId="p1" />);
    const file = new File(["hello"], "brief.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/attach a file/i), file);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.test/abc",
      expect.objectContaining({ method: "POST", body: file }),
    );
    expect(mutations["projects:setAttachment"]).toHaveBeenCalledWith({
      projectId: "p1", storageId: "st_1", fileName: "brief.pdf",
    });
  });

  test("a refused upload (e.g. too big) shows the reason", async () => {
    mutationFor("projects:generateUploadUrl").mockResolvedValue("https://upload.test/abc");
    mutationFor("projects:setAttachment").mockResolvedValue({ ok: false, error: "Files can be up to 10 MB." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ storageId: "st_2" }))));

    render(<ProjectDetail projectId="p1" />);
    await userEvent.upload(screen.getByLabelText(/attach a file/i), new File(["x"], "big.bin"));
    expect(toast.error).toHaveBeenCalledWith("Files can be up to 10 MB.");
  });

  test("shows an existing attachment with download and remove", async () => {
    project!.attachment = { name: "brief.pdf", url: "https://files.test/brief.pdf" };
    render(<ProjectDetail projectId="p1" />);
    expect(screen.getByRole("link", { name: /brief\.pdf/i })).toHaveAttribute("href", "https://files.test/brief.pdf");
    await userEvent.click(screen.getByRole("button", { name: /remove file/i }));
    expect(mutations["projects:removeAttachment"]).toHaveBeenCalledWith({ projectId: "p1" });
  });

  test("deleting asks for confirmation, then removes and goes back to the list", async () => {
    render(<ProjectDetail projectId="p1" />);
    await userEvent.click(screen.getByRole("button", { name: /delete project/i }));
    expect(mutations["projects:remove"]).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /delete forever/i }));
    expect(mutations["projects:remove"]).toHaveBeenCalledWith({ projectId: "p1" });
    expect(push).toHaveBeenCalledWith("/projects");
  });

  test("a missing (or someone else's) project shows not found with a way back", () => {
    project = null;
    render(<ProjectDetail projectId="p1" />);
    expect(screen.getByText(/project not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to projects/i })).toHaveAttribute("href", "/projects");
  });

  test("after deleting, the live query going null doesn't flash 'not found'", async () => {
    const { rerender } = render(<ProjectDetail projectId="p1" />);
    await userEvent.click(screen.getByRole("button", { name: /delete project/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete forever/i }));
    project = null;
    rerender(<ProjectDetail projectId="p1" />);
    expect(screen.queryByText(/project not found/i)).not.toBeInTheDocument();
  });
});
