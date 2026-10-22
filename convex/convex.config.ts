// convex/convex.config.ts — Convex components used by this app.
import { defineApp } from "convex/server";
import stripe from "@convex-dev/stripe/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();
// Stripe billing: stores customers/subscriptions synced by the webhook.
app.use(stripe);
// Rate limits (lib/rateLimits.ts): how fast people can repeat costly things.
app.use(rateLimiter);

export default app;
