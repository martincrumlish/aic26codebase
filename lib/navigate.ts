// lib/navigate.ts — full-page navigation to another site (e.g. Stripe
// Checkout). A function of its own so tests can check where it would go.
export function goTo(url: string) {
  window.location.assign(url);
}
