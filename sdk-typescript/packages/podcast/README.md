# @wave-av/podcast

Typed client for **WAVE Podcast** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/podcast      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createPodcastAPI } from "@wave-av/podcast";

const api = createPodcastAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
