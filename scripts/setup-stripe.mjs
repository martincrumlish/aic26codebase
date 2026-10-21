#!/usr/bin/env node
// scripts/setup-stripe.mjs — `npm run setup:stripe`: connect Stripe billing.
//
// Paste a Stripe secret key and this creates the Pro product and its monthly
// and yearly prices (from convex/lib/proPrice.json), the webhook endpoint, and
// the customer-portal settings, then saves STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY and STRIPE_PRICE_PRO_YEARLY
// on your Convex deployment. Safe to re-run.
//
//   npm run setup:stripe                       # dev deployment, test-mode key
//   npm run setup:stripe -- --prod --convex-site-url https://<prod>.convex.site
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { formEncode, setupStripe } from "./stripe-setup-core.mjs";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const plan = JSON.parse(readFileSync(new URL("../convex/lib/proPrice.json", import.meta.url), "utf8"));

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function convexSiteUrl() {
  const flag = args.indexOf("--convex-site-url");
  if (flag !== -1 && args[flag + 1]) return args[flag + 1];
  if (prod) fail("With --prod, also pass --convex-site-url https://<your-prod-deployment>.convex.site");
  if (!existsSync(".env.local")) fail("No .env.local found. Run `npm run setup` first.");
  const match = readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_CONVEX_SITE_URL=(\S+)/m);
  if (!match) fail("NEXT_PUBLIC_CONVEX_SITE_URL is missing from .env.local. Run `npm run setup` first.");
  return match[1];
}

async function secretKey() {
  let key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.log("Find your key in the Stripe dashboard: Developers > API keys > Secret key.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    key = (await rl.question(`Paste your Stripe secret key (${prod ? "sk_live_..." : "sk_test_..."}): `)).trim();
    rl.close();
  }
  if (!key) fail("No key entered.");
  if (!/^(sk|rk)_(test|live)_/.test(key)) fail("That doesn't look like a Stripe secret key.");
  if (key.includes("_live_") && !prod) {
    fail("That's a LIVE key. Use a test key for development, or re-run with --prod for production.");
  }
  if (key.includes("_test_") && prod) fail("That's a TEST key, but you passed --prod.");
  return key;
}

function convexEnvSet(name, value) {
  const result = spawnSync("npx", ["convex", "env", "set", ...(prod ? ["--prod"] : []), name, value], {
    stdio: ["inherit", "pipe", "inherit"],
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`Couldn't set ${name} on Convex.`);
  console.log(`  ✔ ${name}`);
}

const siteUrl = convexSiteUrl();
const key = await secretKey();

async function stripeFetch(method, path, params = {}) {
  const encoded = formEncode(params);
  const withQuery = method === "GET" || method === "DELETE";
  const res = await fetch(`https://api.stripe.com${path}${withQuery && encoded ? `?${encoded}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: withQuery ? undefined : encoded,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe returned ${res.status}`);
  return json;
}

console.log(`\nSetting up Stripe billing (${prod ? "PRODUCTION" : "test mode"})…`);
let out;
try {
  out = await setupStripe({ stripeFetch, convexSiteUrl: siteUrl, plan, log: (m) => console.log(`  ✔ ${m}`) });
} catch (err) {
  fail(`Stripe said: ${err instanceof Error ? err.message : String(err)}`);
}

console.log("\nSaving settings on your Convex deployment…");
convexEnvSet("STRIPE_SECRET_KEY", key);
convexEnvSet("STRIPE_WEBHOOK_SECRET", out.webhookSecret);
convexEnvSet("STRIPE_PRICE_PRO_MONTHLY", out.priceMonthly);
convexEnvSet("STRIPE_PRICE_PRO_YEARLY", out.priceYearly);

console.log("\n\x1b[32m✔ Billing is set up.\x1b[0m");
if (!prod) {
  console.log("Try it: npm run dev, open /pricing, and upgrade with Stripe's test card");
  console.log("  4242 4242 4242 4242, any future expiry date, any CVC.");
}
