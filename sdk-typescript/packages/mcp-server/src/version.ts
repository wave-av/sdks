import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The single source of truth for "what version of the WAVE MCP server is this?".
 *
 * `serverInfo.version` reported over the MCP protocol MUST derive from this module. A
 * hardcoded version literal in `server.ts` is the defect class, not a typo: the published
 * server shipped `version: "0.1.0"` as a literal that stopped tracking package.json, so
 * clients connecting to @wave-av/mcp-server@0.2.0 were told they were talking to 0.1.0 —
 * an MCP client cannot identify the build it connected to (VER-001, GA-2026-09-04).
 *
 * Resolution walks UP from this module's own location to the nearest directory holding a
 * package.json with a string `version`. That is deliberately depth-independent: in
 * development this file is `src/version.ts` (one level below the package root), while the
 * shipped bundle is a single `dist/index.js` (also one level below it) — but a fixed
 * `../package.json` would be one specific hop that silently breaks the moment either layout
 * changes depth, which is how depth-coupled version reads break at publish time.
 */

/** Returned when package.json cannot be located or parsed — never a plausible-looking version. */
export const UNKNOWN_VERSION = "0.0.0-unknown";

function readOwnVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    const { root } = parse(dir);

    for (;;) {
      const candidate = join(dir, "package.json");
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { name?: unknown; version?: unknown };
        // Only accept a package.json that actually IS this package — walking up past the
        // package root (e.g. into a monorepo's own package.json, or a consuming app's) would
        // silently report the WRONG package's version.
        if (pkg.name === "@wave-av/mcp-server" && typeof pkg.version === "string" && pkg.version.length > 0) {
          return pkg.version;
        }
      }

      if (dir === root) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}

/** The running server's version, read once from package.json at process start. */
export const MCP_SERVER_VERSION = readOwnVersion();
