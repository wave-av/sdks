# WAVE SDK for Rust

Official Rust client for the [WAVE](https://wave.online) API. Generated from the gateway OpenAPI
contract. Two crates: `wave-core` (transport + types) and `wave` (the umbrella you depend on).

```toml
[dependencies]
wave-sdk = "0.1"
```

## Usage

```rust
use wave_sdk::Client;

fn main() -> Result<(), wave_sdk::Error> {
    let client = Client::new("wave_live_...")?;

    let clip = client.clips().get("clip_123")?;
    println!("{:?}", clip.title);

    let params = wave_sdk::clips::ClipsListParams { video_id: Some("vid_1".into()), ..Default::default() };
    let page = client.clips().list(&params)?;
    println!("{} of {}", page.data.len(), page.pagination.total);
    Ok(())
}
```

## Notes

- **Auth + entitlement** are enforced server-side at the gateway (`401`/`402`/`403`).
- **Configuration:** `Client::builder(key).base_url(..).max_retries(n).timeout(..).build()`.
  Defaults: base `https://api.wave.online/v1`, 3 retries, 30s timeout. HTTP via `ureq` (blocking).
- **Errors:** all failures are the `wave_sdk::Error` enum (`Api`, `RateLimit`, `Network`,
  `Serialization`). Retries apply to `429`/`5xx`/transport with backoff + `Retry-After`.
- **Forward-compatible enums:** unknown enum values deserialize to the `Unknown` variant rather than
  erroring.
- **Generated** by `codegen/`; do not edit `src/**` by hand.

## Status

`v0.1.0` — all 12 contract-frozen products (49 operations). New; not yet exercised against the live
gateway end-to-end. License: MIT.
