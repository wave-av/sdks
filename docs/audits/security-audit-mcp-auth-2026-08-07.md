# Security Audit: MCP Server Tool Handlers, Platform Tools & Auth Patterns

**Date:** 2026-08-07
**Scope:** `sdk-typescript/packages/mcp-server/src/tools/`, `sdk-typescript/packages/core/src/index.ts`, `sdk-python/wave/client.py`, `sdk-go/wave/client.go`
**Auditor:** Automated security review

---

## Executive Summary

The codebase demonstrates generally sound security practices: Zod schemas enforce types, the gateway escape-hatch (`wave_gateway_call`) has SSRF protection, UUIDs are validated on most path parameters, and credentials are never logged. However, several medium- and low-severity issues were identified, primarily around **insufficient input validation on path-interpolated parameters**, **sensitive data exposure through MCP tool responses**, and a **potential privilege-escalation vector in scoped-key creation**.

---

## Finding 1: Path Traversal / Injection via Unvalidated Path Parameters

**Severity:** MEDIUM
**Type:** Insufficient Input Validation
**Fix location:** Client-side (MCP server tool schemas)

### Affected Files and Lines

| File | Line(s) | Parameter | Validation |
|------|---------|-----------|------------|
| `tools/config-branch.ts` | L80-83, L100-103 | `branch_id` | `z.string().min(1)` — no format restriction |
| `tools/clips.ts` | L122 | `clip_id` | `z.string().min(1)` — no format restriction |
| `tools/production.ts` | L39 | `source_id` | `z.string()` — completely unconstrained |
| `tools/production.ts` | L74 | `graphic_id` | `z.string()` — completely unconstrained |
| `tools/production.ts` | L105 | `preset_id` | `z.string().optional()` — unconstrained |
| `tools/chat.ts` | L38 | `message_id` | `z.string().min(1)` — no format restriction |
| `tools/agentic-media.ts` | L94, L118 | `resource_id` | `z.string()` — unconstrained (but L104 uses `encodeURIComponent`) |

### Description

Multiple tool parameters are interpolated directly into URL paths via template literals without format validation. For example:

```typescript
// config-branch.ts L86
const res = await waveFetch(`/v1/config/branches/${branch_id}/merge`, { ... });

// clips.ts L128
const res = await waveFetch(`/v1/clips/${clip_id}/export`, { ... });

// production.ts L83
const res = await waveFetch(`/v1/studio/productions/${production_id}/graphics/${graphic_id}`, { ... });
```

While `stream_id`, `camera_id`, `production_id`, and `switcher_id` are validated as `.uuid()`, parameters like `branch_id`, `clip_id`, `source_id`, `graphic_id`, and `message_id` use only `.string().min(1)` or bare `.string()`.

### Attack Chain

1. An MCP client (LLM agent) is tricked via prompt injection into calling `wave_merge_config_branch` with `branch_id` set to `../../admin/dangerous-endpoint`.
2. The resulting URL becomes `/v1/config/branches/../../admin/dangerous-endpoint/merge`.
3. Whether this resolves to a different route depends on the server-side URL parser. Many HTTP servers normalize `/../` segments, potentially routing the request to an unintended endpoint.
4. The request carries the user's full `Authorization: Bearer` header.

### Recommendation

Apply `.regex(/^[a-zA-Z0-9_-]+$/)` or `.uuid()` validation to all parameters interpolated into URL paths. Alternatively, use `encodeURIComponent()` consistently (as `agentic-media.ts` L104 already does for `resource_id`).

---

## Finding 2: Sensitive Credentials Returned to MCP Clients in Tool Responses

**Severity:** MEDIUM
**Type:** Sensitive Data Exposure
**Fix location:** Client-side (MCP server tools)

### Affected Files and Lines

| File | Line(s) | Tool | Risk |
|------|---------|------|------|
| `tools/auth-mgmt.ts` | L59-67 | `wave_get_stream_tokens` | Returns viewer tokens verbatim |
| `tools/auth-mgmt.ts` | L77-84 | `wave_rotate_stream_key` | Returns new ingest key verbatim |
| `tools/auth-mgmt.ts` | L91-96 | `wave_list_api_keys` | Returns all API keys with scopes |
| `tools/platform.ts` | L179-185 | `wave_platform_create_scoped_key` | Returns newly created API key verbatim |

