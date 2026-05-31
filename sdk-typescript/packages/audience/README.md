# @wave-av/audience

> ⚠️ **Preview.** The typed client surface is published ahead of GA. Calls return `403`/`404` until the product is live. Want it prioritized? Upvote at https://github.com/wave-av/sdks/issues (see CONTRIBUTING → product requests).

Typed client for **WAVE Audience** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/audience      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createAudienceAPI } from "@wave-av/audience";

const api = createAudienceAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
