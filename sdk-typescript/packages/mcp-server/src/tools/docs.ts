import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoSizingTextContent } from "./large-result.js";

function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text }] };
}

function getDocsUrl(): string {
  return process.env["WAVE_DOCS_URL"] ?? "https://docs.wave.online";
}

export function registerDocsTools(server: McpServer): void {
  server.tool(
    "wave_search_docs",
    "Search WAVE documentation for a query string. Returns matching documentation sections, API references, and guides.",
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query to look up in the WAVE documentation"),
      path: z
        .string()
        .max(200)
        .optional()
        .describe(
          "Optional docs path prefix to restrict the search (e.g. '/api/v1', '/guides/streaming')",
        ),
    },
    async ({ query, path }) => {
      const docsBase = getDocsUrl();

      // Build a structured search request — no shell interpolation, args are sent as JSON fields.
      const payload: Record<string, unknown> = {
        query,
        caseSensitive: false,
      };
      if (path) {
        payload["path"] = path;
      }

      let res: Response;
      try {
        res = await fetch(`${docsBase}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8_000),
        });
      } catch (err) {
        // Graceful fallback: docs API unavailable
        const message =
          err instanceof Error ? err.message : String(err);
        return textContent(
          `WAVE docs search unavailable (${message}). Visit ${docsBase} directly or check https://docs.wave.online.`,
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Graceful fallback for non-200
        return textContent(
          `Docs search returned HTTP ${res.status}. Try searching https://docs.wave.online?q=${encodeURIComponent(query)} directly.${body ? `\n\nDetails: ${body}` : ""}`,
        );
      }

      const body = await res.text();
      return autoSizingTextContent(body);
    },
  );
}