### Description

These tools pass the raw API response body directly through `autoSizingTextContent(res.body)` without filtering. The API responses for key-creation and token-generation endpoints typically include the plaintext secret value.

In an MCP context, tool responses are consumed by LLM agents. The returned secrets become part of the conversation context, which means:
- They are sent to third-party LLM providers (anthropic, openai, etc.)
- They may be logged by the MCP host application
- They may appear in conversation history, debug logs, or telemetry
- The LLM may echo them back in its response to the user

### Attack Chain

1. User asks agent: "Create a new API key for my dashboard."
2. Agent calls `wave_platform_create_scoped_key`.
3. API returns `{"key": "wave_live_sk_abc123...", "id": "..."}`.
4. Full key value is returned as MCP tool result.
5. Key enters LLM context window → sent to LLM API → stored in conversation logs.

### Recommendation

Filter response bodies for these sensitive endpoints. Return only non-secret metadata (key ID, name, permissions, expiry, last-4 characters) and instruct the user to retrieve the full key from the dashboard. Example:

```typescript
const parsed = JSON.parse(res.body);
delete parsed.key;  // or parsed.secret, parsed.token
parsed.message = "Key created. Retrieve the full value from the dashboard.";
```

---

## Finding 3: Platform Key Privilege Escalation — `admin` Scoped Key Creation

**Severity:** MEDIUM
**Type:** Privilege Escalation
**Fix location:** Requires server-side enforcement (client-side mitigation possible)

### Affected File and Lines

`tools/platform.ts` L152-186 (`wave_platform_create_scoped_key`)

### Description

The `wave_platform_create_scoped_key` tool allows creating keys with `["admin"]` permission and with no `project_id` constraint (platform-wide). The Zod schema is:

```typescript
permissions: z
  .array(z.enum(["read", "write", "admin"]))
  .min(1)
  .describe("Permissions to grant"),
project_id: z
  .string()
  .uuid()
  .optional()
  .describe("Restrict this key to a specific project UUID. Omit for platform-wide access."),
```

There is **no client-side check** that the permissions of the newly created key do not exceed those of the creator's platform key. If the server-side API does not enforce this constraint (which cannot be verified from this client code), a holder of a `write`-scoped platform key could create a new `admin`-scoped key.

Additionally, `expires_at` is an optional free-text string with no validation:

```typescript
expires_at: z
  .string()
  .optional()
```

This accepts any string, not just ISO 8601 datetimes, which could cause unexpected behavior server-side.

### Recommendation

- **Server-side (primary):** Enforce that created keys cannot exceed the creator's permission scope.
- **Client-side (defense in depth):** Add `.datetime()` validation to `expires_at`. Consider adding a descriptive warning in the tool description about scope inheritance.

---

## Finding 4: Unregistered Tool Definitions (Dead Code with Security Surface)

**Severity:** LOW
**Type:** Defense in Depth / Code Hygiene
**Fix location:** Client-side

### Description

`server.ts` registers 7 tool modules, but 10 modules export `register*Tools` functions:

**Registered in `server.ts`:** streams, studio, analytics, billing, production, agentic-media, gateway
**NOT registered:** auth-mgmt, chat, clips, captions, config-branch, diagnostics, docs, platform, safety, types-gen

These unregistered tools are dead code that still exports functions. While they cannot be invoked via MCP today, they represent security-sensitive surface area (key rotation, API key listing, platform key creation, cost confirmation bypass) that could be inadvertently activated.

### Recommendation

Either register these tools explicitly with appropriate access controls, or remove the dead code. If they are intentionally gated behind a feature flag or separate entry point, document that.

---

## Finding 5: `production.ts` — Tool Registered Without a Name

**Severity:** LOW
**Type:** API Misuse / Bug
**Fix location:** Client-side

### Affected File and Lines

