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
export * as voice from "@wave-av/voice";
export * as captions from "@wave-av/captions";
export * as chapters from "@wave-av/chapters";
export * as editor from "@wave-av/editor";
export * as phone from "@wave-av/phone";
export * as collab from "@wave-av/collab";
export * as podcast from "@wave-av/podcast";
export * as studioAi from "@wave-av/studio-ai";
export * as transcribe from "@wave-av/transcribe";
export * as sentiment from "@wave-av/sentiment";
export * as search from "@wave-av/search";
