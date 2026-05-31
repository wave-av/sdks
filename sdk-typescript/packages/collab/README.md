# @wave-av/collab

Typed client for **WAVE Collab** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/collab      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createCollabAPI } from "@wave-av/collab";

const api = createCollabAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