`tools/production.ts` L126-127

### Description

```typescript
server.tool(
  "Start real-time captions/transcription on a stream",  // This is the description, not a name
  {
    stream_id: z.string().uuid()...
```

The `McpServer.tool()` API expects `(name, description, schema, handler)`. Here, the description string is passed as the name, and no description is provided. The MCP SDK may interpret this as a 3-argument overload `(name, schema, handler)`, meaning the tool would be registered with the name `"Start real-time captions/transcription on a stream"` — an unusual, space-containing tool name that could cause issues with MCP clients.

### Recommendation

Add a proper tool name as the first argument: `"wave_start_captions_legacy"` or remove this tool (since `captions.ts` already provides `wave_start_captions`).

---

## Finding 6: WAVE_BASE_URL / WAVE_DOCS_URL Environment Variable Redirect (SSRF via Configuration)

**Severity:** LOW (requires environment access)
**Type:** SSRF via Environment Variable
**Fix location:** Client-side (defense in depth)

### Affected Files and Lines

| File | Line(s) | Variable |
|------|---------|----------|
| `auth.ts` | L25 | `WAVE_BASE_URL` / `WAVE_API_BASE` |
| `tools/docs.ts` | L10 | `WAVE_DOCS_URL` |

### Description

`getBaseUrl()` reads `WAVE_BASE_URL` (or `WAVE_API_BASE`) without validation. If an attacker can influence environment variables (e.g., via a compromised CI pipeline, shared hosting, or container escape), all API requests—including those carrying the `Authorization: Bearer` header—would be sent to the attacker's server.

The `gateway.ts` tool has SSRF protection via `normalizeGatewayPath()` that validates the **path**, but the **host** comes from `getBaseUrl()` which is unvalidated.

Similarly, `WAVE_DOCS_URL` in `docs.ts` L10 could redirect documentation search requests to an arbitrary server.

### Recommendation

Validate that `WAVE_BASE_URL` matches an expected pattern (e.g., `https://*.wave.online` or explicitly allowed staging URLs). At minimum, ensure it uses HTTPS.

---

## Finding 7: No Credential Redaction in Error Responses

**Severity:** LOW
**Type:** Information Disclosure
**Fix location:** Client-side

### Affected Pattern

All `errorContent()` functions across tool files return `res.body` verbatim:

```typescript
function errorContent(status: number, body: string) {
  return textContent(`Error ${status}: ${body}`);
}
```

### Description

If the WAVE API server ever returns an error response that includes request details (such as echoing back headers, including the `Authorization` header), this would be forwarded to the MCP client/LLM unfiltered. While well-designed APIs avoid this, defensive programming suggests sanitizing error bodies.

### Recommendation

Truncate error bodies to a reasonable length and scan for patterns that look like credentials (`Bearer `, `wave_live_`, `wave_test_`, etc.) before returning them.

---

## Finding 8: Safety State Not Enforced Across Tool Handlers

**Severity:** LOW
**Type:** Bypass of Safety Controls
**Fix location:** Client-side

### Affected Files

- `tools/safety.ts` — defines `wave_set_read_only` and `wave_confirm_cost`
- `middleware/safety-state.ts` — implements the state
- `server.ts` — does NOT register `registerSafetyTools`

### Description

The `SafetyState` class tracks read-only mode and cost confirmation, but:

1. `registerSafetyTools` is never called in `server.ts`, so safety tools are not available.
2. Even if registered, **no other tool checks `safetyState.isReadOnly()`** before performing mutations. The read-only mode is purely a flag with no enforcement.
3. `confirmEstimate()` marks an estimate as confirmed but **never removes it from the map**, leading to unbounded memory growth. Old confirmed estimates are only checked by `requiresConfirmation()` via a 5-minute TTL, but the map itself is never pruned.

### Recommendation

If the safety system is intended to be functional, integrate `safetyState.isReadOnly()` checks as middleware/guards on all mutating tool handlers. Add periodic cleanup of expired estimates.

---

## Auth Pattern Analysis

### TypeScript Core SDK (`sdk-typescript/packages/core/src/index.ts`)

