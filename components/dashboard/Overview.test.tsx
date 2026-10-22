// components/dashboard/Overview.test.tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

let data: Record<string, unknown> = {};
let pages: Record<string, unknown[]> = {};
vi.mock("convex/react", async (orig) => ({
  ...(await orig<typeof import("convex/react")>()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: vi.fn((ref: any) => data[getFunctionName(ref)]),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usePaginatedQuery: vi.fn((ref: any) => ({
    results: pages[getFunctionName(ref)] ?? [],
    status: "Exhausted",
    loadMore: vi.fn(),
  })),
}));

import { Overview } from "./Overview";

beforeEach(() => {
  data = {
    "users:currentUser": { name: "Rhea Okafor", email: "rhea@x.com" },
    "billing:status": { plan: "free", billingEnabled: true },
    "projects:usage": { count: 2, limit: 3, plan: "free" },
    "ai:getAiStatus": { enabled: false, appKeyNeedsPro: true },
  };
  pages = {
    "projects:list": [
      { _id: "p1", name: "Website relaunch", updatedAt: 1, hasAttachment: false },
    ],
    "chat:listConversations": [{ _id: "c1", title: "Launch email ideas", updatedAt: 1, model: "m" }],
  };
});

describe("Overview", () => {
  test("greets by first name", () => {
    render(<Overview />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, Rhea");
  });

  test("shows the plan, project usage and AI status, each linking to what to do next", () => {
    render(<Overview />);
    const plan = screen.getByRole("region", { name: /plan/i });
    expect(within(plan).getByText("Free")).toBeInTheDocument();
    expect(within(plan).getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/pricing");

    const projects = screen.getByRole("region", { name: /^projects$/i });
    expect(within(projects).getByText("2 of 3")).toBeInTheDocument();

    const ai = screen.getByRole("region", { name: /ai chat/i });
    expect(within(ai).getByText(/not set up/i)).toBeInTheDocument();
    expect(within(ai).getByRole("link", { name: /add your key/i })).toHaveAttribute("href", "/settings/ai");
  });

  test("lists recent projects and conversations", () => {
    render(<Overview />);
    expect(screen.getByRole("link", { name: /website relaunch/i })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByRole("link", { name: /launch email ideas/i })).toHaveAttribute("href", "/chat/c1");
  });

  test("Free with a trial available: the plan card offers it", () => {
    data["billing:status"] = { plan: "free", billingEnabled: true, trialDays: 14 };
    render(<Overview />);
    const plan = screen.getByRole("region", { name: /plan/i });
    expect(within(plan).getByRole("link", { name: /try pro free for 14 days/i })).toHaveAttribute("href", "/pricing");
  });

  test("Pro on a free trial: the plan card says Trial", () => {
    data["billing:status"] = { plan: "pro", billingEnabled: true, trialing: true, trialDays: 0 };
    render(<Overview />);
    const plan = screen.getByRole("region", { name: /plan/i });
    expect(within(plan).getByText("Trial")).toBeInTheDocument();
  });

  test("Pro with the app's key: no upgrade prompt, AI ready, with this month's usage", () => {
    data["billing:status"] = { plan: "pro", billingEnabled: true };
    data["projects:usage"] = { count: 7, limit: null, plan: "pro" };
    data["ai:getAiStatus"] = { enabled: true, source: "app" };
    data["ai:usage"] = { source: "app", used: 230, limit: 1000, resetsAt: 1 };
    render(<Overview />);
    expect(screen.queryByRole("link", { name: /upgrade/i })).not.toBeInTheDocument();
    const ai = screen.getByRole("region", { name: /ai chat/i });
    expect(within(ai).getByText(/ready/i)).toBeInTheDocument();
    expect(within(ai).getByText(/230 of 1,000 messages this month/i)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^projects$/i })).getByText("7")).toBeInTheDocument();
  });

  test("empty lists point to where to start", () => {
    pages = {};
    render(<Overview />);
    expect(screen.getByRole("link", { name: /create a project/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: /start a chat/i })).toHaveAttribute("href", "/chat");
  });
});
