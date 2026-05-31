# @wave-av/clips

Typed client for **WAVE Clips** — create, list, export, and detect highlights through the WAVE gateway. Calls the clip-engine product; entitlement is enforced server-side (401 unauthenticated / 403 under-scoped).

```bash
npm i @wave-av/clips      # pulls @wave-av/core automatically
```

```ts
import { createClient } from "@wave-av/core";
import { createClipsAPI } from "@wave-av/clips";

const clips = createClipsAPI(createClient({ apiKey: process.env.WAVE_API_KEY! }));
const clip = await clips.create({ /* CreateClipRequest */ });
const ready = await clips.waitForReady(clip.id);
```

Install only the products you use. Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
