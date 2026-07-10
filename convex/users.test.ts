// convex/users.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("users.currentUser / updateProfile", () => {
  test("currentUser returns null when signed out, the profile when signed in", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.currentUser, {})).toBeNull();

    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "c@x.com", role: "creator", status: "active",
        createdVia: "token", createdAt: Date.now(),
      }),
    );
    const me = await t.withIdentity({ subject: id }).query(api.users.currentUser, {});
    expect(me?._id).toBe(id);
    expect(me?.role).toBe("creator");
  });

  test("updateProfile sets the name for the signed-in user", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "c@x.com", role: "creator", status: "active",
        createdVia: "token", createdAt: Date.now(),
      }),
    );
    await t.withIdentity({ subject: id }).mutation(api.users.updateProfile, { name: "Ada" });
    const me = await t.withIdentity({ subject: id }).query(api.users.currentUser, {});
    expect(me?.name).toBe("Ada");
  });
});
