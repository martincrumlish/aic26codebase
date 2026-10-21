// convex/http.ts
import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";
import { auth } from "./auth";
import { provisionWebhook } from "./provisionHttp";
import { components, internal } from "./_generated/api";

const http = httpRouter();

// Convex Auth's routes (JWKS and OpenID discovery used to verify session tokens).
auth.addHttpRoutes(http);

// Inbound provisioning webhook for non-Stripe systems (see provisionHttp.ts).
http.route({ path: "/provision", method: "POST", handler: provisionWebhook });

// Stripe webhook: the component verifies Stripe's signature and syncs
// customers/subscriptions; we add "pay first" account creation on top.
registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    "checkout.session.completed": async (ctx, event) => {
      const session = event.data.object;
      if (session.mode !== "subscription" || session.metadata?.guest !== "1") return;
      const email = session.customer_details?.email;
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!email || !customer) {
        console.error("Guest checkout completed without an email or customer", session.id);
        return;
      }
      await ctx.runMutation(internal.billing.provisionPurchase, {
        checkoutSessionId: session.id,
        email,
        stripeCustomerId: customer,
      });
    },
  },
});

export default http;
