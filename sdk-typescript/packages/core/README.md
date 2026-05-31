# @wave-av/core

The base of the WAVE SDK: the gateway HTTP client, auth, shared types, and error mapping. Every `@wave-av/<product>` package depends on this.

```bash
npm i @wave-av/core
```

```ts
import { createClient } from "@wave-av/core";

const wave = createClient({
  apiKey: process.env.WAVE_API_KEY!,        // never hard-code; entitlement is checked server-side
  baseUrl: "https://api.wave.online",       // the WAVE gateway (default)
});
// `wave` is the typed client product packages build on. Unauthenticated → 401; under-scoped → 403.
```

Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
