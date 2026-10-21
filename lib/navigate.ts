// lib/navigate.ts — a full page load (to another site like Stripe Checkout,
// or a fresh start after signing out). A function of its own so tests can
// check where it would go.
export function goTo(url: string) {
  window.location.assign(url);
}
