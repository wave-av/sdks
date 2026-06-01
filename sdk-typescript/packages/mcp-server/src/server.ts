// cspell:ignore modelcontextprotocol
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { initOtel } from "./tools/otel-init.js";
import { registerStreamTools } from "./tools/streams.js";
import { registerStudioTools } from "./tools/studio.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerBillingTools } from "./tools/billing.js";
import { registerProductionTools } from "./tools/production.js";
import { registerAgenticMediaTools } from "./tools/agentic-media.js";
import { registerGatewayTools } from "./tools/gateway.js";
import { registerStreamResources } from "./resources/streams.js";
import { registerProductionResources } from "./resources/productions.js";

export async function startServer(): Promise<void> {
  // P18.4 #4 — Initialize Dash0 OTLP visibility (no-op when DASH0_AUTH_TOKEN unset).
  // Resolves CR PR #4438 r3249315049: telemetry init must not block server boot.
  // If exporter wiring throws (e.g., bad endpoint, network), log + continue with
  // no-op tracer rather than crash startup.
  try {
    initOtel();
  } catch (err) {
    const console_ = (globalThis as { console?: { warn?: (...args: unknown[]) => void } }).console;
    console_?.warn?.('[wave-mcp-server] OTEL init failed; continuing without telemetry:', err);
  }

  const server = new McpServer({
    name: "wave-mcp-server",
    version: "0.1.0",
  });

  // Register tools
  registerStreamTools(server);
  registerStudioTools(server);
  registerAnalyticsTools(server);
  registerBillingTools(server);
  registerProductionTools(server);
  registerAgenticMediaTools(server);
  registerGatewayTools(server);

  // Register resources (wave:// URI scheme)
  registerStreamResources(server);
  registerProductionResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[wave-mcp-server] Connected via stdio transport\n");
}
