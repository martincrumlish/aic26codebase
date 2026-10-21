// scripts/google-setup-core.mjs — the testable parts of `npm run setup:google`.

/** The "Authorized redirect URI" to paste into Google Cloud. */
export function googleRedirectUri(convexSiteUrl) {
  return `${convexSiteUrl.replace(/\/+$/, "")}/api/auth/callback/google`;
}

/** An error message for a likely paste mistake, or null if they look right. */
export function checkGoogleCredentials({ clientId, clientSecret }) {
  if (!clientId) return "No client ID entered.";
  if (clientId.startsWith("GOCSPX-") && clientSecret.endsWith(".apps.googleusercontent.com")) {
    return "The client ID and secret look swapped. The ID ends in .apps.googleusercontent.com.";
  }
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    return "That client ID doesn't look right: it should end in .apps.googleusercontent.com.";
  }
  if (!clientSecret) return "No client secret entered.";
  return null;
}
