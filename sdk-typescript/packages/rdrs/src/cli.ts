#!/usr/bin/env node
/**
 * @wave-av/rdrs — CLI (`rdrs`).
 *
 * Reads `RDRS_API_KEY` from the environment. No config files, ever.
 *
 * `runCli` is the pure, testable core: it takes argv + injectable deps (fetch, env, stdout,
 * stderr) and returns an exit code — it never touches `process` directly, so tests can drive
 * it against fixtures with no network and no real environment.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RdrsClient, RdrsError, DEFAULT_BASE_URL } from "./client";
import { verifyChain } from "./verify";

export interface CliDeps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token?.startsWith("--")) {
      const name = token.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else if (token !== undefined) {
      positional.push(token);
    }
  }
  return { command, positional, flags };
}

const KEYS_HELP = `rdrs keys — how RDRS API keys work

  1. Sign in at https://rdrs.sh (email, 6-digit code — no WAVE branding).
  2. Create an account, then generate a key from the dashboard.
  3. Keys are shown exactly once at creation (rk_test_... / rk_live_...) and stored
     hashed server-side after that — copy it immediately, there is no "reveal again".
  4. Export it for this CLI:  export RDRS_API_KEY=rk_test_...

This command performs no network call; it only prints the steps above.`;

export async function runCli(argv: string[], deps: CliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env;
  const out = deps.stdout ?? ((line: string) => console.log(line));
  const err = deps.stderr ?? ((line: string) => console.error(line));
  const { command, positional, flags } = parseArgs(argv);
  const base = typeof flags.base === "string" ? flags.base : DEFAULT_BASE_URL;

  const client = () =>
    new RdrsClient({
      apiKey: env.RDRS_API_KEY,
      baseUrl: base,
      fetch: deps.fetch,
    });

  try {
    switch (command) {
      case "verify-chain": {
        const entries = await client().getLedgerEntries();
        const result = await verifyChain(entries);
        if (result.ok) {
          out(`chain ok head=${result.head}`);
          return 0;
        }
        err(`chain BROKEN at index ${result.bad_index} head=${result.head}`);
        return 1;
      }

      case "check": {
        const seller = positional[0];
        if (!seller) {
          err("usage: rdrs check <seller>");
          return 2;
        }
        const attestation = await client().checkSeller(seller);
        out(JSON.stringify(attestation));
        return 0;
      }

      case "open": {
        const seller = flags.seller;
        const order = flags.order;
        const claim = flags.claim;
        if (typeof seller !== "string" || typeof order !== "string" || typeof claim !== "string") {
          err("usage: rdrs open --seller <id> --order <id> --claim <text> [--rush]");
          return 2;
        }
        const dispute = await client().openDispute({ seller, order, claim, rush: flags.rush === true });
        out(JSON.stringify(dispute));
        return 0;
      }

      case "verdict": {
        const disputeId = positional[0];
        if (!disputeId) {
          err("usage: rdrs verdict <id>");
          return 2;
        }
        const verdict = await client().getVerdict(disputeId);
        out(JSON.stringify(verdict));
        return verdict.status === "cannot_decide_yet" ? 1 : 0;
      }

      case "keys": {
        out(KEYS_HELP);
        return 0;
      }

      default: {
        err("usage: rdrs <verify-chain|check|open|verdict|keys> [options]");
        return 2;
      }
    }
  } catch (e) {
    if (e instanceof RdrsError) {
      err(`rdrs: ${e.code}: ${e.message}`);
      return 1;
    }
    err(`rdrs: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  process.exitCode = code;
}

// Only run when executed directly (`rdrs ...` / `node dist/cli.js ...`), never on import — so
// tests can import `runCli` without triggering a real CLI invocation. Compares REALPATHs, not
// raw paths: `/tmp` is a symlink to `/private/tmp` on macOS, so `process.argv[1]` (as typed on
// the invoking shell) and `import.meta.url` (resolved by Node) can disagree byte-for-byte while
// naming the same file — a raw string compare silently never fires there.
function isDirectRun(): boolean {
  if (typeof process === "undefined" || !process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main();
}
