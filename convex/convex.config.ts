// convex/convex.config.ts — Convex components used by this app.
import { defineApp } from "convex/server";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
// Stripe billing: stores customers/subscriptions synced by the webhook.
app.use(stripe);

export default app;
