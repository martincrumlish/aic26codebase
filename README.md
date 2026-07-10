# AIC26 Codebase — Next.js + Convex SaaS Starter

A boilerplate for building **SaaS apps with controlled signup**. Users come in through the doors you open — a signup link per plan, a payment-webhook that provisions accounts on purchase, or a direct invite — never through anonymous open registration. Clone it (or use it as a GitHub template), run one setup command, and you have a working app with authentication, role-based access control, an admin console, provisioning webhooks, transactional email, and bring-your-own-key AI support — all tested, all typed, ready for you to drop your actual product into.

This is not a demo. The patterns are the hardened kind: token-gated signup that fails closed, write-only secret storage, cascade deletes, and a Convex backend where every function starts with an access check.

- **Repo:** https://github.com/martincrumlish/aic26codebase
- **Convex dashboard:** https://dashboard.convex.dev
- **Deploys to:** Vercel (frontend) + Convex Cloud (backend)

---

## Table of contents

- [What you get](#what-you-get)
- [The stack](#the-stack)
- [Quickstart — running it locally](#quickstart--running-it-locally)
- [How the app works](#how-the-app-works)
  - [The user model: operator / creator / member](#the-user-model-operator--creator--member)
  - [Auth flows](#auth-flows)
  - [The admin console](#the-admin-console)
  - [Provisioning webhook](#provisioning-webhook)
  - [Transactional email](#transactional-email)
  - [BYOK AI (OpenRouter)](#byok-ai-openrouter)
- [Using this as the base for a new project](#using-this-as-the-base-for-a-new-project)
- [Project conventions](#project-conventions)
- [Environment variable reference](#environment-variable-reference)
- [Testing](#testing)
- [Deploying to production](#deploying-to-production)
- [Directory map](#directory-map)
- [Troubleshooting](#troubleshooting)

---

## What you get

| Area | What's included |
|---|---|
| **Auth pages** | `/signin`, `/join/[token]` (signup via link), `/activate/[token]` (operator/webhook-provisioned accounts), `/reset` (magic-link reset) — split-panel UI |
| **Auth gating** | `convex/authGate.ts` — signup is **token-gated** and fails closed: no valid signup link or pre-seeded row → no account, revoked users are locked out everywhere |
| **Roles** | `operator` (platform admin) / `creator` / `member` on the users table, with `require*` helpers in `convex/access.ts` |
| **Admin console** (`/admin`) | Platform stats, creators table (revoke / hard-delete with typed confirmation), signup-link generator (with optional email delivery), add-user dialog, webhook config panel |
| **Provisioning** | `POST /provision` Convex HTTP endpoint — HMAC-SHA256 signed, idempotent — creates users from external systems (your payment platform, a partner API, Zapier…) |
| **Email** | `convex/email.ts` — one fail-soft module wrapping the Resend REST API; the app works fine with email unconfigured and features that need it hide themselves |
| **BYOK AI** | `convex/ai.ts` — per-user OpenRouter API keys, live-validated before saving, stored write-only (clients can only ever read `last4`), with app-level fallback key |
| **App shell** | Sidebar layout with role-aware nav + account menu |
| **Dashboard** | Intentionally a placeholder — it demonstrates the loading-skeleton pattern and is where your product goes |
| **Settings** | Profile, password change, AI key management |
| **Security** | Route-protection middleware, response-header hardening (`lib/security/headers.ts`), no secrets in the DB schema (env-var refs only) |
| **Tests** | 72 passing tests: Convex backend (convex-test, edge runtime) + React components (Testing Library, jsdom) |

## The stack

- **[Next.js 16](https://nextjs.org)** — App Router, React 19, TypeScript, Turbopack
- **[Convex](https://convex.dev)** — reactive database, server functions, HTTP endpoints, cron-capable scheduler. The entire backend lives in `convex/`
- **[Convex Auth](https://labs.convex.dev/auth)** — password sign-in (token-gated signup) + magic-link via Resend
- **[Tailwind CSS 4](https://tailwindcss.com)** + shadcn-style components built on [Base UI](https://base-ui.com) primitives (`components/ui/`)
- **[Vitest](https://vitest.dev)** + [convex-test](https://www.npmjs.com/package/convex-test) + Testing Library

There is no separate API server, no ORM, no migration tool, and no session store to run — Convex is all of it.

---

## Quickstart — running it locally

Prerequisites: Node 20+, npm, a free [Convex account](https://dashboard.convex.dev).

```bash
git clone https://github.com/martincrumlish/aic26codebase.git my-app
cd my-app
npm install
npm run setup
npm run dev
```

`npm run setup` walks you through everything interactively:

1. **Provisions a Convex dev deployment** on your account (opens a login on first use) and writes its URL to `.env.local` (gitignored).
2. **Generates the JWT keypair** Convex Auth needs, stored as env vars on the deployment.
3. **Sets `SITE_URL`** and asks for **your email** for the admin (operator) account.
4. **Seeds the operator** and prints your personal activation link.

Then run `npm run dev`, open the printed `http://localhost:3000/activate/<token>` link, set a password, and you're signed in as the operator. **Admin** appears in the sidebar — from there you can generate invite links, add users directly, and see the provisioning webhook config.

The script is safe to re-run (every step is idempotent). If you prefer to do it by hand, the equivalent manual steps are:

```bash
npx convex dev --once                                # create deployment, write .env.local
npx @convex-dev/auth                                 # JWT keys
npx convex env set SITE_URL http://localhost:3000
npx convex env set OPERATOR_EMAIL you@example.com
npx convex run seed:bootstrapOperator                # prints your activationToken
```

That's the whole loop. Everything else (email, AI, webhooks) is optional and off until you configure it.

---

## How the app works

### The user model: operator / creator / member

The `users` table (extended from Convex Auth's base table in `convex/schema.ts`) carries the app's access model:

- **`operator`** — the platform admin. Sees `/admin`, provisions users, generates invite links, revokes/deletes accounts. Seeded once via `seed:bootstrapOperator`; cannot be deleted through the admin UI.
- **`creator`** — your primary customer tier. Invited by the operator (link or direct add) or provisioned by webhook.
- **`member`** — a second tier, optionally scoped to a creator via `creatorId` (for "creator invites their own users" products). The plumbing is in place (`creatorScopeId` on tokens, `by_creator` index); build the UI when your product needs it.

Users also carry `status: "active" | "revoked"`. Revoking flips a switch that locks the account out of every function immediately — no session hunting.

> ⚠️ `users.role` and `users.status` are load-bearing: `convex/authGate.ts` and every `require*` helper depend on them. Keep their semantics intact when you extend the schema.

### Auth flows

There is **no anonymous open signup** — every path to an account goes through a token or an operator, so you always control who gets in and as what role:

1. **Signup link (`/join/<token>`)** — the operator generates a signup link in `/admin` (optionally locked to an email). The visitor sets email + password; `authGate` only lets the signup through if the token validates. Links are **standing by default — no expiry, no use limit** — so one link can serve as the signup URL for a whole plan (e.g. behind your checkout's thank-you page). You rotate a link whenever you want: revoke it in the admin's Signup-links list and generate a fresh one. For one-off or time-boxed invites, `createSignupToken` also accepts `maxUses` and `ttlDays`.
2. **Activation (`/activate/<token>`)** — for accounts that already exist as rows (seeded operator, webhook-provisioned users, admin "add user"). The flow consumes the activation token, then sets the password against the pre-seeded row.
3. **Sign-in (`/signin`)** — plain email + password.
4. **Reset (`/reset`)** — magic-link via Resend (requires `AUTH_RESEND_KEY`; the page explains itself if email isn't configured).

The gate itself is `convex/authGate.ts`, wired into Convex Auth's `createOrUpdateUser` callback. Its rules, in order: revoked users are rejected; existing rows just sign in; new signups require a valid token or a pre-seeded row; anything else **fails closed**.

### The admin console

`/admin` (operator-only, enforced server-side by `requireOperator` on every query/mutation it calls):

- **Stats cards** — creators, members, active invite tokens.
- **Creators table** — revoke (soft, reversible) or delete (hard, typed-confirmation). Delete cascades through all Convex Auth records (accounts, sessions, refresh tokens, verification codes) *and* app-owned tables — see [conventions](#project-conventions).
- **Generate creator link** — creates a standing signup link (no expiry, unlimited signups) and gives you a copyable `/join/…` URL. If email is configured, a checkbox appears to send the invite directly to the entered address.
- **Signup links list** — every active link with its signup count, copy button, and **Revoke**. Rotation = revoke the old link, generate a new one.
- **Add user account** — creates an account with a password immediately (no invite dance) via a pre-seed + `createAccount` action.
- **Provisioning webhook panel** — shows the endpoint URL and whether the signing secret is set; records secret rotations.

### Provisioning webhook

`POST https://<your-deployment>.convex.site/provision` lets external systems create users — the typical use is your payment platform's "new sale" webhook.

- **Signature:** HMAC-SHA256 of the raw body with `PROVISION_WEBHOOK_SECRET`, sent in the `x-app-signature` header. Unsigned/mis-signed requests are rejected (fails closed if the secret env var is unset).
- **Idempotent:** events carry an `externalId`; replays return the original result instead of double-provisioning.
- **Body:**

```json
{
  "externalId": "evt_12345",
  "source": "stripe",
  "type": "purchase.completed",
  "email": "customer@example.com",
  "role": "creator"
}
```

The endpoint creates (or finds) the user row and issues a 7-day activation token, stored in `provisioningTokens`. The response is deliberately minimal (`{ok, deduped}`) — it does not leak the token to the caller. Delivery is yours to wire: the natural move is to have `ingestEvent` schedule `internal.email.send` with the `/activate/<token>` link once you've configured Resend, or surface pending activations in the admin console.

Set the secret with:

```bash
npx convex env set PROVISION_WEBHOOK_SECRET <random-string>
```

### Transactional email

All outbound email goes through **one module**: `convex/email.ts`, a thin wrapper over the Resend REST API.

- **Fail-soft by contract:** `internal.email.send` never throws. No `AUTH_RESEND_KEY` → `{sent:false, reason:"no-key"}`. Resend error → `{sent:false, reason:"resend-<status>"}`. Network failure → `{sent:false, reason:"network"}`. Callers treat email as best-effort.
- **Self-hiding UI:** the `emailEnabled` query tells the frontend whether email is configured; features that depend on it (like the invite-email checkbox) don't render otherwise.
- To enable: `npx convex env set AUTH_RESEND_KEY re_…` and optionally `AUTH_EMAIL_FROM "Your App <hello@yourdomain.com>"`. The same key powers magic-link sign-in/reset.

Add your own emails by calling `internal.email.send` from any action — don't scatter `fetch("https://api.resend.com/…")` calls around the codebase.

### BYOK AI (OpenRouter)

`convex/ai.ts` implements per-user "bring your own key" for [OpenRouter](https://openrouter.ai), so users can pay for their own AI usage:

- **Settings → AI card**: paste a key → **Save & verify**. The key is validated with a live call to OpenRouter's authenticated `/api/v1/key` endpoint *before* saving (note: `/api/v1/models` is public and can't validate keys — don't "simplify" this).
- **Write-only storage**: the raw key lives in the `userApiKeys` table and is only readable through `internal.ai.getOpenRouterKeyForUser` — an internal query no client can call. Public reads (`getAiStatus`) return `{enabled, source: "own"|"app", last4}` and nothing else.
- **Resolution order** for any AI feature you build: the user's own key → the app-level `OPENROUTER_API_KEY` env var → AI disabled.

To offer app-paid AI to everyone, just set `npx convex env set OPENROUTER_API_KEY sk-or-…`; users who add their own key override it.

---

## Using this as the base for a new project

The intended workflow: **use the GitHub template** (or clone and re-init) → rename → wire a fresh Convex project → replace the placeholder surfaces → build your product on the dashboard.

**1. Get your own copy.**
On GitHub, click **Use this template** (or `git clone` + delete `.git` + `git init` if you prefer a clean history).

**2. Rename the app.**
- `package.json` → `name`
- `app/layout.tsx` → metadata title
- `public/brand/` → replace `small-transparent.png` (sidebar logo, white-on-transparent works best on the dark sidebar), `mid-transparent.png`, and `auth-bg.png` (the sign-in split-panel background)

**3. Wire a fresh Convex project** — follow the [Quickstart](#quickstart--running-it-locally) (`npx convex dev --once` creates a new project when you pick "create new").

**4. Replace the dashboard.**
`app/(app)/dashboard/page.tsx` is a deliberate placeholder that demonstrates the loading-skeleton pattern. Swap it for your primary resource — a list, a board, an editor, whatever your product is.

**5. Add your own tables.** For every owner-keyed table you add:
- Define it in `convex/schema.ts` **with an index on the owner field** (e.g. `.index("by_owner", ["ownerId"])`).
- Start every query/mutation touching it with the right `require*` helper from `convex/access.ts`.
- Add it to the **delete cascade** in `convex/operator.ts` → `deleteUserAccount` (section 1, before the auth records), including freeing any `ctx.storage` blobs it references. There's a `userApiKeys` example right there to copy.

**6. Decide your provisioning story.**
- Manual: operator generates standing signup links from `/admin` — e.g. one per plan — and rotates them at will. Works out of the box.
- Automated: point your payment platform's webhook at `/provision` with the shared secret.

**7. Configure optional services** as you need them: Resend (email), OpenRouter (AI), each a single env var away — see [reference](#environment-variable-reference).

**8. Keep the tests green.** `npm run test:run` should pass before and after every change; the existing tests double as executable documentation of the auth/gating behavior.

## Project conventions

These are the rules the codebase already follows — future code (and future Claude/AI sessions) should too:

- **TDD.** Write the failing test first, watch it fail, implement, watch it pass. Backend tests live next to the module (`convex/foo.test.ts`), component tests next to the component.
- **Access checks first.** Every Convex query/mutation/action begins with a `require*` helper (`requireUserId`, `requireUser`, `requireCreator`, `requireOperator`) from `convex/access.ts`. Actions (which have no `db`) gate via an internal query/mutation that does — see `email.assertOperator` or `operator.seedUserForAccount`.
- **Write-only secrets.** Sensitive values (API keys, password hashes) never travel to the client. Public queries return derived metadata only (`last4`, booleans); raw values go through `internal*` functions.
- **Cascade deletes.** New owner-keyed tables must be added to `deleteUserAccount` in `convex/operator.ts`. A user delete should leave zero orphaned rows.
- **Indexes, not scans.** Convex queries use `.withIndex(...)`; unbounded `.collect()` on growable tables is a bug.
- **Typecheck before commit.** `npx tsc --noEmit` (delete `.next/types` and `.next/dev/types` first if Next generated them; don't pipe tsc's output — pipes mask the exit code).
- **No secrets in git.** `.env.local` is gitignored; deployment secrets live as Convex env vars, and the DB stores env-var *names* (`signingSecretRef`), never values.
- **Fail closed on auth, fail soft on email.** Anything guarding access rejects when uncertain; anything sending email degrades gracefully.

## Environment variable reference

All of these are **Convex deployment env vars** (`npx convex env set NAME value`), not `.env.local` entries — the backend reads them, and per-deployment separation (dev vs prod) comes free.

| Var | Required | Purpose |
|---|---|---|
| `SITE_URL` | ✅ | Origin used in auth redirects and emailed links (`http://localhost:3000` in dev, your real domain in prod) |
| `OPERATOR_EMAIL` | ✅ (once) | Email the operator seed (`seed:bootstrapOperator`) provisions |
| `JWT_PRIVATE_KEY`, `JWKS` | ✅ (auto) | Auth token signing — created by `npx @convex-dev/auth`, don't set by hand |
| `AUTH_RESEND_KEY` | optional | Enables all email: magic-link sign-in/reset + `convex/email.ts`. Unset → email features hide themselves |
| `AUTH_EMAIL_FROM` | optional | From-address, e.g. `Your App <hello@yourdomain.com>` (defaults to Resend's test sender) |
| `PROVISION_WEBHOOK_SECRET` | optional | HMAC secret for `POST /provision`. Unset → webhook rejects everything |
| `OPENROUTER_API_KEY` | optional | App-level AI fallback key; users' own keys take precedence |

`.env.local` (written by `npx convex dev`, gitignored) holds only the pointers: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`.

## Testing

```bash
npm run test:run       # everything (72 tests)
npm run test:convex    # backend only — convex-test in the edge runtime
npm run test:ui        # components only — Testing Library in jsdom
npm run test           # watch mode
```

Patterns worth stealing:

- Backend tests build a real in-memory Convex with `convexTest(schema, modules)` and act as a signed-in user via `t.withIdentity({ subject: userId })`.
- External HTTP (OpenRouter, Resend) is stubbed with `vi.stubGlobal("fetch", …)`; env vars with `vi.stubEnv(...)` — no network in tests.
- Component tests mock `convex/react` hooks (`useQuery` / `useMutation` / `useAction`) and assert on real user interactions.

## Deploying to production

**Convex** and **Vercel** pair like this:

1. Push to GitHub, import the repo in [Vercel](https://vercel.com/new).
2. Set the Vercel **build command** to:
   ```
   npx convex deploy --cmd 'npm run build'
   ```
   This deploys your Convex functions to the **prod** deployment and builds Next with the prod Convex URL baked in.
3. In the Convex dashboard → Settings → **Deploy keys**, generate a key and add it to Vercel env as `CONVEX_DEPLOY_KEY`.
4. Set prod env vars on the **prod** Convex deployment (dashboard → Settings → Environment variables, or `npx convex env set --prod`): at minimum `SITE_URL=https://your-domain.com`, plus JWT keys (`npx @convex-dev/auth --prod`) and whichever optional vars you use.
5. Seed the prod operator once: `npx convex run seed:bootstrapOperator --prod`, then visit `https://your-domain.com/activate/<token>`.

Dev and prod are fully separate deployments with separate data and env vars — your local `npx convex dev` never touches production.

## Directory map

```
app/
  (app)/               # authenticated shell: sidebar layout + pages
    admin/             #   operator console
    dashboard/         #   ← replace with your product
    settings/          #   profile / password / AI key
  activate/[token]/    # activation flow (pre-seeded accounts)
  join/[token]/        # signup-link flow
  signin/  reset/      # sign-in and magic-link reset
  ConvexClientProvider.tsx
components/
  admin/               # admin console widgets (tables, dialogs)
  auth/                # auth forms (split-panel UI)
  settings/            # settings cards (Profile, Security, AI)
  ui/                  # shadcn-style primitives (Base UI)
convex/
  schema.ts            # all tables — start here to understand the data
  access.ts            # require* helpers — every function starts with one
  auth.ts  authGate.ts # Convex Auth config + token-gated signup
  ai.ts                # BYOK OpenRouter keys
  email.ts             # the one email module (Resend, fail-soft)
  operator.ts          # admin console backend + user delete cascade
  provisioning.ts      # tokens: create / validate / consume
  provisionHttp.ts     # POST /provision webhook (HMAC)
  seed.ts              # operator bootstrap
  *.test.ts            # backend tests, colocated
lib/security/headers.ts # response-header hardening
middleware.ts            # route protection
vitest.config.ts         # two projects: convex (edge) + ui (jsdom)
```

## Troubleshooting

- **"Not signed in" / redirected to `/signin` right after activating** — the auth cookie can lag the redirect by a beat; just sign in normally, the account is created.
- **`npx tsc --noEmit` errors about `convex/_generated`** — regenerate the API types with `npx convex codegen` (they drift when you add/remove Convex modules without a running `convex dev`).
- **Replaced an image in `public/` but the browser shows the old one** — Next's dev image-optimizer cache lives at `.next/dev/cache/images`; delete it and hard-reload.
- **Magic links / invite emails not arriving** — check `AUTH_RESEND_KEY` is set on the deployment (`npx convex env list`) and that the from-address domain is verified in Resend.
- **Webhook returns 401** — the signature must be HMAC-SHA256 of the *raw request body* using `PROVISION_WEBHOOK_SECRET`, hex-encoded, in the `x-app-signature` header.
- **Locked out of the operator account** — `npx convex run seed:bootstrapOperator` is idempotent; if the operator exists but you lost the password, use `/reset` (email must be configured) or issue a fresh activation token from the Convex dashboard by inserting a `provisioningTokens` row.
