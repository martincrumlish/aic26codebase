#!/usr/bin/env node
// scripts/setup-google.mjs — `npm run setup:google`: turn on "Continue with Google".
//
// Prints the redirect URI to paste into Google Cloud, asks for the OAuth
// client ID and secret you create there, and saves them on your Convex
// deployment as AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. The full walkthrough is
// docs/google-sign-in.md.
//
//   npm run setup:google                       # dev deployment
//   npm run setup:google -- --prod --convex-site-url https://<prod>.convex.site
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { checkGoogleCredentials, googleRedirectUri } from "./google-setup-core.mjs";

const args = process.argv.slice(2);
const prod = args.includes("--prod");

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

function convexEnvSet(name, value) {
  const result = spawnSync("npx", ["convex", "env", "set", ...(prod ? ["--prod"] : []), name, value], {
    stdio: ["inherit", "pipe", "inherit"],
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`Couldn't set ${name} on Convex.`);
  console.log(`  ✔ ${name}`);
}

const redirectUri = googleRedirectUri(convexSiteUrl());

console.log(`
Set up "Continue with Google" (${prod ? "PRODUCTION" : "development"})

In Google Cloud (https://console.cloud.google.com/auth/clients), create an
OAuth client of type "Web application" and add this Authorized redirect URI:

  \x1b[1m${redirectUri}\x1b[0m

Step-by-step instructions: docs/google-sign-in.md
`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = (await rl.question("Paste the Client ID: ")).trim();
const clientSecret = (await rl.question("Paste the Client secret: ")).trim();
rl.close();

const problem = checkGoogleCredentials({ clientId, clientSecret });
if (problem) fail(problem);

console.log("\nSaving on your Convex deployment…");
convexEnvSet("AUTH_GOOGLE_ID", clientId);
convexEnvSet("AUTH_GOOGLE_SECRET", clientSecret);

console.log("\n\x1b[32m✔ Google sign-in is on.\x1b[0m Reload the sign-in page to see the button.");
if (!prod) {
  console.log("While your Google app is in Testing, only the test users you added can sign in.");
}