**Strengths:**
- API key is validated as non-empty at construction time (L97-98)
- Bearer token auth via `Authorization` header (L323)
- Proper retry with exponential backoff + jitter (L390-395)
- Rate-limit handling with `Retry-After` parsing (L371-385)
- Timeout via `AbortController` (L302-313)

**Concerns:**
- `this.config.apiKey` is stored in a plain property on the config object. If the `WaveClient` instance is serialized (e.g., via `JSON.stringify`, debug inspection, or logging), the API key would be exposed. No `toJSON` override or `Symbol` protection is applied.
- Debug logging (`this.log()` at L408-412) does not log credentials, but `console.log` with `...args` could inadvertently capture request objects containing auth headers if callers pass them.

### Python SDK (`sdk-python/wave/client.py`)

**Strengths:**
- API key validated at construction (L107-108)
- httpx client with configured headers (L120-124)
- Proper retry/backoff logic (L203-258)

**Concerns:**
- `self.api_key` is a public attribute (L110). No `__repr__` override means `repr(client)` would show the object including `api_key` in its `__dict__` if anyone inspects it.
- `debug` mode (L117-118) calls `logging.basicConfig(level=logging.DEBUG)`, which sets the **root logger** to DEBUG. This means httpx's internal debug logging may log full request headers (including `Authorization: Bearer ...`) if httpx uses the standard logging system. This is a known httpx behavior.

### Go SDK (`sdk-go/wave/client.go`)

**Strengths:**
- API key validated at construction (L60-62)
- Clean retry/backoff with context cancellation support (L212-221)
- `apiKey` is a private (unexported) field on the struct — cannot be accessed externally

**Concerns:**
- No concerns identified. The Go SDK has the cleanest credential handling of the three.

---

## Retry Logic / Credential Rotation

All three SDKs retry with the **same credentials** on each attempt. This is the correct behavior: if a credential is rotated mid-request, the server would return 401 (not 429/5xx), and 401 is not in any SDK's retryable set. No credential rotation bugs were found.

However, the MCP server's `waveFetchWithRateLimit` in `auth.ts` calls `getApiKey()` on **every request** (via `getAuthHeaders()` in the retry loop at L48-54). This means if `WAVE_API_KEY` is changed in the environment during a retry cycle, the retry would pick up the new key. This is arguably a feature, not a bug, but worth documenting.

---

## Summary Table

| # | Finding | Severity | Fix Location |
|---|---------|----------|--------------|
| 1 | Path traversal via unvalidated path params | MEDIUM | Client (Zod schemas) |
| 2 | Secrets returned in MCP tool responses | MEDIUM | Client (response filtering) |
| 3 | Platform key privilege escalation | MEDIUM | Server + Client |
| 4 | Unregistered tool definitions (dead code) | LOW | Client (code hygiene) |
| 5 | Tool registered without proper name | LOW | Client (bug fix) |
| 6 | SSRF via env var redirect | LOW | Client (validation) |
| 7 | No credential redaction in error responses | LOW | Client (defense in depth) |
| 8 | Safety state not enforced | LOW | Client (integration) |

---

## Positive Security Observations

- **SSRF protection in gateway tool:** `normalizeGatewayPath()` in `gateway.ts` L38-48 properly rejects absolute URLs, protocol-relative URLs, and paths outside `/v1`.
- **UUID validation on most path params:** `stream_id`, `camera_id`, `production_id`, `switcher_id`, `project_id` all use `.uuid()`.
- **No credential logging:** Searched all `console.log`, `console.warn`, `process.stderr.write`, `logger.*` calls — none include API keys or tokens.
- **JSON serialization for request bodies:** All user input going into request bodies is serialized via `JSON.stringify()`, preventing injection into JSON payloads.
- **Zod enum constraints:** Protocol, action, and status parameters use `z.enum()` preventing arbitrary values.
- **Proper `encodeURIComponent` in agentic-media:** `resource_id` at L104 of `agentic-media.ts` is properly encoded.
- **Rate limit handling:** All three SDKs properly handle 429 responses with backoff.
