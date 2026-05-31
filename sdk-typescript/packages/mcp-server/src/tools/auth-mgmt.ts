import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuthHeaders, getBaseUrl } from "../auth.js";
import { autoSizingTextContent } from "./large-result.js";

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

export function registerAuthMgmtTools(server: McpServer): void {
  server.tool(
    "wave_get_stream_tokens",
    "Generate viewer tokens for secure, time-limited access to a stream",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to generate tokens for"),
      viewer_id: z
        .string()
        .min(1)
        .max(200)
        .describe("Identifier for the viewer (e.g. user ID or email)"),
      expires_in: z
        .number()
        .int()
        .min(60)
        .max(86_400)
        .optional()
        .describe("Token lifetime in seconds (60-86400, default 3600)"),
    },
    async ({ stream_id, viewer_id, expires_in }) => {
      const payload: Record<string, unknown> = {
        streamId: stream_id,
        viewerId: viewer_id,
      };
      if (expires_in !== undefined) payload["expiresIn"] = expires_in;

      const res = await waveFetch("/v1/auth/viewer-tokens", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_rotate_stream_key",
    "Rotate the ingest key for a stream. The old key is immediately invalidated.",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream whose key to rotate"),
    },
    async ({ stream_id }) => {
      const res = await waveFetch(`/v1/streams/${stream_id}/rotate-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_list_api_keys",
    "List all API keys in your WAVE account including their scopes and last-used timestamps",
    {},
    async () => {
      const res = await waveFetch("/v1/auth/api-keys");
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
