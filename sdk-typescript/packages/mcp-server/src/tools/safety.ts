import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuthHeaders, getBaseUrl } from "../auth.js";
import { safetyState } from "../middleware/safety-state.js";
import type { CostEstimate } from "../middleware/safety-state.js";

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

function generateId(): string {
  return `est_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function registerSafetyTools(server: McpServer): void {
  server.tool(
    "wave_get_cost",
    "Estimate the monthly cost of a WAVE operation before executing it. Returns a cost estimate ID that must be confirmed with wave_confirm_cost before the operation proceeds.",
    {
      operation: z
        .string()
        .min(1)
        .max(200)
        .describe(
          "The operation to estimate cost for (e.g. 'create_stream', 'enable_recording', 'transcode_4k')",
        ),
      params: z
        .record(z.unknown())
        .optional()
        .describe("Optional parameters for the operation that affect cost (e.g. resolution, duration)"),
    },
    async ({ operation, params }) => {
      const res = await waveFetch("/v1/cost/estimate", {
        method: "POST",
        body: JSON.stringify({ operation, params: params ?? {} }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return errorContent(res.status, res.body);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(res.body) as Record<string, unknown>;
      } catch {
        return textContent(`Cost estimate received but could not be parsed: ${res.body}`);
      }

      const estimate: CostEstimate = {
        id: generateId(),
        operation,
        estimatedMonthlyCost:
          typeof parsed["estimatedMonthlyCost"] === "number"
            ? parsed["estimatedMonthlyCost"]
            : 0,
        breakdown:
          typeof parsed["breakdown"] === "object" && parsed["breakdown"] !== null
            ? (parsed["breakdown"] as Record<string, number>)
            : {},
        confirmed: false,
        createdAt: Date.now(),
      };

      safetyState.addEstimate(estimate);

      return textContent(
        JSON.stringify(
          {
            estimateId: estimate.id,
            operation,
            estimatedMonthlyCost: estimate.estimatedMonthlyCost,
            breakdown: estimate.breakdown,
            message: `Cost estimate created. Call wave_confirm_cost with id="${estimate.id}" to approve and proceed with the operation.`,
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "wave_confirm_cost",
    "Confirm a pending cost estimate by ID, allowing the associated operation to proceed. Estimates expire after 5 minutes.",
    {
      estimate_id: z
        .string()
        .min(1)
        .describe("The estimate ID returned by wave_get_cost"),
    },
    async ({ estimate_id }) => {
      const estimate = safetyState.confirmEstimate(estimate_id);

      if (!estimate) {
        return textContent(
          `No pending estimate found with ID "${estimate_id}". It may have expired or already been used. Call wave_get_cost to generate a new estimate.`,
        );
      }

      return textContent(
        JSON.stringify(
          {
            estimateId: estimate.id,
            operation: estimate.operation,
            estimatedMonthlyCost: estimate.estimatedMonthlyCost,
            confirmed: true,
            message: `Estimate confirmed. You may now proceed with the "${estimate.operation}" operation. Confirmation is valid for 5 minutes.`,
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "wave_set_read_only",
    "Enable or disable read-only mode for the MCP server. When read-only mode is active, all mutating operations (create, update, delete, start, stop) are blocked.",
    {
      enabled: z
        .boolean()
        .describe("Set to true to enable read-only mode, false to disable it"),
    },
    async ({ enabled }) => {
      safetyState.setReadOnly(enabled);

      return textContent(
        JSON.stringify(
          {
            readOnly: enabled,
            message: enabled
              ? "Read-only mode enabled. All mutating MCP operations are now blocked."
              : "Read-only mode disabled. All operations are now permitted.",
          },
          null,
          2,
        ),
      );
    },
  );
}
