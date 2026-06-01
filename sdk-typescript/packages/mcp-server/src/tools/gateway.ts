/**
 * Generic WAVE gateway call tool (DOG-3/DOG-4).
 *
 * The dedicated tools (streams, studio, captions, …) cover the common
 * surface, but the WAVE gateway (api.wave.online) fronts the full /v1 API.
 * `wave_gateway_call` is the escape hatch: it lets an MCP-aware agent invoke
 * ANY gateway /v1 route with the standard WAVE_API_KEY auth + rate-limit
 * awareness, without waiting for a bespoke tool to be carved.
 *
 * Auth/scope is enforced server-side at the gateway (a 403 means the key
 * lacks the scope for that route) — this client never escalates privilege.
 *
 * Convention (see auth.ts): WAVE_API_KEY (required) + WAVE_BASE_URL
 * (optional, defaults https://api.wave.online; WAVE_API_BASE accepted as alias).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { waveFetchWithRateLimit } from "../auth.js";
import { autoSizingTextContent } from "./large-result.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Validate + normalize a caller-supplied gateway path.
 *
 * Guards against SSRF / host-escape: the request URL is always
 * `${getBaseUrl()}${path}`, so the path must be a gateway-relative `/v1`
 * path — never an absolute URL, protocol-relative `//host`, or a path that
 * escapes the gateway mount. Pure function (no I/O) so it is unit-tested.
 *
 * @throws Error with an agent-actionable message when the path is unsafe.
 */
export function normalizeGatewayPath(rawPath: string): string {
  const path = (rawPath ?? "").trim();
  if (path.length === 0) throw new Error('path is required (e.g. "/v1/streams")');
  if (!path.startsWith("/")) throw new Error(`path must start with "/" (got "${rawPath}")`);
  if (path.startsWith("//")) throw new Error("path must not start with // (protocol-relative URLs are blocked)");
  if (path.includes("://")) throw new Error("path must be a gateway-relative path, not an absolute URL");
  if (path !== "/v1" && !path.startsWith("/v1/")) {
    throw new Error(`path must target the WAVE gateway /v1 surface (got "${rawPath}")`);
  }
  return path;
}

export function registerGatewayTools(server: McpServer): void {
  server.tool(
    "wave_gateway_call",
    "Make an authenticated call to any WAVE gateway /v1 endpoint. Use this for routes not covered " +
      "by a dedicated tool. Auth + scope are enforced at the gateway: 401 = bad/absent WAVE_API_KEY, " +
      "403 = the key lacks the scope for that route. Prefer a dedicated tool when one exists.",
    {
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .optional()
        .describe("HTTP method (default GET)"),
      path: z
        .string()
        .describe('Gateway-relative path under /v1, e.g. "/v1/streams" or "/v1/clips/{id}". Absolute URLs are rejected.'),
      query: z
        .record(z.string())
        .optional()
        .describe("Optional query-string parameters as key/value pairs"),
      body: z
        .unknown()
        .optional()
        .describe("Optional JSON request body (object). Ignored for GET/DELETE."),
    },
    async ({ method, path, query, body }) => {
      let normPath: string;
      try {
        normPath = normalizeGatewayPath(path);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textContent(`Invalid path: ${msg}`);
      }

      const m = method ?? "GET";
      const qs = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";

      const init: RequestInit = { method: m };
      if (body !== undefined && WRITE_METHODS.has(m)) {
        init.body = JSON.stringify(body);
      }

      const res = await waveFetchWithRateLimit(`${normPath}${qs}`, init);
      if (!res.ok) {
        const hint =
          res.status === 401
            ? "Check WAVE_API_KEY."
            : res.status === 403
              ? "The API key lacks the scope for this route. Check key scopes in the WAVE dashboard."
              : res.status === 404
                ? "Route not found — verify the /v1 path."
                : res.status >= 500
                  ? "Gateway error — retry shortly; see https://status.wave.online"
                  : "";
        return textContent(
          `Error ${res.status} calling ${m} ${normPath}: ${res.body}${hint ? `\n\nNext step: ${hint}` : ""}`,
        );
      }

      return autoSizingTextContent(res.body);
    },
  );
}
