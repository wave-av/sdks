# @wave-av/editor

Typed client for **WAVE Editor** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

```bash
npm i @wave-av/editor      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createEditorAPI } from "@wave-av/editor";

const api = createEditorAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
