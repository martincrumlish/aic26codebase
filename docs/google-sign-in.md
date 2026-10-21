# Google sign-in ("Continue with Google")

Optional. Until you do this, the button is hidden and everything else works as normal. It takes about 10 minutes, all in Google's free Cloud console. No billing account is needed.

You'll create an **OAuth client** in Google Cloud, which gives you a *client ID* and a *client secret*. Then `npm run setup:google` saves them on your Convex deployment.

## 1. Get your redirect URI

In the project folder, run:

```bash
npm run setup:google
```

It prints a line like this one, then waits for you to paste two values. Leave it open:

```
https://happy-otter-123.convex.site/api/auth/callback/google
```

That's your **redirect URI**: where Google sends people back after they sign in. It points at your Convex backend, not your website.

## 2. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your Google account.
2. In the project picker at the top of the page, click **New project**. Name it after your app, then click **Create**. Make sure the new project is selected in the picker.

## 3. Set up the consent screen

This is the "Sign in to *Your App* with Google" screen people see.

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and click **Get started**.
2. **App information:** your app's name, and your email as the support email. Click **Next**.
3. **Audience:** choose **External** (anyone with a Google account). Click **Next**.
4. **Contact information:** your email. Click **Next**, agree to the policy, and click **Create**.
5. In the left menu, open **Audience**. Under **Test users**, click **Add users** and add your own Google address. While the app is in "Testing", only test users can sign in.

## 4. Create the OAuth client

1. In the left menu, open **Clients** and click **Create client**.
2. **Application type:** Web application. **Name:** anything, e.g. "Web".
3. Under **Authorized redirect URIs**, click **Add URI** and paste the redirect URI from step 1, exactly as printed.
4. Click **Create**. A box shows your **Client ID** (ending in `.apps.googleusercontent.com`) and **Client secret** (starting `GOCSPX-`).

## 5. Paste them in

Back in the terminal from step 1, paste the Client ID, press Enter, then paste the Client secret and press Enter. It saves them as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on your Convex deployment.

Reload `/signin`: **Continue with Google** appears on the sign-in and sign-up pages.

## Going live

1. In your OAuth client (Google Auth Platform > **Clients**), add a second redirect URI for your **production** Convex deployment: `https://<your-prod-deployment>.convex.site/api/auth/callback/google`.
2. Save the same ID and secret on production:
   ```bash
   npm run setup:google -- --prod --convex-site-url https://<your-prod-deployment>.convex.site
   ```
3. In **Audience**, click **Publish app** so anyone can sign in, not just your test users. The app only asks for basic profile and email, so Google doesn't normally need to review it. Adding a logo on the **Branding** page can trigger a review.
4. Make sure `SITE_URL` on the production deployment is your real domain. People are sent back there after signing in.

## Who can sign in with Google

The rules are in `convex/authGate.ts`:

- **A new email:** gets a normal `user` account when sign-up is open (the default). In link mode (`SIGNUP_MODE=link`), Google can't create accounts.
- **An email that already has an account:** Google signs into it if that account has no password yet (for example, an account created by a purchase or by an admin that hasn't been activated) or if its email was confirmed by code. Signing in this way also cancels any activation links still out for that address.
- **An email with a password account that never confirmed its email:** refused. Anyone could have signed up with that address, and linking would leave them with a working password into the real owner's account. These people sign in with their password, then use **Connect Google** (below). With email set up (`AUTH_RESEND_KEY`), new password accounts confirm their email, so this only affects accounts created without it.
- **Revoked accounts** stay locked out.

When Google sign-in doesn't finish (a refusal above, or someone cancels at Google), they land back on `/signin` with a note telling them to use their password and then connect Google.

## Connect Google (Settings)

Signed-in users can add Google under **Settings > Google**: click **Connect Google**, choose their Google account, and they're back in Settings with Google connected. From then on, **Continue with Google** signs them straight in.

This is always safe, whatever the account's history, because the person has just proved both things: they're signed in to the account, and they signed in to the Google account. It attaches the Google account to the account that started the connection, never to one that merely has the same email (`convex/lib/googleConnect.ts`). One Google account per user; a Google account already used by someone else can't be moved. **Disconnect** is refused if Google is the account's only way to sign in.

## Troubleshooting

- **"Error 400: redirect_uri_mismatch"** - the redirect URI in Google Cloud must match exactly: `https`, the full `.convex.site` address (not `.convex.cloud`, and not your website), and `/api/auth/callback/google` with no trailing slash.
- **"Access blocked: this app's request is invalid", or only you can sign in** - the app is still in Testing. Add the person as a test user, or publish it (see Going live).
- **No Google button** - both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` must be set on the deployment the site is using. Check with `npx convex env list` (add `--prod` for production).
- **Back on the sign-in page after choosing a Google account** - see "Who can sign in with Google" above. The Convex dashboard's **Logs** page shows the exact reason.
