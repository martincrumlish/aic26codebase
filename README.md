# AIC26 Codebase - Next.js + Convex SaaS Starter

A starter for building **SaaS apps**. Anyone can sign up by default; flip one setting and it becomes **controlled signup**, where users only come in through the doors you open - a signup link per plan, a payment webhook that creates accounts on purchase, or an account an admin adds by hand. Clone it (or use it as a GitHub template), run one setup command, and you have a working app with sign-in, an admin console, user management, provisioning webhooks, password reset, transactional email, and bring-your-own-key AI support - all tested, all typed, ready for you to drop your actual product into.

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
  - [Billing (Stripe)](#billing-stripe)
  - [The Projects example](#the-projects-example)
  - [Provisioning webhook](#provisioning-webhook)
  - [Email](#email)
  - [AI chat and keys (OpenRouter)](#ai-chat-and-keys-openrouter)
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
| **Auth pages** | `/signup` (open sign-up), `/signin`, `/join/[token]` (signup via link), `/activate/[token]` (accounts created for someone else), `/reset` (password reset by emailed code); email confirmation by code when email is set up |
| **Auth gating** | `convex/authGate.ts` - open sign-up by default, or `SIGNUP_MODE=link` for signup links and pre-created accounts only; pre-created accounts can only be claimed with their own activation link; revoked users are locked out everywhere |
| **Roles** | `admin` and `user` on the users table, with `requireUser` / `requireAdmin` helpers in `convex/access.ts` |
| **Admin console** (`/admin`) | Stats; a users table (make/remove admin, set password, revoke/restore, delete with typed confirmation); signup-link generator and list; add-user dialog; webhook settings |
| **Billing** | Stripe subscriptions: Free and Pro (monthly/yearly), a `/pricing` page, upgrade via Stripe Checkout, Stripe's billing portal, "pay first, account second" for signed-out buyers, and `requirePro` to gate features. `npm run setup:stripe` sets up Stripe in one step |
| **Provisioning** | `POST /provision` Convex HTTP endpoint - HMAC-SHA256 signed, idempotent - creates users from your payment platform or any other system |
| **Email** | Optional. One fail-soft module over the Resend API; the app works without it, and features that need it explain or hide themselves |
| **AI chat** (`/chat`) | Saved conversations with replies that stream in live, Markdown rendering, a model picker (Claude, GPT, Gemini, DeepSeek via OpenRouter), rename and delete |
| **AI keys** | Users can bring their own OpenRouter key (verified before saving, stored write-only: the browser only ever sees the last 4 characters); Pro users can use the app's key instead |
| **App shell** | Sidebar on desktop; a top bar with a slide-out menu on phones; account menu with settings, dark/light mode, and sign-out |
| **Projects example** (`/projects`) | A complete worked feature to copy: paginated list, detail page, edit, file upload to Convex storage, delete, owner checks, and a Free-plan limit (3 projects) with an upgrade prompt |
| **Dashboard** | Intentionally a placeholder - it shows the loading-skeleton pattern and is where your product goes |
| **Settings** | Profile, billing, password change, AI key management |
| **Security** | Route protection, response-header hardening (`lib/security/headers.ts`), no secrets stored in the database |
| **Tests** | 227 passing tests: backend (convex-test) + React components (Testing Library) |

## Services and stack

**Services you sign up for** (all have free tiers):

| Service | What it does here | Needed? |
|---|---|---|
| [GitHub](https://github.com) | Where your copy of the code lives | Yes |
| [Convex](https://www.convex.dev) | Database, backend functions, sign-in, webhooks, file storage | Yes - to run it at all |
| [Vercel](https://vercel.com) | Hosts the website when you go live | Only to deploy |
| [Resend](https://resend.com) | Sends email (password reset codes, invite emails) | Optional |
| [OpenRouter](https://openrouter.ai) | AI models for the chat (one key reaches Claude, GPT, Gemini and more) | Optional |

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
- **`status`: `"active"` or `"revoked"`.** Revoking signs the person out everywhere and refuses them new sign-ins (even with the right password), without deleting anything; **Restore** undoes it.

To keep one admin from locking out another, an admin can't revoke, delete, or set the password of another admin until that admin's rights are removed, and nobody can change their own role.

> ⚠️ `role` and `status` are load-bearing: `convex/authGate.ts` and every `require*` helper depend on them. Keep their meaning intact when you extend the schema. If your product needs more tiers (say, paid plans), add a separate field such as `plan` rather than new roles.

### Auth flows

Who can create an account is one setting, `SIGNUP_MODE` (a Convex env var):

- **`open` (the default):** anyone can sign up at `/signup` with an email and password and gets the `user` role. The landing page shows **Get started** and the sign-in page links to sign-up.
- **`link`:** no anonymous sign-up. Every account starts with a signup link, a webhook, or an admin, so you control who gets in: `npx convex env set SIGNUP_MODE link`.

Both modes support all of the flows below:

1. **Open sign-up (`/signup`, open mode only).** Email + password.
2. **Signup link (`/join/<token>`).** An admin generates one in `/admin` (optionally locked to one email address). The visitor picks an email and password; `authGate` only lets the signup through if the link is valid. Links are **standing by default - no expiry, no use limit** - so one link can be the signup URL for a whole plan (for example, behind your checkout's thank-you page). Rotate a link whenever you like: revoke it in the Signup links list and generate a fresh one. For a one-off or time-limited invite, `admin.createSignupLink` also accepts `maxUses` and `ttlDays`.
3. **Activation (`/activate/<token>`).** For accounts that were created for someone (the first admin, or a webhook purchase). The person follows their activation link and sets a password. The link is the proof that the account is theirs: knowing the email alone is never enough to claim a pre-created account, and each link works once.
4. **Sign-in (`/signin`).** Email + password. A wrong password and an unknown email get the same "Invalid email or password" answer, so sign-in never reveals which emails have accounts (see the wrapper in `convex/auth.ts`). In link mode, sign-up failures likewise all get one message.
5. **Email confirmation.** Once email is set up (`AUTH_RESEND_KEY`), every password account must confirm its address with an 8-digit emailed code before it gets a session - new sign-ups, and any older account that never confirmed. Without email, nobody is asked. It switches on as soon as the key is set; no redeploy needed.
6. **Password reset (`/reset`).** Needs email to be set up. The user enters their email, receives an 8-digit code (valid 15 minutes), and sets a new password. The page never reveals whether an email has an account. Without email configured, the page says so and tells the user to ask an admin, who can use **Set password** in the users table.

`convex/authGate.ts` is wired into Convex Auth's `createOrUpdateUser` callback. Its rules, in order: existing accounts continue (revoked ones are rejected); a pre-created account is claimed only with its own activation token; a valid signup link creates an account; in open mode anyone else gets a new `user` account; otherwise it **fails closed**.

### The admin console

`/admin` is admin-only - enforced on the server by `requireAdmin` in every function it calls, not just by hiding the page.

- **Stats** - number of users, admins, and active signup links.
- **Signup links** - every active link with its signup count, **Copy**, and **Revoke**.
- **Users** - everyone, with their role and status. For each user: **Make admin** / **Remove admin**, **Set password** (signs them out everywhere), **Revoke** / **Restore**, and **Delete** (type the email to confirm). Delete removes the account, all its sign-in records, and all its app data - see [conventions](#project-conventions).
- **Generate signup link** - creates a standing link and gives you the URL to copy. If email is configured, a checkbox lets you email it straight to an address.
- **Add user account** - creates an account with a password you choose, so the person can sign in immediately.
- **Provisioning webhook** - the endpoint URL and whether its signing secret is set.

### Billing (Stripe)

Two plans out of the box - **Free** and **Pro** (monthly or yearly) - defined in `convex/lib/plans.ts` (names, features, limits) and `convex/lib/proPrice.json` (prices). Built on Convex's official Stripe component, which verifies Stripe's webhook signatures and keeps customers and subscriptions in sync.

**Set it up in one command** (a free Stripe account in test mode is all you need):

```bash
npm run setup:stripe
```

Paste your Stripe **test** secret key (Stripe dashboard: Developers > API keys) and it creates the Pro product and both prices, the webhook endpoint pointing at your Convex backend, and the customer-portal settings, then saves everything on your Convex deployment. Safe to re-run; change a price in `proPrice.json` and re-run to update it. Then try an upgrade at `/pricing` with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC).

What users get:
- **`/pricing`** (public) - plan cards with a monthly/yearly toggle.
- **Upgrade** - signed-in users go to Stripe Checkout and come back to Settings on Pro.
- **Settings > Billing** - current plan, renewal or end date, and **Manage billing**, which opens Stripe's own portal to switch interval, update the card, see invoices, or cancel.
- **Pay first, account second** - a signed-out visitor can **Buy Pro** straight away. When the payment completes, the webhook creates their account and the page Stripe returns them to (`/welcome`) lets them set a password (the link is emailed too, if email is set up). This is how you sell access in link-only mode. If the email already has an account, Pro is added to it and they're asked to sign in - an activation link is never handed out for an existing account.

For developers:
- **Gate paid features with `requirePro(ctx)`** from `convex/access.ts` (it works like `requireAdmin`), or read the plan with `getPlan(ctx, userId)` from `convex/lib/plan.ts`. The plan is always decided on the server from the synced subscriptions - never from anything the browser says.
- `PLANS.free.limits` / `PLANS.pro.limits` hold per-plan limits (the Projects example uses `projects`).
- Deleting a user from the admin console cancels their Stripe subscriptions, so nobody is billed for a deleted account.
- **Going live:** in Stripe, switch to live mode and run `npm run setup:stripe -- --prod --convex-site-url https://<your-prod-deployment>.convex.site` with your live secret key.

### The Projects example

`/projects` is a small but complete feature, there to be copied and renamed into your own (clients, documents, bookings...). Everything a real feature needs is in three files:

- **`convex/projects.ts`** - the backend, with a comment at the top listing each pattern:
  - every function starts with `requireUser`, and every read or write checks the project belongs to the caller. Someone else's project looks exactly like a missing one (`get` returns `null`; writes throw "Project not found"), so ids can't be probed.
  - `list` uses the `by_owner` index with pagination - never a full-table scan.
  - `create` enforces the plan limit on the server (`PLANS.free.limits.projects`, 3 by default; Pro is unlimited).
  - file upload in two steps: `generateUploadUrl` gives the browser a short-lived URL to POST the file to, then `setAttachment` records it (and enforces a 10 MB cap). Replacing or deleting cleans up the old file.
- **`components/projects/ProjectsList.tsx`** - `usePaginatedQuery` with **Load more**, plan usage ("2 of 3 projects on the Free plan"), and an **Upgrade to Pro** prompt at the limit.
- **`components/projects/ProjectDetail.tsx`** - edit form, attach/replace/remove a file, and delete with a confirmation dialog.

The table is in `convex/schema.ts`, and deleting a user deletes their projects and files (the cascade in `convex/admin.ts`). Tests: `convex/projects.test.ts` and the component tests next to each component.

**One Convex gotcha the example shows:** a mutation that throws is rolled back completely, including any file it deleted or anything it scheduled. So `setAttachment` *returns* `{ok: false, error}` for a too-big file instead of throwing - otherwise deleting the rejected file would be undone.

To remove the example: delete `app/(app)/projects/`, `components/projects/`, `convex/projects.ts` and its test, the `projects` table in the schema, its block in the `deleteUserAccount` cascade, the nav item in `components/app-shell/AppShell.tsx`, and `/projects(.*)` in `middleware.ts`.

### Provisioning webhook

For payment platforms other than Stripe. `POST https://<your-deployment>.convex.site/provision` lets another system create users - typically your payment platform's "new sale" webhook.

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

### AI chat and keys (OpenRouter)

`/chat` is a working AI chat built on [OpenRouter](https://openrouter.ai), which gives one API key access to models from Anthropic, OpenAI, Google and others.

**Which key pays** (`convex/lib/aiKey.ts`):
1. The user's own OpenRouter key, if they've added one in **Settings > AI**. They pay for their own usage, on any plan.
2. Otherwise the app's key (`OPENROUTER_API_KEY`), **if their plan includes it** - Pro does, Free doesn't (`PLANS.<plan>.limits.appAiKey` in `convex/lib/plans.ts`). To give everyone AI on your account, set `appAiKey: true` on Free too.
3. Otherwise chat explains how to turn AI on (add a key, or upgrade to Pro).

To try it: `npx convex env set OPENROUTER_API_KEY sk-or-v1-...` and upgrade your account to Pro, or paste your own key in Settings > AI.

**How it works** (`convex/chat.ts`, with the steps commented at the top):
- `send` saves your message and an empty reply marked "streaming", then schedules `generate`.
- `generate` calls OpenRouter with `stream: true` and writes the growing reply into the database a few times a second. The page's `listMessages` query is reactive, so the reply streams into every open tab with no streaming code in the browser.
- Errors (bad key, no credits, rate limits, a model that's unavailable) are written onto the reply in plain English, and the conversation can carry on.
- Only the models in `convex/lib/aiModels.ts` can be used, so nobody can run an expensive model on your key. Edit that list to change what's offered; the first one is the default.
- The assistant's instructions are `SYSTEM_PROMPT` at the top of `convex/chat.ts` - give it your product's voice there.
- Replies are rendered as Markdown (`components/chat/Markdown.tsx`), which never renders raw HTML from the model.

**Key storage:** the raw key lives in the `userApiKeys` table and is only read on the server (`lib/aiKey.ts`, `internal.ai.getOpenRouterKeyForUser`). The public `getAiStatus` returns `{enabled, source: "own" | "app", last4, appKeyNeedsPro}` and nothing more. Keys are checked with a live call to OpenRouter's authenticated `/api/v1/key` endpoint before saving (`/api/v1/models` is public and can't validate keys - don't "simplify" this).

Deleting a conversation, or a user, removes the messages in scheduled batches, since a long chat can have thousands. There's no per-user usage cap on the app key: if Pro users get it, watch your OpenRouter spend, or add a cap in `send`.

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

**5. Add your own tables.** The quickest way is to copy [the Projects example](#the-projects-example) and rename it. Either way, for every table whose rows belong to a user:
- Define it in `convex/schema.ts` **with an index on the owner field** (e.g. `.index("by_owner", ["ownerId"])`).
- Start every function that touches it with `requireUser` or `requireAdmin` from `convex/access.ts`, and check the row belongs to the caller.
- Add it to the **delete cascade** in `deleteUserAccount` in `convex/admin.ts` (section 1, before the auth records), including freeing any files it stores. The `projects` block there shows how.

**6. Decide how people get accounts.**
- Manual: generate standing signup links in `/admin` - e.g. one per plan - and rotate them whenever you like. Works out of the box.
- Automatic: point your payment platform's webhook at `/provision` with the shared secret.

**7. Configure optional services** as you need them: Resend (email), OpenRouter (AI) - each is one env var. See the [reference](#environment-variable-reference).

**8. Keep the tests green.** `npm run test:run` should pass before and after every change; the existing tests double as documentation of how sign-in and access control behave.

Working with an AI coding assistant? `AGENTS.md` (also read by Claude Code via `CLAUDE.md`) gives it this project's rules.

## Project conventions

These are the rules the codebase follows - future code (and AI assistants) should too. The same list is in `AGENTS.md`.

- **TDD.** Write the failing test first, watch it fail, implement, watch it pass. Backend tests sit next to their module (`convex/foo.test.ts`), component tests next to their component.
- **Access checks first.** Every Convex query, mutation, and action starts with `requireUserId`, `requireUser`, or `requireAdmin` from `convex/access.ts`. Actions have no database access, so they check through an internal query - see `email.assertAdmin` or `admin.passwordTarget`. The only deliberately public functions are the ones signed-out pages need: `provisioning.validateToken`, `passwordReset.available`, `signup.mode`, `billing.enabled`, `billing.guestCheckout`, and `billing.welcome`.
- **Never link a sign-up to an existing account by email alone.** A pre-created account can only be claimed with its own activation token, which `convex/authGate.ts` checks and uses up. Any new way of pre-creating accounts must issue a token and present it the same way (see `admin.createUserAccount`).
- **Write-only secrets.** Sensitive values (API keys, passwords) never reach the browser. Public queries return derived facts only (`last4`, booleans); raw values go through `internal*` functions.
- **Cascade deletes.** New user-owned tables must be added to `deleteUserAccount` in `convex/admin.ts`. Deleting a user should leave nothing behind.
- **Indexes, not scans.** Convex queries use `.withIndex(...)`; an unbounded `.collect()` on a table that can grow is a bug.
- **Typecheck before commit.** `npx tsc --noEmit` (delete `.next/types` and `.next/dev/types` first if Next generated them; don't pipe the output - pipes hide the exit code).
- **No secrets in git.** `.env.local` is gitignored; secrets live in Convex env vars, and the database stores env-var *names*, never values.
- **Fail closed on access, fail soft on email.** Anything guarding access refuses when unsure; email failures never break the action that sent the email.
- **A mutation that throws is rolled back.** That includes file deletes and scheduled functions. When cleanup must stick, return an error result instead of throwing (see `projects.setAttachment`).

## Environment variable reference

All of these are **Convex deployment env vars** (`npx convex env set NAME value`), not `.env.local` entries - the backend reads them, and dev and prod deployments each have their own.

| Var | Required | Purpose |
|---|---|---|
| `SITE_URL` | ✅ | The app's address, used in sign-in redirects and emailed links (`http://localhost:3000` in dev, your real domain in prod) |
| `ADMIN_EMAIL` | ✅ (once) | Email for the first admin, created by `seed:bootstrapAdmin` |
| `JWT_PRIVATE_KEY`, `JWKS` | ✅ (auto) | Sign-in token keys - created by `npx @convex-dev/auth`; don't set by hand |
| `AUTH_RESEND_KEY` | optional | Turns on email: password reset codes, email confirmation codes, and invite emails |
| `AUTH_EMAIL_FROM` | optional | From address, e.g. `Your App <hello@yourdomain.com>` (defaults to Resend's test sender) |
| `SIGNUP_MODE` | optional | `open` (default: anyone can sign up) or `link` (signup links, webhook, and admin-created accounts only) |
| `PROVISION_WEBHOOK_SECRET` | optional | Signing secret for `POST /provision`. Unset means the webhook rejects everything |
| `OPENROUTER_API_KEY` | optional | The app's AI key, used for plans that include it (Pro by default); users' own keys take priority |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY` | optional | Billing. Set all four with `npm run setup:stripe` rather than by hand. Unset means paid plans show as not set up yet |

`.env.local` (written by `npx convex dev`, gitignored) holds only the addresses of your dev deployment: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`.

## Testing

```bash
npm run test:run       # everything (227 tests)
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
    chat/              #   AI chat (new chat + [id] conversation)
    dashboard/         #   <- replace with your product
    projects/          #   the example feature (list + [id] detail)
    settings/          #   profile / password / billing / AI key
  activate/[token]/    # activation (accounts created for someone)
  join/[token]/        # signup via link
  signup/  signin/  reset/  # sign-up, sign-in, password reset
components/
  admin/               # admin console (users table, signup links, dialogs)
  app-shell/           # sidebar, phone menu, account menu
  auth/                # sign-in, signup, activation, reset forms
  billing/             # pricing cards, billing card, post-purchase welcome
  chat/                # chat layout, thread, conversation list, Markdown
  landing/             # <- replace with your landing page
  projects/            # the example feature's list and detail
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
  ai.ts                # users' own OpenRouter keys (Settings > AI)
  chat.ts              # AI chat: conversations, streamed replies
  lib/aiKey.ts         # which key pays for a user's AI calls
  lib/aiModels.ts      # the models the chat offers
  billing.ts           # Stripe: plans, checkout, portal, pay-first purchases
  projects.ts          # the example feature - copy this to build your own
  lib/plans.ts         # your plans (names, features, limits); prices in lib/proPrice.json
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
