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

export function registerConfigBranchTools(server: McpServer): void {
  server.tool(
    "wave_create_config_branch",
    "Create a new configuration branch to safely test changes before applying them to production",
    {
      name: z
        .string()
        .min(1)
        .max(100)
        .describe("Name for the configuration branch (e.g. 'test-lower-bitrate')"),
      description: z
        .string()
        .max(500)
        .optional()
        .describe("Optional description of what this branch is for"),
    },
    async ({ name, description }) => {
      const payload: Record<string, unknown> = { name };
      if (description !== undefined) payload["description"] = description;

      const res = await waveFetch("/v1/config/branches", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_list_config_branches",
    "List all configuration branches in your WAVE account",
    {},
    async () => {
      const res = await waveFetch("/v1/config/branches");
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_merge_config_branch",
    "Merge a configuration branch into production, applying its settings",
    {
      branch_id: z
        .string()
        .min(1)
        .describe("The ID of the configuration branch to merge"),
    },
    async ({ branch_id }) => {
      const res = await waveFetch(`/v1/config/branches/${branch_id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );

  server.tool(
    "wave_delete_config_branch",
    "Delete a configuration branch without merging it",
    {
      branch_id: z
        .string()
        .min(1)
        .describe("The ID of the configuration branch to delete"),
    },
    async ({ branch_id }) => {
      const res = await waveFetch(`/v1/config/branches/${branch_id}`, {
        method: "DELETE",
      });
      if (!res.ok) return errorContent(res.status, res.body);

      return autoSizingTextContent(res.body);
    },
  );
}
