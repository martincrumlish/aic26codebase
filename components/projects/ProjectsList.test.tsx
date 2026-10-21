// components/projects/ProjectsList.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = { _id: string; _creationTime: number; name: string; description?: string; hasAttachment: boolean; updatedAt: number };
let rows: Row[] = [];
let usage: { count: number; limit: number | null; plan: "free" | "pro" } | undefined;
let status = "Exhausted";
const loadMore = vi.fn();
const create = vi.fn((_args: unknown) => Promise.resolve("p_new"));

vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  usePaginatedQuery: vi.fn(() => ({ results: rows, status, loadMore })),
  useQuery: vi.fn(() => usage),
  useMutation: vi.fn(() => create),
}));

import { ProjectsList } from "./ProjectsList";

beforeEach(() => {
  rows = [];
  usage = { count: 0, limit: 3, plan: "free" };
  status = "Exhausted";
  create.mockClear();
  loadMore.mockClear();
});

describe("ProjectsList", () => {
  test("empty: invites you to create your first project", () => {
    render(<ProjectsList />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  test("lists projects linking to their pages, with usage against the plan", () => {
    rows = [
      { _id: "p1", _creationTime: 1, name: "Website", description: "Relaunch", hasAttachment: true, updatedAt: 1 },
      { _id: "p2", _creationTime: 2, name: "Newsletter", hasAttachment: false, updatedAt: 2 },
    ];
    usage = { count: 2, limit: 3, plan: "free" };
    render(<ProjectsList />);
    expect(screen.getByRole("link", { name: /website/i })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText(/2 of 3 projects/i)).toBeInTheDocument();
  });

  test("creating a project sends the name and description", async () => {
    render(<ProjectsList />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Launch plan");
    await userEvent.type(screen.getByLabelText(/description/i), "Q3");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(create).toHaveBeenCalledWith({ name: "Launch plan", description: "Q3" });
  });

  test("at the Free limit: explains, links to pricing, and hides the create form", () => {
    usage = { count: 3, limit: 3, plan: "free" };
    render(<ProjectsList />);
    expect(screen.getByText(/used all 3 projects/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: /create project/i })).not.toBeInTheDocument();
  });

  test("Pro shows no limit", () => {
    usage = { count: 12, limit: null, plan: "pro" };
    render(<ProjectsList />);
    expect(screen.getByText(/12 projects/i)).toBeInTheDocument();
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
  });

  test("Load more appears when there are more pages", async () => {
    rows = [{ _id: "p1", _creationTime: 1, name: "A", hasAttachment: false, updatedAt: 1 }];
    status = "CanLoadMore";
    render(<ProjectsList />);
    await userEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });
});
