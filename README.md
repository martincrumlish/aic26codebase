# AIC26 Codebase - Next.js + Convex SaaS Starter

A starter for building **SaaS apps with controlled signup**. Users come in through the doors you open - a signup link per plan, a payment webhook that creates accounts on purchase, or an account an admin adds by hand - never through anonymous open registration. Clone it (or use it as a GitHub template), run one setup command, and you have a working app with sign-in, an admin console, user management, provisioning webhooks, password reset, transactional email, and bring-your-own-key AI support - all tested, all typed, ready for you to drop your actual product into.

This is not a demo. The patterns are the hardened kind: signup that fails closed, write-only secret storage, cascade deletes, no account enumeration, and a backend where every function starts with an access check.

- **Repo:** https://github.com/martincrumlish/aic26codebase
- **Deploys to:** Vercel (frontend) + Convex Cloud (backend)

---

## Table of contents

- [What you get](#what-you-get)
- [Services and stack](#services-and-stack)
- [Quickstart: running it locally](#quickstart-running-it-locally)
- [How the app works](#how-the-app-works)
  - [Roles: admin and user](#roles-admin-and-user)
  - [Auth flows](#auth-flows)
  - [The admin console](#the-admin-console)
  - [Provisioning webhook](#provisioning-webhook)
  - [Email](#email)
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
| **Landing page** | A plain public home page at `/` (name and description from `lib/site.ts`) - replace it with your own marketing page |
| **Auth pages** | `/signin`, `/join/[token]` (signup via link), `/activate/[token]` (accounts created for someone else), `/reset` (password reset by emailed code) |
| **Auth gating** | `convex/authGate.ts` - signup only works with a valid signup link or a pre-created account, and fails closed otherwise; revoked users are locked out everywhere |
| **Roles** | `admin` and `user` on the users table, with `requireUser` / `requireAdmin` helpers in `convex/access.ts` |
| **Admin console** (`/admin`) | Stats; a users table (make/remove admin, set password, revoke/restore, delete with typed confirmation); signup-link generator and list; add-user dialog; webhook settings |
| **Provisioning** | `POST /provision` Convex HTTP endpoint - HMAC-SHA256 signed, idempotent - creates users from your payment platform or any other system |
| **Email** | Optional. One fail-soft module over the Resend API; the app works without it, and features that need it explain or hide themselves |
| **BYOK AI** | Per-user OpenRouter API keys, verified before saving, stored write-only (the browser only ever sees the last 4 characters), with an optional app-wide fallback key |
| **App shell** | Sidebar on desktop; a top bar with a slide-out menu on phones; account menu with settings, dark/light mode, and sign-out |
| **Dashboard** | Intentionally a placeholder - it shows the loading-skeleton pattern and is where your product goes |
| **Settings** | Profile, password change, AI key management |
| **Security** | Route protection, response-header hardening (`lib/security/headers.ts`), no secrets stored in the database |
| **Tests** | 112 passing tests: backend (convex-test) + React components (Testing Library) |

## Services and stack

**Services you sign up for** (all have free tiers):

| Service | What it does here | Needed? |
|---|---|---|
| [GitHub](https://github.com) | Where your copy of the code lives | Yes |
| [Convex](https://www.convex.dev) | Database, backend functions, sign-in, webhooks, file storage | Yes - to run it at all |
| [Vercel](https://vercel.com) | Hosts the website when you go live | Only to deploy |
| [Resend](https://resend.com) | Sends email (password reset codes, invite emails) | Optional |
| [OpenRouter](https://openrouter.ai) | AI models, if you add AI features | Optional |

**Code stack:**

- **[Next.js 16](https://nextjs.org)** - App Router, React 19, TypeScript, Turbopack
- **[Convex](https://convex.dev)** - the entire backend lives in `convex/`; there's no separate API server, ORM, migration tool, or session store
- **[Convex Auth](https://labs.convex.dev/auth)** - email + password sign-in, with password reset by emailed code
- **[Tailwind CSS 4](https://tailwindcss.com)** + shadcn-style components on [Base UI](https://base-ui.com) (`components/ui/`), [next-themes](https://github.com/pacocoursey/next-themes) for dark mode, [Lucide](https://lucide.dev) icons, [Sonner](https://sonner.emilkowal.ski) toasts
- **[Vitest](https://vitest.dev)** + [convex-test](https://www.npmjs.com/package/convex-test) + Testing Library

---

## Quickstart: running it locally

Never done this before? Follow the steps exactly and you'll have the app running in about 10 minutes. If you're experienced, the short version is: Node 20+, `git clone`, `npm install`, `npm run setup`, `npm run dev` - skip ahead.

### Step 0: Install the tools (one-time)

You need two things on your computer:

1. **Node.js** (version 20 or newer) - this is what runs the app. Download the installer from [nodejs.org](https://nodejs.org) (pick the "LTS" button) and click through it. This also installs `npm`, the command that fetches the app's dependencies.
2. **Git** - this is what downloads the code. Download it from [git-scm.com/downloads](https://git-scm.com/downloads) and click through the installer (the default options are fine).

You'll also need a **free Convex account** - Convex hosts the app's database and backend. Sign up at [convex.dev](https://www.convex.dev) (you can use your GitHub or Google account). You don't need to do anything in the dashboard yet; the setup step below connects to it automatically.

### Step 1: Open a terminal

The terminal is where you'll type the commands below.

- **Windows:** press the Start key, type `powershell`, and press Enter.
- **Mac:** press Cmd+Space, type `terminal`, and press Enter.

### Step 2: Download the code

First decide where you want the project to live - for example a `dev` folder in your home directory. In the terminal, type these commands one at a time, pressing Enter after each:

```bash
mkdir dev
cd dev
git clone https://github.com/martincrumlish/aic26codebase.git my-app
cd my-app
```

What each one does: `mkdir dev` creates the folder (skip it if you already have one), `cd dev` moves into it, `git clone ... my-app` downloads the code into a new folder called `my-app` (name it whatever you like), and `cd my-app` moves you into the project. Every command from here on is typed from inside this folder.

### Step 3: Install the dependencies

```bash
npm install
```

This downloads the libraries the app is built on. It takes a minute and prints a lot of text - that's normal. Warnings are fine; you only have a problem if it ends with `npm error`.

### Step 4: Run the setup

```bash
npm run setup
```

This is one guided script that wires everything up. It will:

1. **Connect to Convex** - a browser window opens asking you to log in to your Convex account (first time only), then it asks you to create a project: accept the suggested name or type your own, and press Enter. This creates your personal backend and saves its address to a local file (`.env.local`).
2. **Generate the security keys** the login system needs - automatic, nothing to do.
3. **Ask for your email address** - type the email you want for the admin account and press Enter.
4. **Create your admin account** and print an **activation link** that looks like `http://localhost:3000/activate/a90ba35f-...`. Keep the terminal open - you'll click that link in a moment.

If anything fails, you can safely run `npm run setup` again - it picks up where it left off.

### Step 5: Start the app and activate your account

```bash
npm run dev
```

This starts the app on your computer and keeps running (leave the terminal open; press Ctrl+C when you want to stop it). Now open the activation link from step 4 in your browser, set a password, and sign in.

You're the **admin**. An **Admin** item appears in the sidebar - from there you can generate signup links, add users, and manage everyone's accounts. That's the whole loop; everything else (email, AI, webhooks) is optional and off until you configure it.

<details>
<summary>Prefer to run the setup steps by hand instead of <code>npm run setup</code>?</summary>

```bash
npx convex dev --once                                # create deployment, write .env.local
npx @convex-dev/auth                                 # JWT keys
npx convex env set SITE_URL http://localhost:3000
npx convex env set ADMIN_EMAIL you@example.com
npx convex run seed:bootstrapAdmin                   # prints your activationToken
```

</details>

---

## How the app works

### Roles: admin and user

The `users` table (in `convex/schema.ts`) carries two fields that control access:

- **`role`: `"admin"` or `"user"`.** Admins see `/admin` and manage everyone. Everyone who signs up through a signup link or the payment webhook is a `user`. Admin rights are only ever granted by another admin (**Make admin** in the users table) or by the first-run seed.
- **`status`: `"active"` or `"revoked"`.** Revoking locks the account out of every function immediately, without deleting anything; **Restore** undoes it.

To keep one admin from locking out another, an admin can't revoke, delete, or set the password of another admin until that admin's rights are removed, and nobody can change their own role.

> ⚠️ `role` and `status` are load-bearing: `convex/authGate.ts` and every `require*` helper depend on them. Keep their meaning intact when you extend the schema. If your product needs more tiers (say, paid plans), add a separate field such as `plan` rather than new roles.

### Auth flows

There is **no anonymous open signup** - every account starts with a signup link, a webhook, or an admin, so you always control who gets in:

1. **Signup link (`/join/<token>`).** An admin generates one in `/admin` (optionally locked to one email address). The visitor picks an email and password; `authGate` only lets the signup through if the link is valid. Links are **standing by default - no expiry, no use limit** - so one link can be the signup URL for a whole plan (for example, behind your checkout's thank-you page). Rotate a link whenever you like: revoke it in the Signup links list and generate a fresh one. For a one-off or time-limited invite, `admin.createSignupLink` also accepts `maxUses` and `ttlDays`.
2. **Activation (`/activate/<token>`).** For accounts that were created for someone (the first admin, or a webhook purchase). The person follows their activation link and sets a password. The link is the proof that the account is theirs: knowing the email alone is never enough to claim a pre-created account, and each link works once.
3. **Sign-in (`/signin`).** Email + password.
4. **Password reset (`/reset`).** Needs email to be set up. The user enters their email, receives an 8-digit code (valid 15 minutes), and sets a new password. The page never reveals whether an email has an account. Without email configured, the page says so and tells the user to ask an admin, who can use **Set password** in the users table.

`convex/authGate.ts` is wired into Convex Auth's `createOrUpdateUser` callback. Its rules, in order: existing accounts continue (revoked ones are rejected); a pre-created account is claimed only with its own activation token; a brand-new account needs a valid signup link; anything else **fails closed**.

### The admin console

`/admin` is admin-only - enforced on the server by `requireAdmin` in every function it calls, not just by hiding the page.

- **Stats** - number of users, admins, and active signup links.
- **Signup links** - every active link with its signup count, **Copy**, and **Revoke**.
- **Users** - everyone, with their role and status. For each user: **Make admin** / **Remove admin**, **Set password** (signs them out everywhere), **Revoke** / **Restore**, and **Delete** (type the email to confirm). Delete removes the account, all its sign-in records, and all its app data - see [conventions](#project-conventions).
- **Generate signup link** - creates a standing link and gives you the URL to copy. If email is configured, a checkbox lets you email it straight to an address.
- **Add user account** - creates an account with a password you choose, so the person can sign in immediately.
- **Provisioning webhook** - the endpoint URL and whether its signing secret is set.

### Provisioning webhook

`POST https://<your-deployment>.convex.site/provision` lets another system create users - typically your payment platform's "new sale" webhook.

- **Signature:** HMAC-SHA256 of the raw request body with `PROVISION_WEBHOOK_SECRET`, hex-encoded, in the `x-app-signature` header. Unsigned or wrongly signed requests are rejected, and so is everything if the secret isn't set.
- **Idempotent:** each event carries an `externalId`; a repeat delivery returns the original result instead of creating a second account.
- **Always creates a `user`:** any `role` in the payload is ignored, so a leaked webhook secret can't create admins.
- **Body:**

```json
{
  "externalId": "evt_12345",
  "source": "stripe",
  "type": "purchase.completed",
  "email": "customer@example.com"
}
```

The endpoint creates (or finds) the account and a 7-day activation link, stored in `provisioningTokens`. The response is deliberately minimal (`{ok, deduped}`) so the link never leaks to the caller. Delivering it is up to you: the natural move is to have `ingestEvent` email the `/activate/<token>` link via `internal.email.send` once email is configured.

Set the secret with:

```bash
npx convex env set PROVISION_WEBHOOK_SECRET <random-string>
```

### Email

Email is optional. With `AUTH_RESEND_KEY` unset, the app works normally: the invite-email checkbox is hidden, and the reset page explains that email isn't set up.

- **Everything goes through one place:** `convex/lib/resend.ts` is the only code that talks to Resend. App code sends email with `internal.email.send`, which **never throws**: it returns `{sent: false, reason}` (`"no-key"`, `"resend-<status>"`, or `"network"`) so a failed email can't break the action that sent it.
- **Password reset codes** go through the same helper but fail loudly, because the user is waiting for the code.
- **To enable:** `npx convex env set AUTH_RESEND_KEY re_...` and optionally `npx convex env set AUTH_EMAIL_FROM "Your App <hello@yourdomain.com>"` (the domain must be verified in Resend).

### BYOK AI (OpenRouter)

`convex/ai.ts` lets each user bring their own [OpenRouter](https://openrouter.ai) key, so they pay for their own AI usage:

- **Settings > AI**: paste a key, click **Save & verify**. The key is checked with a live call to OpenRouter's authenticated `/api/v1/key` endpoint before it's saved (`/api/v1/models` is public and can't validate keys - don't "simplify" this).
- **Write-only storage**: the raw key lives in the `userApiKeys` table and can only be read by `internal.ai.getOpenRouterKeyForUser`, which the browser can't call. The public `getAiStatus` returns `{enabled, source: "own" | "app", last4}` and nothing more.
- **Which key gets used** by any AI feature you build: the user's own key, then the app-wide `OPENROUTER_API_KEY` env var, otherwise AI is off.

---

## Using this as the base for a new project

The intended workflow: **use the GitHub template** (or clone and re-init), rename it, wire a fresh Convex project, replace the placeholders, and build your product on the dashboard.

**1. Get your own copy.**
On GitHub, click **Use this template** (or `git clone`, delete the `.git` folder, and `git init` for a clean history).

**2. Rename the app.**
- `lib/site.ts` - your app's name and one-line description (used in the browser tab, the landing page, and search results)
- `package.json` - `name`
- `public/brand/` - replace `small-transparent.png` (sidebar logo; white on transparent suits the dark sidebar), `mid-transparent.png` (sign-in page logo), and `auth-bg.png` (sign-in page background)

**3. Wire a fresh Convex project** - follow the [Quickstart](#quickstart-running-it-locally).

**4. Replace the placeholders.**
- `components/landing/Landing.tsx` - the public home page
- `app/(app)/dashboard/page.tsx` - your main screen, keeping its loading-skeleton pattern

**5. Add your own tables.** For every table whose rows belong to a user:
- Define it in `convex/schema.ts` **with an index on the owner field** (e.g. `.index("by_owner", ["ownerId"])`).
- Start every function that touches it with `requireUser` or `requireAdmin` from `convex/access.ts`, and check the row belongs to the caller.
- Add it to the **delete cascade** in `deleteUserAccount` in `convex/admin.ts` (section 1, before the auth records), including freeing any files it stores. There's a `userApiKeys` example right there to copy.

**6. Decide how people get accounts.**
- Manual: generate standing signup links in `/admin` - e.g. one per plan - and rotate them whenever you like. Works out of the box.
- Automatic: point your payment platform's webhook at `/provision` with the shared secret.

**7. Configure optional services** as you need them: Resend (email), OpenRouter (AI) - each is one env var. See the [reference](#environment-variable-reference).

**8. Keep the tests green.** `npm run test:run` should pass before and after every change; the existing tests double as documentation of how sign-in and access control behave.

Working with an AI coding assistant? `AGENTS.md` (also read by Claude Code via `CLAUDE.md`) gives it this project's rules.

## Project conventions

These are the rules the codebase follows - future code (and AI assistants) should too. The same list is in `AGENTS.md`.

- **TDD.** Write the failing test first, watch it fail, implement, watch it pass. Backend tests sit next to their module (`convex/foo.test.ts`), component tests next to their component.
- **Access checks first.** Every Convex query, mutation, and action starts with `requireUserId`, `requireUser`, or `requireAdmin` from `convex/access.ts`. Actions have no database access, so they check through an internal query - see `email.assertAdmin` or `admin.passwordTarget`. The only deliberately public functions are the two that signed-out pages need: `provisioning.validateToken` and `passwordReset.available`.
- **Never link a sign-up to an existing account by email alone.** A pre-created account can only be claimed with its own activation token, which `convex/authGate.ts` checks and uses up. Any new way of pre-creating accounts must issue a token and present it the same way (see `admin.createUserAccount`).
- **Write-only secrets.** Sensitive values (API keys, passwords) never reach the browser. Public queries return derived facts only (`last4`, booleans); raw values go through `internal*` functions.
- **Cascade deletes.** New user-owned tables must be added to `deleteUserAccount` in `convex/admin.ts`. Deleting a user should leave nothing behind.
- **Indexes, not scans.** Convex queries use `.withIndex(...)`; an unbounded `.collect()` on a table that can grow is a bug.
- **Typecheck before commit.** `npx tsc --noEmit` (delete `.next/types` and `.next/dev/types` first if Next generated them; don't pipe the output - pipes hide the exit code).
- **No secrets in git.** `.env.local` is gitignored; secrets live in Convex env vars, and the database stores env-var *names*, never values.
- **Fail closed on access, fail soft on email.** Anything guarding access refuses when unsure; email failures never break the action that sent the email.

## Environment variable reference

All of these are **Convex deployment env vars** (`npx convex env set NAME value`), not `.env.local` entries - the backend reads them, and dev and prod deployments each have their own.

| Var | Required | Purpose |
|---|---|---|
| `SITE_URL` | ✅ | The app's address, used in sign-in redirects and emailed links (`http://localhost:3000` in dev, your real domain in prod) |
| `ADMIN_EMAIL` | ✅ (once) | Email for the first admin, created by `seed:bootstrapAdmin` |
| `JWT_PRIVATE_KEY`, `JWKS` | ✅ (auto) | Sign-in token keys - created by `npx @convex-dev/auth`; don't set by hand |
| `AUTH_RESEND_KEY` | optional | Turns on email: password reset codes and invite emails |
| `AUTH_EMAIL_FROM` | optional | From address, e.g. `Your App <hello@yourdomain.com>` (defaults to Resend's test sender) |
| `PROVISION_WEBHOOK_SECRET` | optional | Signing secret for `POST /provision`. Unset means the webhook rejects everything |
| `OPENROUTER_API_KEY` | optional | App-wide AI key; users' own keys take priority |

`.env.local` (written by `npx convex dev`, gitignored) holds only the addresses of your dev deployment: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`.

## Testing

```bash
npm run test:run       # everything (112 tests)
npm run test:convex    # backend only
npm run test:ui        # components only
npm run test           # watch mode
```

Patterns worth copying:

- Backend tests run a real in-memory Convex with `convexTest(schema, modules)` and act as a signed-in user via `t.withIdentity({ subject: userId })`.
- Sign-in flows are tested end to end through the real `auth:signIn` action - see `convex/passwordReset.test.ts`, which uses `vitest/authEnv.ts` to supply test signing keys.
- External HTTP (OpenRouter, Resend) is stubbed with `vi.stubGlobal("fetch", ...)` and env vars with `vi.stubEnv(...)`, so tests never touch the network.
- Component tests mock the `convex/react` hooks and drive the UI the way a user would.

## Deploying to production

**Convex** and **Vercel** pair like this:

1. Push your repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. The build command (`npx convex deploy --cmd 'npm run build'`) is already set in `vercel.json`. It deploys your backend to your **prod** Convex deployment and builds the site against it.
3. In the Convex dashboard, open **Settings > Deploy keys**, generate a production key, and add it in Vercel as the env var `CONVEX_DEPLOY_KEY`.
4. Set env vars on the **prod** Convex deployment (dashboard **Settings > Environment variables**, or `npx convex env set --prod ...`): at minimum `SITE_URL=https://your-domain.com` and `ADMIN_EMAIL`, plus the sign-in keys (`npx @convex-dev/auth --prod`) and any optional vars you use.
5. Create the production admin once: `npx convex run seed:bootstrapAdmin --prod`, then open `https://your-domain.com/activate/<token>` with the token it prints.

Dev and prod are completely separate, with their own data and env vars - running the app locally never touches production.

## Directory map

```
app/
  page.tsx             # "/" - landing page (signed in: redirects to dashboard)
  (app)/               # signed-in pages, wrapped in the app shell
    admin/             #   admin console
    dashboard/         #   <- replace with your product
    settings/          #   profile / password / AI key
  activate/[token]/    # activation (accounts created for someone)
  join/[token]/        # signup via link
  signin/  reset/      # sign-in and password reset
components/
  admin/               # admin console (users table, signup links, dialogs)
  app-shell/           # sidebar, phone menu, account menu
  auth/                # sign-in, signup, activation, reset forms
  landing/             # <- replace with your landing page
  settings/            # settings cards (profile, password, AI)
  ui/                  # shadcn-style building blocks (Base UI)
convex/
  schema.ts            # every table - start here to understand the data
  access.ts            # requireUser / requireAdmin - every function starts with one
  auth.ts  authGate.ts # sign-in setup + who's allowed to sign up
  admin.ts             # admin console backend + user delete cascade
  passwordReset.ts     # reset codes by email
  provisioning.ts      # signup/activation links: validate and consume
  provisionHttp.ts     # POST /provision webhook
  email.ts  lib/resend.ts  # sending email
  ai.ts                # BYOK OpenRouter keys
  seed.ts              # first-admin bootstrap
  *.test.ts            # backend tests, next to their modules
lib/site.ts            # your app's name and description
lib/security/headers.ts # security response headers
middleware.ts          # route protection
scripts/setup.mjs      # `npm run setup`
```

## Troubleshooting

- **Redirected to `/signin` right after activating** - the sign-in cookie can lag the redirect by a moment; just sign in normally, your account was created.
- **Activation or sign-in silently does nothing** - if another app built from this template ran on the same localhost port before, your browser holds stale sign-in cookies for a different backend. Clear site data for localhost (or use a private window) and retry.
- **`npx tsc --noEmit` errors about `convex/_generated`** - regenerate the types with `npx convex dev --once` (they go stale when you add or remove Convex files without `convex dev` running).
- **Replaced an image in `public/` but the browser shows the old one** - Next's dev image cache lives in `.next/dev/cache/images`; delete it and hard-reload.
- **Reset codes or invite emails not arriving** - check `AUTH_RESEND_KEY` is set (`npx convex env list`) and that the from-address domain is verified in Resend.
- **Webhook returns 401** - the signature must be HMAC-SHA256 of the *raw request body* using `PROVISION_WEBHOOK_SECRET`, hex-encoded, in the `x-app-signature` header. A 400 means `externalId` or `email` is missing.
- **Locked out of the only admin account** - if email is set up, use `/reset`. If not, open your deployment's **Data** page in the Convex dashboard, delete that person's row in `users` and their row in `authAccounts`, then run `npx convex run seed:bootstrapAdmin` for a fresh activation link (with `ADMIN_EMAIL` still set to that address). If there's a second admin, they can just use **Set password**.
