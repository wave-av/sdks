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

export function registerClipTools(server: McpServer): void {
  server.tool(
    "wave_create_clip",
    "Create a clip from a stream recording by specifying a time range",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to clip"),
      start_time: z
        .number()
        .min(0)
        .describe("Clip start time in seconds from the beginning of the recording"),
      end_time: z
        .number()
        .min(0)
        .describe("Clip end time in seconds from the beginning of the recording"),
      title: z
        .string()
        .min(1)
        .max(255)
        .optional()
        .describe("Optional title for the clip"),
      social_export: z
        .boolean()
        .optional()
        .describe(
          "Automatically optimize the clip for social media aspect ratios and duration limits (default: false)",
        ),
    },
    async ({ stream_id, start_time, end_time, title, social_export }) => {
      const payload: Record<string, unknown> = {
        streamId: stream_id,
        startTime: start_time,
        endTime: end_time,
      };
      if (title) payload["title"] = title;
      if (social_export !== undefined) payload["socialExport"] = social_export;

      const res = await waveFetch("/v1/clips", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_list_clips",
    "List clips associated with your WAVE account, optionally filtered by stream",
    {
      stream_id: z
        .string()
        .uuid()
        .optional()
        .describe("Filter clips by stream UUID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of clips to return (default: 25)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of clips to skip for pagination (default: 0)"),
    },
    async ({ stream_id, limit, offset }) => {
      const params = new URLSearchParams();
      if (stream_id) params.set("streamId", stream_id);
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));

      const query = params.toString();
      const path = `/v1/clips${query ? `?${query}` : ""}`;
      const res = await waveFetch(path);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_export_clip",
    "Export a clip to a social media platform (TikTok, YouTube Shorts, or Instagram Reels)",
    {
      clip_id: z.string().min(1).describe("The ID of the clip to export"),
      platform: z
        .enum(["tiktok", "youtube_shorts", "instagram_reels"])
        .describe("Target platform for the export"),
    },
    async ({ clip_id, platform }) => {
      const res = await waveFetch(`/v1/clips/${clip_id}/export`, {
        method: "POST",
        body: JSON.stringify({ platform }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
