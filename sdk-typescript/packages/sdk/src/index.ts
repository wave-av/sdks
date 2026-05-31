/**
 * WAVE SDK umbrella — re-exports every @wave-av product client for one-install discovery.
 *
 * Prefer installing the individual @wave-av/<product> packages (e.g. @wave-av/clips) for a
 * smaller footprint — agents and sandboxes should pull only what they call, or skip the SDK
 * entirely and hit the gateway over HTTP. Entitlement is enforced server-side at the gateway
 * (401 unauthenticated / 403 under-scoped); installing a product package does not grant access.
 */
export * from "@wave-av/core";
export * as clips from "@wave-av/clips";
