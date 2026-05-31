import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBaseUrl } from "../auth.js";
import { autoSizingTextContent } from "./large-result.js";

/**
 * Platform tools use X-Wave-Platform-Key authentication (not the standard
 * Bearer token), sourced from the WAVE_PLATFORM_KEY environment variable.
 */
function getPlatformKey(): string {
  const key = process.env["WAVE_PLATFORM_KEY"];
  if (!key) {
    throw new Error(
      "WAVE_PLATFORM_KEY environment variable is required for platform tools. " +
        "Generate one at https://wave.online/settings/platform-keys",
    );
  }
  return key;
}

async function platformFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Wave-Platform-Key": getPlatformKey(),
      "Content-Type": "application/json",
      "User-Agent": "wave-mcp-server/0.1.0",
      ...init?.headers,
    },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function errorContent(
  status: number,
  body: string,
): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: `Error ${status}: ${body}` }] };
}

export function registerPlatformTools(server: McpServer): void {
  server.tool(
    "wave_platform_create_project",
    "Create an isolated streaming project for a platform customer. Each project gets its own namespace, billing, and resource limits.",
    {
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Human-readable project name (e.g. customer company name or app name)"),
    },
    async ({ name }) => {
      const res = await platformFetch("/v1/platforms/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_platform_list_projects",
    "List all streaming projects created under this platform account, with pagination support.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of projects to return (1-100, default 25)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of projects to skip for pagination (default 0)"),
    },
    async ({ limit, offset }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit ?? 25));
      params.set("offset", String(offset ?? 0));
      const res = await platformFetch(`/v1/platforms/projects?${params.toString()}`);
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_platform_get_usage",
    "Get aggregated usage metrics across all platform projects, including minutes streamed, bandwidth, storage, viewer counts, and cost.",
    {
      period: z
        .enum(["current", "previous", "custom"])
        .optional()
        .describe("Billing period to query (default: current)"),
      breakdown: z
        .enum(["summary", "daily", "by_project"])
        .optional()
        .describe("How to break down the usage data (default: summary)"),
      start_date: z
        .string()
        .optional()
        .describe("ISO 8601 start date, required when period=custom (e.g. 2026-01-01)"),
      end_date: z
        .string()
        .optional()
        .describe("ISO 8601 end date, required when period=custom (e.g. 2026-01-31)"),
    },
    async ({ period, breakdown, start_date, end_date }) => {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (breakdown) params.set("breakdown", breakdown);
      if (start_date) params.set("startDate", start_date);
      if (end_date) params.set("endDate", end_date);
      const query = params.toString();
      const res = await platformFetch(`/v1/platforms/usage${query ? `?${query}` : ""}`);
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_platform_transfer_project",
    "Initiate an ownership transfer for a platform project to another user. Returns a consent URL the target user must visit to accept the transfer.",
    {
      project_id: z
        .string()
        .uuid()
        .describe("The UUID of the project to transfer"),
      target_email: z
        .string()
        .email()
        .describe("Email address of the user who will receive ownership of the project"),
    },
    async ({ project_id, target_email }) => {
      const res = await platformFetch("/v1/platforms/transfer", {
        method: "POST",
        body: JSON.stringify({ projectId: project_id, targetEmail: target_email }),
      });
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_platform_create_scoped_key",
    "Create a scoped API key with specific permissions, optionally restricted to a single project. Use this to give customers programmatic access to their own project.",
    {
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Human-readable name for this key (e.g. 'Customer dashboard key')"),
      permissions: z
        .array(z.enum(["read", "write", "admin"]))
        .min(1)
        .describe("Permissions to grant: read (view only), write (create/update), admin (full control)"),
      project_id: z
        .string()
        .uuid()
        .optional()
        .describe("Restrict this key to a specific project UUID. Omit for platform-wide access."),
      expires_at: z
        .string()
        .optional()
        .describe("ISO 8601 expiry datetime for the key (e.g. 2027-01-01T00:00:00Z). Omit for no expiry."),
    },
    async ({ name, permissions, project_id, expires_at }) => {
      const payload: Record<string, unknown> = { name, permissions };
      if (project_id !== undefined) payload["projectId"] = project_id;
      if (expires_at !== undefined) payload["expiresAt"] = expires_at;
      const res = await platformFetch("/v1/platforms/keys", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) return errorContent(res.status, res.body);
      return autoSizingTextContent(res.body);
    },
  );
}
