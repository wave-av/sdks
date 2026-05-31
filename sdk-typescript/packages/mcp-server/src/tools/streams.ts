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
  context?: string,
): { content: Array<{ type: "text"; text: string }> } {
  const action = actionableHint(status, context);
  const parsed = tryParseError(body);
  return textContent(`Error ${status}: ${parsed}${action ? `\n\nNext step: ${action}` : ""}`);
}

function tryParseError(body: string): string {
  try {
    const json = JSON.parse(body);
    return json.error?.message ?? json.message ?? json.title ?? body;
  } catch {
    return body;
  }
}

function actionableHint(status: number, context?: string): string {
  switch (status) {
    case 401: return "Check your WAVE_API_KEY. Generate a new one at https://wave.online/dashboard/api-keys";
    case 403: return "Your API key lacks permission for this action. Check your key scopes in the dashboard.";
    case 404: return context ? `The ${context} was not found. Use wave_list_streams to find valid IDs.` : "Resource not found. Verify the ID exists.";
    case 409: return "This resource is in a conflicting state (e.g., already started). Check its current status first.";
    case 422: return "Invalid parameters. Review the field requirements and try again.";
    case 429: return "Rate limit exceeded. Wait a moment and retry.";
    default: return status >= 500 ? "Server error. Try again in a few seconds. If persistent, check https://status.wave.online" : "";
  }
}

export function registerStreamTools(server: McpServer): void {
  server.tool(
    "wave_list_streams",
    "List all streams in your WAVE account with pagination support",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of streams to return (1-100, default 25)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of streams to skip for pagination (default 0)"),
      status: z
        .enum(["active", "idle", "error", "all"])
        .optional()
        .describe("Filter by stream status"),
    },
    async ({ limit, offset, status }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit ?? 25));
      params.set("offset", String(offset ?? 0));
      if (status && status !== "all") {
        params.set("status", status);
      }

      const res = await waveFetch(`/v1/streams?${params.toString()}`);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_create_stream",
    "Create a new stream in your WAVE account",
    {
      title: z.string().min(1).max(255).describe("Stream title"),
      description: z.string().max(2000).optional().describe("Stream description"),
      protocol: z
        .enum(["webrtc", "srt", "rtmp", "hls"])
        .optional()
        .describe("Streaming protocol (default: webrtc)"),
      record: z.boolean().optional().describe("Enable recording for this stream (default: false)"),
      region: z
        .string()
        .optional()
        .describe("Preferred ingest region (e.g., us-east-1, eu-west-1)"),
    },
    async ({ title, description, protocol, record, region }) => {
      const payload: Record<string, unknown> = { title };
      if (description !== undefined) payload["description"] = description;
      if (protocol !== undefined) payload["protocol"] = protocol;
      if (record !== undefined) payload["record"] = record;
      if (region !== undefined) payload["region"] = region;

      const res = await waveFetch("/v1/streams", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_start_stream",
    "Start a stream by its ID, transitioning it to the active state",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to start"),
    },
    async ({ stream_id }) => {
      const res = await waveFetch(`/v1/streams/${stream_id}/start`, {
        method: "POST",
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_stop_stream",
    "Stop an active stream by its ID",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to stop"),
    },
    async ({ stream_id }) => {
      const res = await waveFetch(`/v1/streams/${stream_id}/stop`, {
        method: "POST",
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_get_stream_health",
    "Get real-time health metrics for a stream including bitrate, frame rate, and latency",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to check"),
    },
    async ({ stream_id }) => {
      const res = await waveFetch(`/v1/streams/${stream_id}/health`);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
