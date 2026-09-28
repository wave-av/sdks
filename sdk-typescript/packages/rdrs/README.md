# @wave-av/rdrs

Typed client + CLI for **RDRS** (Rapid Dispute Resolution Service, `api.rdrs.sh`).

**Standalone, unlike every other `@wave-av/*` package**: no `@wave-av/core` dependency, its own
base URL, and its own `rk_test_*` / `rk_live_*` API keys — never a WAVE gateway key. `custody:
"none"` on every response: RDRS never takes custody of funds, and remedies carry no hold or
escrow anywhere.

## Status

**RDRS is not live yet.** This package ships the typed client, offline ledger verification, and
CLI ahead of the service so the surface is reviewable and buildable now — it makes no claim of
liveness. `npx -y @wave-av/rdrs verify-chain` will fail (connection refused / non-2xx) until
`rdrs-service-ship` proves the API live. See that lane for the go-live receipt.

The types in `src/rdrs-types.ts` are hand-authored against the documented v1 contract, not
machine-generated — `wave-av/rdrs` has no `openapi.yaml` yet. Once it does, regenerate this
file from the pinned SHA and vendor the spec, matching how every carved `@wave-av/*` package
sources from its canonical monorepo.

## Install

```bash
npm i @wave-av/rdrs
```

## Quickstart (3 calls)

```ts
import { RdrsClient } from "@wave-av/rdrs";

const rdrs = new RdrsClient({ apiKey: process.env.RDRS_API_KEY });

// 1. Open a dispute (free).
const dispute = await rdrs.openDispute({ seller: "seller_1", order: "order_1", claim: "item never shipped" });

// 2. Attach evidence — the client computes a sha256 manifest before sending; the server
//    rejects an unsigned receipt with the `no_signed_receipt` error code.
await rdrs.attachEvidence(dispute.id, { receipt: signedReceiptJson });

// 3. Poll for the verdict — Ed25519-signed once decided, `{status:"cannot_decide_yet"}` until then.
const verdict = await rdrs.getVerdict(dispute.id);
if (verdict.status === "decided") {
  console.log(verdict.decision, verdict.verdict_hash);
}
```

Every write is billed to the losing side via `rdrs_*` Stripe meter events — there is no hold or
escrow anywhere in this flow. `checkSeller`, `getLedgerHead`, `getLedgerEntries`, and `preflight`
are free/public reads and work with no `apiKey` set.

## The ledger

`GET /ledger/entries` returns an append-only chain: `hash(n) = sha256(hash(n-1) + record(n))`,
genesis is 64 zeros. Verify it **offline**, with no trust in the server that served the bytes:

```ts
import { verifyChain } from "@wave-av/rdrs";

const entries = await rdrs.getLedgerEntries();
const result = await verifyChain(entries); // { ok, head, bad_index? }
```

`verifyChain` also takes an optional `publicKeyBase64` to additionally check the Ed25519
signature on every signed (verdict) entry — a chain that is hash-consistent but signed by the
wrong key still fails, at the first entry that doesn't verify.

## CLI

```bash
npx -y @wave-av/rdrs verify-chain [--base <url>]   # 'chain ok head=<hash>' or exit 1 + bad index
npx -y @wave-av/rdrs check <seller>                # seller attestation (free, public)
npx -y @wave-av/rdrs open --seller <id> --order <id> --claim "<text>" [--rush]
npx -y @wave-av/rdrs verdict <dispute-id>           # exit 1 while cannot_decide_yet
npx -y @wave-av/rdrs keys                           # how RDRS keys work (help text only)
```

Reads `RDRS_API_KEY` from the environment. No config files, ever.

```bash
export RDRS_API_KEY=rk_test_...
npx -y @wave-av/rdrs verify-chain --base https://api.rdrs.sh
# chain ok head=<64-hex>
```

## License

Part of [`wave-av/sdks`](https://github.com/wave-av/sdks). Apache-2.0 © WAVE Online, LLC.
