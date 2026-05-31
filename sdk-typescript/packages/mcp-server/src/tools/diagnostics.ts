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

export function registerDiagnosticsTools(server: McpServer): void {
  server.tool(
    "wave_get_logs",
    "Retrieve recent logs from a WAVE service for debugging and observability",
    {
      service: z
        .enum(["api", "stream", "transcode", "auth", "storage"])
        .describe("The service to fetch logs from"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Maximum number of log lines to return (default 100)"),
      level: z
        .enum(["error", "warn", "info", "debug"])
        .optional()
        .describe("Minimum log level to include (default: info)"),
      since: z
        .string()
        .optional()
        .describe("ISO 8601 timestamp to fetch logs since (e.g. '2024-01-01T00:00:00Z')"),
    },
    async ({ service, limit, level, since }) => {
      const params = new URLSearchParams();
      params.set("service", service);
      if (limit !== undefined) params.set("limit", String(limit));
      if (level) params.set("level", level);
      if (since) params.set("since", since);

      const res = await waveFetch(`/v1/logs?${params.toString()}`);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_get_advisors",
    "Get security and performance recommendations for your WAVE account configuration",
    {
      category: z
        .enum(["security", "performance", "reliability", "cost", "all"])
        .optional()
        .describe("Category of advisors to return (default: all)"),
    },
    async ({ category }) => {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);

      const query = params.toString();
      const path = `/v1/advisors${query ? `?${query}` : ""}`;
      const res = await waveFetch(path);
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_run_health_audit",
    "Run a comprehensive health audit across all WAVE services and return actionable findings",
    {
      scope: z
        .enum(["full", "streaming", "auth", "storage", "billing"])
        .optional()
        .describe("Scope of the health audit (default: full)"),
    },
    async ({ scope }) => {
      const payload: Record<string, unknown> = {};
      if (scope) payload["scope"] = scope;

      const res = await waveFetch("/v1/health/audit", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
