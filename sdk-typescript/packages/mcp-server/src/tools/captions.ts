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

export function registerCaptionTools(server: McpServer): void {
  server.tool(
    "wave_start_captions",
    "Start real-time captions for a live stream using Deepgram (live) or Cohere (VOD/transcription)",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to enable captions for"),
      provider: z
        .enum(["deepgram", "cohere"])
        .describe("Caption provider: deepgram for live streams, cohere for VOD transcription"),
      language: z
        .string()
        .min(2)
        .max(10)
        .optional()
        .describe("BCP-47 language code (e.g. 'en-US', 'es', 'fr-FR'). Default: 'en-US'"),
    },
    async ({ stream_id, provider, language }) => {
      const payload: Record<string, unknown> = { provider };
      if (language) payload["language"] = language;

      const res = await waveFetch(`/v1/streams/${stream_id}/captions`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_stop_captions",
    "Stop real-time captions for a stream",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to stop captions for"),
    },
    async ({ stream_id }) => {
      const res = await waveFetch(`/v1/streams/${stream_id}/captions`, {
        method: "DELETE",
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_get_transcript",
    "Retrieve the transcript for a stream (live or VOD). Returns timestamped caption segments.",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to get transcript for"),
      format: z
        .enum(["json", "srt", "vtt", "text"])
        .optional()
        .describe("Output format for the transcript (default: json)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Segment offset for pagination (default: 0)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Maximum number of segments to return (default: 200)"),
    },
    async ({ stream_id, format, offset, limit }) => {
      const params = new URLSearchParams();
      if (format) params.set("format", format);
      if (offset !== undefined) params.set("offset", String(offset));
      if (limit !== undefined) params.set("limit", String(limit));

      const query = params.toString();
      const path = `/v1/streams/${stream_id}/transcript${query ? `?${query}` : ""}`;
      const res = await waveFetch(path);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
