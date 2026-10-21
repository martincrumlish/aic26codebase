// scripts/stripe-setup-core.mjs — the logic behind `npm run setup:stripe`.
// `stripeFetch(method, path, params)` is injected so this can be tested
// against a fake Stripe; setup-stripe.mjs passes one that calls the real API.

/** Events the app's webhook needs (the Stripe component syncs these). */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.created",
  "customer.updated",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.created",
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
];

const LOOKUP = { monthly: "pro_monthly", yearly: "pro_yearly" };
const INTERVAL = { monthly: "month", yearly: "year" };

/** Stripe's form encoding: a[b][c]=x, list[0]=y. */
export function formEncode(params, prefix = "") {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") parts.push(formEncode(item, `${name}[${i}]`));
        else parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      parts.push(formEncode(value, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

/**
 * Create (or reuse) everything billing needs in Stripe. Safe to re-run.
 * @returns {{ priceMonthly: string, priceYearly: string, webhookSecret: string }}
 */
export async function setupStripe({ stripeFetch, convexSiteUrl, plan, log = () => {} }) {
  // 1. Prices, found by lookup key. Reused when amount and currency match.
  const existing = await stripeFetch("GET", "/v1/prices", {
    lookup_keys: Object.values(LOOKUP),
    active: "true",
    limit: "10",
  });
  const byKey = Object.fromEntries(existing.data.map((p) => [p.lookup_key, p]));

  let productId =
    byKey[LOOKUP.monthly]?.product?.id ?? byKey[LOOKUP.monthly]?.product ??
    byKey[LOOKUP.yearly]?.product?.id ?? byKey[LOOKUP.yearly]?.product;
  if (!productId) {
    const product = await stripeFetch("POST", "/v1/products", {
      name: "Pro",
      metadata: { app_plan: "pro" },
    });
    productId = product.id;
    log(`Created product "Pro" (${productId})`);
  }

  const prices = {};
  for (const interval of ["monthly", "yearly"]) {
    const current = byKey[LOOKUP[interval]];
    const amount = plan[interval];
    if (
      current &&
      current.unit_amount === amount &&
      current.currency === plan.currency &&
      current.recurring?.interval === INTERVAL[interval]
    ) {
      prices[interval] = current.id;
      log(`Reusing ${interval} price (${current.id})`);
      continue;
    }
    const created = await stripeFetch("POST", "/v1/prices", {
      product: productId,
      unit_amount: String(amount),
      currency: plan.currency,
      recurring: { interval: INTERVAL[interval] },
      lookup_key: LOOKUP[interval],
      transfer_lookup_key: "true",
    });
    prices[interval] = created.id;
    log(`Created ${interval} price (${created.id})`);
  }

  // 2. Webhook endpoint. Stripe only reveals the signing secret when an
  //    endpoint is created, so replace any existing one for this URL.
  const webhookUrl = `${convexSiteUrl.replace(/\/$/, "")}/stripe/webhook`;
  const endpoints = await stripeFetch("GET", "/v1/webhook_endpoints", { limit: "100" });
  for (const ep of endpoints.data.filter((e) => e.url === webhookUrl)) {
    await stripeFetch("DELETE", `/v1/webhook_endpoints/${ep.id}`);
  }
  const endpoint = await stripeFetch("POST", "/v1/webhook_endpoints", {
    url: webhookUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: "App billing (created by npm run setup:stripe)",
  });
  log(`Webhook endpoint ready: ${webhookUrl}`);

  // 3. Customer portal: Stripe needs a configuration before the "Manage
  //    billing" button works. Create one only if none exists.
  const portals = await stripeFetch("GET", "/v1/billing_portal/configurations", {
    is_default: "true",
    limit: "1",
  });
  if (portals.data.length === 0) {
    await stripeFetch("POST", "/v1/billing_portal/configurations", {
      business_profile: { headline: "Manage your subscription" },
      features: {
        invoice_history: { enabled: "true" },
        payment_method_update: { enabled: "true" },
        subscription_cancel: { enabled: "true", mode: "at_period_end" },
        subscription_update: {
          enabled: "true",
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [{ product: productId, prices: [prices.monthly, prices.yearly] }],
        },
      },
    });
    log("Created the customer portal configuration");
  } else {
    log("Customer portal already configured");
  }

  return {
    priceMonthly: prices.monthly,
    priceYearly: prices.yearly,
    webhookSecret: endpoint.secret,
  };
}
