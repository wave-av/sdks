import { defineConfig } from "tsup";

// RDRS is standalone (no @wave-av/core dependency), so — unlike the other product
// packages — it builds ESM-only with a real bin (rdrs), same shape as @wave-av/mcp-server.
// esbuild preserves a `#!/usr/bin/env node` shebang that is already the first line of an
// entry file, so cli.ts carries its own shebang and needs no `banner` here; adding a banner
// too would double it.
export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  shims: true,
});
