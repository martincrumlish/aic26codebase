#!/usr/bin/env node
// scripts/setup.mjs — one-command first-run setup: `npm run setup`
//
// Chains the four bootstrap steps from the README:
//   1. npx convex dev --once        (create/link a Convex deployment, write .env.local)
//   2. npx @convex-dev/auth         (generate JWT keys on the deployment)
//   3. npx convex env set SITE_URL + OPERATOR_EMAIL
//   4. npx convex run seed:bootstrapOperator  → prints your activation link
//
// Safe to re-run: every step is idempotent (the seed returns created:false
// if the operator already exists).
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { extractSeedResult } from "./seed-output.mjs";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

function run(label, command, args, { capture = false } = {}) {
  console.log(`\n\x1b[36m▸ ${label}\x1b[0m`);
  const result = spawnSync(command, args, {
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    shell: process.platform === "win32", // npx is npx.cmd on Windows
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`\n✖ "${command} ${args.join(" ")}" failed (exit ${result.status ?? "?"}). Fix the error above and re-run: npm run setup`);
    process.exit(result.status ?? 1);
  }
  if (capture && result.stdout) process.stdout.write(result.stdout);
  return result.stdout ?? "";
}

console.log("\x1b[1mFirst-run setup\x1b[0m — this wires a Convex backend and seeds your admin account.");
console.log("You'll need a free Convex account (the next step opens a login if you're not signed in).");

// 1. Create/link the Convex deployment. Interactive on first run (login +
//    project selection); afterwards .env.local pins the deployment.
run("Provisioning your Convex deployment", "npx", ["convex", "dev", "--once"]);

// 2. JWT keys for Convex Auth (idempotent — keeps existing keys if already set).
run("Generating auth keys (JWT keypair)", "npx", ["@convex-dev/auth", "--skip-git-check", "--web-server-url", SITE_URL]);

// 3. Site URL + operator email.
run(`Setting SITE_URL=${SITE_URL}`, "npx", ["convex", "env", "set", "SITE_URL", SITE_URL]);

let email = process.env.OPERATOR_EMAIL;
if (!email) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (!email || !email.includes("@")) {
    email = (await rl.question("\nYour email for the admin (operator) account: ")).trim();
  }
  rl.close();
}
run("Setting OPERATOR_EMAIL", "npx", ["convex", "env", "set", "OPERATOR_EMAIL", email]);

// 4. Seed the operator and surface the activation link.
const seedOut = run("Seeding the operator account", "npx", ["convex", "run", "seed:bootstrapOperator"], { capture: true });
const seed = extractSeedResult(seedOut);

console.log("\n\x1b[32m✔ Setup complete.\x1b[0m\n");
if (seed?.created && seed.activationToken) {
  console.log("Next steps:");
  console.log("  1. npm run dev");
  console.log(`  2. Open \x1b[1m${SITE_URL}/activate/${seed.activationToken}\x1b[0m and set your password.`);
  console.log("  3. You're the operator — the Admin section appears in the sidebar.");
} else if (seed && !seed.created) {
  console.log(`The operator account (${email}) already exists — start the app with \x1b[1mnpm run dev\x1b[0m and sign in at ${SITE_URL}/signin.`);
} else {
  console.log("Could not read the seed result above — if it shows an activationToken, open:");
  console.log(`  ${SITE_URL}/activate/<activationToken>`);
}
