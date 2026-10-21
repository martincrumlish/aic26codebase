// vitest/stripe.ts — test helpers for billing: register the @convex-dev/stripe
// component with convex-test, fake the Stripe API, and sign webhook payloads
// exactly as Stripe does.
import { vi } from "vitest";
import type { TestConvex } from "convex-test";
// The component's built files (its package doesn't ship a test helper).
import stripeSchema from "../node_modules/@convex-dev/stripe/dist/component/schema.js";

const stripeModules = import.meta.glob("../node_modules/@convex-dev/stripe/dist/component/**/*.js");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerStripe(t: TestConvex<any>) {
  t.registerComponent("stripe", stripeSchema, stripeModules);
}

export const STRIPE_ENV = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_monthly",
  STRIPE_PRICE_PRO_YEARLY: "price_pro_yearly",
  SITE_URL: "http://localhost:3000",
};

export function stubStripeEnv() {
  for (const [k, v] of Object.entries(STRIPE_ENV)) vi.stubEnv(k, v);
}

export type StripeCall = { method: string; path: string; params: URLSearchParams };

/**
 * Replace fetch with a fake Stripe API. Returns the list of calls made.
 * `overrides` maps "METHOD /v1/path" to a JSON body for that response.
 */
export function stubStripeApi(overrides: Record<string, unknown> = {}) {
  const calls: StripeCall[] = [];
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method ?? "GET").toUpperCase();
      const params = new URLSearchParams(
        method === "GET" || method === "DELETE" ? url.search : String(init?.body ?? ""),
      );
      calls.push({ method, path: url.pathname, params });
      const key = `${method} ${url.pathname}`;
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (key in overrides) return json(overrides[key]);
      n += 1;
      if (key === "POST /v1/customers") {
        return json({ id: `cus_test_${n}`, object: "customer", email: params.get("email") });
      }
      if (key === "POST /v1/checkout/sessions") {
        return json({ id: `cs_test_${n}`, object: "checkout.session", url: `https://checkout.stripe.test/cs_test_${n}` });
      }
      if (key === "POST /v1/billing_portal/sessions") {
        return json({ id: `bps_${n}`, object: "billing_portal.session", url: "https://billing.stripe.test/portal" });
      }
      const sub = url.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/);
      if (sub && method === "GET") {
        return json({ id: sub[1], object: "subscription", latest_invoice: null, items: { data: [] } });
      }
      if (sub && (method === "DELETE" || method === "POST")) {
        return json({
          id: sub[1], object: "subscription", status: "canceled", cancel_at_period_end: false,
          cancel_at: null, items: { data: [{ current_period_end: 0, quantity: 1, price: { id: "price_x" } }] },
          metadata: {},
        });
      }
      return json({ error: { message: `fake Stripe: unhandled ${key}` } }, 404);
    }),
  );
  return calls;
}

/** A Stripe-Signature header for `payload`, made the way Stripe makes it. */
export async function stripeSignature(payload: string, secret = STRIPE_ENV.STRIPE_WEBHOOK_SECRET) {
  const timestamp = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

/** POST a signed Stripe event to the app's webhook. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendStripeEvent(t: TestConvex<any>, type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  return t.fetch("/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": await stripeSignature(payload), "content-type": "application/json" },
    body: payload,
  });
}

/** A subscription object as Stripe sends it in customer.subscription.* events. */
export function subscriptionObject(opts: {
  id: string;
  customer: string;
  status?: string;
  priceId?: string;
  metadata?: Record<string, string>;
  cancelAtPeriodEnd?: boolean;
}) {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  return {
    id: opts.id,
    object: "subscription",
    customer: opts.customer,
    status: opts.status ?? "active",
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    cancel_at: null,
    metadata: opts.metadata ?? {},
    current_period_end: periodEnd,
    items: {
      data: [
        { current_period_end: periodEnd, quantity: 1, price: { id: opts.priceId ?? STRIPE_ENV.STRIPE_PRICE_PRO_MONTHLY } },
      ],
    },
  };
}
