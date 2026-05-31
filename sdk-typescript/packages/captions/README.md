# @wave-av/captions

Typed client for **WAVE Captions** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/captions      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createCaptionsAPI } from "@wave-av/captions";

const api = createCaptionsAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
