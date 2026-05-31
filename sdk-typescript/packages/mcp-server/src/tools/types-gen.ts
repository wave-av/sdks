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

export function registerTypesTools(server: McpServer): void {
  server.tool(
    "wave_generate_types",
    "Generate TypeScript type definitions for the WAVE API. Returns a .ts file with all request/response types ready for use in your project.",
    {
      scope: z
        .enum(["all", "streams", "productions", "billing", "auth", "captions", "clips", "chat"])
        .optional()
        .describe("Which API domain to generate types for (default: all)"),
      format: z
        .enum(["typescript", "zod"])
        .optional()
        .describe(
          "Output format: raw TypeScript interfaces or Zod schemas with inferred types (default: typescript)",
        ),
    },
    async ({ scope, format }) => {
      const payload: Record<string, unknown> = {};
      if (scope) payload["scope"] = scope;
      if (format) payload["format"] = format;

      const res = await waveFetch("/v1/types/generate", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
