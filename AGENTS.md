# AGENTS.md

Instructions for AI coding assistants working in this repo. Read `README.md` for what the app does and how it's set up.

## Stack

Next.js 16 (App Router, React 19, TypeScript) + Convex (all backend code in `convex/`) + Convex Auth (email/password). UI: Tailwind CSS 4 and shadcn-style components on Base UI in `components/ui/`. Tests: Vitest with convex-test (backend) and Testing Library (components).

## Commands

- `npm run dev` - run the app (needs `.env.local`; run `npm run setup` once first)
- `npm run test:run` - all tests; `npm run test:convex` / `npm run test:ui` for one half
- `npx tsc --noEmit` - typecheck. Delete `.next/types` and `.next/dev/types` first if they exist, and never pipe the output (pipes hide the exit code)
- `npx convex dev --once` - push backend changes to the dev deployment and regenerate `convex/_generated`

## Rules

1. **Test first.** Write the failing test, run it and watch it fail for the right reason, implement, watch it pass. Backend tests go next to their module (`convex/foo.test.ts`); component tests next to their component.
2. **Every Convex function starts with an access check** from `convex/access.ts`: `requireUserId`, `requireUser`, or `requireAdmin`. Actions can't read the database, so they check through an internal query (see `email.assertAdmin`, `admin.passwordTarget`). Only `provisioning.validateToken` and `passwordReset.available` are deliberately public, because signed-out pages use them. Don't add more without a reason.
3. **Never trust a user id from the client for identity.** Derive the caller from the session (`requireUser`). A `userId` argument is only acceptable as the *target* of an admin action, after `requireAdmin`.
4. **User-owned tables:** index the owner field, check ownership in every function, and add the table to the delete cascade in `deleteUserAccount` (`convex/admin.ts`, section 1).
5. **Roles are `admin` and `user`; status is `active` or `revoked`.** `convex/authGate.ts` and `convex/access.ts` depend on both. For product tiers, add a separate field (e.g. `plan`) rather than new roles. Signup links and the webhook only ever create `user`.
6. **Secrets are write-only.** Never return raw keys or passwords from a public query; expose derived facts (`last4`, booleans) and read raw values through `internal*` functions.
7. **Email goes through `internal.email.send`** (which uses `convex/lib/resend.ts`). It never throws; check `sent`. Don't call the Resend API anywhere else.
8. **Use indexes.** Query with `.withIndex(...)`; no unbounded `.collect()` on tables that can grow.
9. **Don't reveal which emails have accounts.** Sign-in and reset errors must look the same for unknown and known addresses.
10. **Never link a sign-up to an existing account by email alone.** `convex/authGate.ts` only lets someone claim a pre-created account with that account's own activation token. Any new way of pre-creating accounts must issue an activation token and present it the same way (see `admin.createUserAccount`).
11. **No secrets in git.** `.env.local` is gitignored; secrets are Convex env vars (`npx convex env set`).
12. **Verify UI changes in a real browser**, at desktop and phone width, before calling them done.
13. **Commit per task** with a conventional-commit message (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`), after the typecheck and tests pass.

## Where things live

- App name/description: `lib/site.ts`
- Public landing page: `components/landing/Landing.tsx`
- Main signed-in screen (placeholder): `app/(app)/dashboard/page.tsx`
- Schema: `convex/schema.ts`; access helpers: `convex/access.ts`; admin backend: `convex/admin.ts`
