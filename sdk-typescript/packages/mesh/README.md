# @wave-av/mesh

> ⚠️ **Preview.** The typed client surface is published ahead of GA. Calls return `403`/`404` until the product is live. Want it prioritized? Upvote at https://github.com/wave-av/sdks/issues (see CONTRIBUTING → product requests).

Typed client for **WAVE Mesh** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/mesh      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createMeshAPI } from "@wave-av/mesh";

const api = createMeshAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
