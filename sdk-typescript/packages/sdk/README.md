# @wave-av/sdk

The **umbrella** SDK — re-exports `@wave-av/core` plus every `@wave-av/<product>` client for one-install discovery.

```bash
npm i @wave-av/sdk
```

```ts
import { createClient, clips } from "@wave-av/sdk";
const wave = createClient({ apiKey: process.env.WAVE_API_KEY! });
const api = clips.createClipsAPI(wave);
```

> Prefer the individual `@wave-av/<product>` packages for a smaller footprint — agents and sandboxes should install only what they call, or skip the SDK and hit the gateway over HTTP. Entitlement is enforced at the gateway (install ≠ access).

Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
