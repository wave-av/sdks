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

export function registerChatTools(server: McpServer): void {
  server.tool(
    "wave_moderate_chat",
    "Take a moderation action on a chat message in a stream",
    {
      message_id: z.string().min(1).describe("The ID of the chat message to moderate"),
      action: z
        .enum(["block", "flag", "allow"])
        .describe(
          "Moderation action: block removes the message, flag marks it for review, allow clears any flags",
        ),
      reason: z
        .string()
        .max(500)
        .optional()
        .describe("Optional reason for the moderation action (logged for audit trail)"),
    },
    async ({ message_id, action, reason }) => {
      const payload: Record<string, unknown> = {
        messageId: message_id,
        action,
      };
      if (reason) payload["reason"] = reason;

      const res = await waveFetch("/v1/chat/moderate", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_get_chat_history",
    "Retrieve chat message history for a stream with pagination",
    {
      stream_id: z.string().uuid().describe("The UUID of the stream to get chat history for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of messages to return (default: 50)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of messages to skip for pagination (default: 0)"),
      include_blocked: z
        .boolean()
        .optional()
        .describe("Include blocked/moderated messages in results (default: false)"),
    },
    async ({ stream_id, limit, offset, include_blocked }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));
      if (include_blocked !== undefined)
        params.set("includeBlocked", String(include_blocked));

      const query = params.toString();
      const path = `/v1/streams/${stream_id}/chat${query ? `?${query}` : ""}`;
      const res = await waveFetch(path);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
