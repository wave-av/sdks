import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuthHeaders, getBaseUrl } from "../auth.js";
import { autoSizingTextContent } from "./large-result.js";

/**
 * agentic-media tools — MVP (Machine Video Protocol) MCP surface
 *
 * Exposes the four AVL Phase 5 endpoints to MCP-aware agents:
 *   - mvp_discover        → /v1/agentic-media/discover
 *   - mvp_request_resource → /v1/agentic-media/[resource]
 *   - mvp_request_delivery → /v1/agentic-media/delivery
 *   - mvp_list_receipts    → /v1/agentic-media/receipts
 *
 * Per AVL Phase 1/5 + MVP open spec.
 *
 * @see docs/specs/mvp-machine-video-protocol-v1.md
 * @see docs/decisions/adr/0135-wave-as-ai-video-layer.md
 */

async function waveFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text }] };
}

function errorContent(
  status: number,
  body: string,
): { content: Array<{ type: "text"; text: string }> } {
  return textContent(`Error ${status}: ${body}`);
}

export function registerAgenticMediaTools(server: McpServer): void {
  // Tool 1: discover resources
  server.tool(
    "mvp_discover",
    "Discover available agent media resources (streams, VODs, inference models). " +
      "Sends Accept-Codec / Accept-Protocol headers for codec/protocol negotiation. " +
      "Returns resource list with negotiated terms.",
    {
      kind: z
        .enum(["stream", "vod", "inference", "any"])
        .default("any")
        .describe("Resource type filter"),
      query: z.string().optional().describe("Optional free-text query"),
      accept_codec: z
        .string()
        .optional()
        .describe("RFC 9110 Accept-Codec header value (e.g. 'video/h264, video/h265;q=0.8')"),
      accept_protocol: z
        .string()
        .optional()
        .describe("Accept-Protocol header value (e.g. 'webrtc, hls;q=0.7')"),
      limit: z.number().int().positive().max(100).default(20),
    },
    async ({ kind, query, accept_codec, accept_protocol, limit }) => {
      const params = new URLSearchParams({ kind, limit: String(limit) });
      if (query) params.set("q", query);
      const headers: Record<string, string> = {};
      if (accept_codec) headers["Accept-Codec"] = accept_codec;
      if (accept_protocol) headers["Accept-Protocol"] = accept_protocol;

      const res = await waveFetch(
        `/v1/agentic-media/discover?${params.toString()}`,
        { headers },
      );
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  // Tool 2: request resource (handles 402 -> negotiation envelope)
  server.tool(
    "mvp_request_resource",
    "Request a specific MVP resource by ID. Without a vault token, returns a 402 " +
      "Payment Required envelope with negotiation terms. With a vault token in the " +
      "Accept-Payment header, returns the delivery URL + receipt.",
    {
      resource_id: z.string().describe("Resource identifier (e.g. 'stream_abc123')"),
      vault_token: z
        .string()
        .optional()
        .describe("Optional WAVE vault token (vt_*) for authenticated request"),
    },
    async ({ resource_id, vault_token }) => {
      const headers: Record<string, string> = {};
      if (vault_token) headers["Accept-Payment"] = vault_token;
      const res = await waveFetch(
        `/v1/agentic-media/${encodeURIComponent(resource_id)}`,
        { headers },
      );
      if (!res.ok && res.status !== 402) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  // Tool 3: explicit delivery request
  server.tool(
    "mvp_request_delivery",
    "Request a time-limited delivery URL for a discovered resource. Requires a " +
      "vt_stream_ vault token. Returns playback URL + EU AI Act Article 26 receipt id.",
    {
      resource_id: z.string().describe("Resource identifier from mvp_discover"),
      vault_token: z.string().describe("vt_stream_* vault token"),
      protocol: z
        .enum(["hls", "dash", "webrtc"])
        .default("hls")
        .describe("Delivery protocol preference"),
      preferred_bitrate_kbps: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional bitrate ladder selection in kbps"),
    },
    async ({ resource_id, vault_token, protocol, preferred_bitrate_kbps }) => {
      const body: Record<string, unknown> = { resource_id, protocol };
      if (preferred_bitrate_kbps !== undefined) {
        body.preferred_bitrate_kbps = preferred_bitrate_kbps;
      }
      const res = await waveFetch("/v1/agentic-media/delivery", {
        method: "POST",
        headers: {
          "Accept-Payment": vault_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  // Tool 4: list receipts (Article 26 audit export)
  server.tool(
    "mvp_list_receipts",
    "List inference + stream receipts for the agent's org. EU AI Act Article 26 " +
      "compatible. Filter by kind, agent_id, time window.",
    {
      vault_token: z.string().describe("vt_* vault token"),
      kind: z.enum(["inference", "stream", "all"]).default("all"),
      agent_id: z.string().optional(),
      since: z.string().datetime().optional().describe("ISO 8601 start of window"),
      until: z.string().datetime().optional().describe("ISO 8601 end of window"),
      limit: z.number().int().positive().max(500).default(50),
    },
    async ({ vault_token, kind, agent_id, since, until, limit }) => {
      const params = new URLSearchParams({ kind, limit: String(limit) });
      if (agent_id) params.set("agent_id", agent_id);
      if (since) params.set("since", since);
      if (until) params.set("until", until);
      const res = await waveFetch(
        `/v1/agentic-media/receipts?${params.toString()}`,
        { headers: { "Accept-Payment": vault_token } },
      );
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );
}
