# @wave-av/transcribe

Typed client for **WAVE Transcribe** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/transcribe      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createTranscribeAPI } from "@wave-av/transcribe";

const api = createTranscribeAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
