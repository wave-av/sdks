/**
 * WAVE SDK umbrella — re-exports every @wave-av product client for one-install discovery.
 *
 * Prefer installing the individual @wave-av/<product> packages (e.g. @wave-av/clips) for a
 * smaller footprint — agents and sandboxes should pull only what they call, or skip the SDK
 * entirely and hit the gateway over HTTP. Entitlement is enforced server-side at the gateway
 * (401 unauthenticated / 403 under-scoped); installing a product package does not grant access.
 *
 * Some product namespaces are PREVIEW (client surface published ahead of GA; calls return
 * 403/404 until the product is live) — see each package README.
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
export * as studio from "@wave-av/studio";
export * as fleet from "@wave-av/fleet";
export * as mesh from "@wave-av/mesh";
export * as edge from "@wave-av/edge";
export * as scene from "@wave-av/scene";
export * as pipeline from "@wave-av/pipeline";
export * as cloudSwitcher from "@wave-av/cloud-switcher";
export * as creator from "@wave-av/creator";
export * as audience from "@wave-av/audience";
export * as marketplace from "@wave-av/marketplace";
export * as distribution from "@wave-av/distribution";
export * as connect from "@wave-av/connect";
export * as slides from "@wave-av/slides";
export * as desktop from "@wave-av/desktop";
export * as signage from "@wave-av/signage";
export * as qr from "@wave-av/qr";
export * as usb from "@wave-av/usb";
export * as cameraControl from "@wave-av/camera-control";
export * as prompter from "@wave-av/prompter";
export * as replay from "@wave-av/replay";
export * as pulse from "@wave-av/pulse";
export * as prism from "@wave-av/prism";
export * as zoom from "@wave-av/zoom";
export * as vault from "@wave-av/vault";
export * as drm from "@wave-av/drm";
export * as billing from "@wave-av/billing";
export * as notifications from "@wave-av/notifications";
export * as ghost from "@wave-av/ghost";
export * as autopilot from "@wave-av/autopilot";
export * as console from "@wave-av/console";
export * as discovery from "@wave-av/discovery";
