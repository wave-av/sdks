# WAVE SDK for Ruby

Official Ruby client for the [WAVE](https://wave.online) API. Generated from the gateway OpenAPI
contract. One gem, no runtime dependencies (stdlib `net/http`).

```ruby
gem "wave-sdk"
```

## Usage

```ruby
require "wave"

client = Wave::Client.new("wave_live_...")

clip = client.clips.get("clip_123")
puts clip["title"]

page = client.clips.list(video_id: "vid_1", per_page: 50)
puts "#{page['data'].length} of #{page['pagination']['total']}"

begin
  client.clips.get("missing")
rescue Wave::Error => e
  warn "[#{e.code}] #{e.message} (status #{e.status_code})"
end
```

## Notes

- **Auth + entitlement** are enforced server-side at the gateway (`401`/`402`/`403`).
- **Responses** are parsed JSON (`Hash` with string keys). Path params are positional, query params
  are keyword args, request bodies are a `Hash`.
- **Configuration:** `Wave::Client.new(key, base_url:, max_retries:, timeout:)`. Defaults: base
  `https://api.wave.online/v1`, 3 retries, 30s timeout.
- **Errors:** non-2xx → `Wave::Error`; `429` (after retries) → `Wave::RateLimitError`. Retries apply
  to `429`/`5xx`/network with backoff + `Retry-After`.
- **Generated** by `codegen/`; do not edit `lib/**` by hand.

## Status

`v0.1.0` — all 12 contract-frozen products (49 operations). New; not yet exercised against the live
gateway end-to-end. Requires Ruby ≥ 3.0. License: MIT.
