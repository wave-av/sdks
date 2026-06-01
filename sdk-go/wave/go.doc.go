// Package wave is the official WAVE API client for Go.
//
// Generated from the WAVE gateway OpenAPI contract (codegen/openapi.yaml) — do
// not edit generated files by hand; re-run `python3 codegen/generate.py`.
//
// All requests are authenticated with an API key (Bearer) and routed through
// the gateway at https://api.wave.online/v1, which enforces entitlement
// server-side (401 unauthenticated / 402 not-entitled / 403 out-of-scope).
//
// Usage:
//
//	c, err := wave.New("wave_live_...")
//	if err != nil { log.Fatal(err) }
//	clip, err := c.Clips.Get(context.Background(), "clip_123")
package wave
