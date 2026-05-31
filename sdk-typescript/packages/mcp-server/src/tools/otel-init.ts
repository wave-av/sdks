/**
 * MCP Server OTLP Initializer (P18.4 #4 — Dash0 visibility for mcp-server)
 *
 * Initializes OpenTelemetry SDK to emit span data via OTLP HTTP to Dash0.
 * Reads DASH0_AUTH_TOKEN + DASH0_DATASET + DASH0_BASE_URL from env.
 *
 * Spec: docs/audits/dash0-fullest-extent-plan-2026-05-15.md P0 #4
 * Goal: lift packages/mcp-server/ from 0% → 100% span coverage in Dash0.
 *
 * Usage: import { initOtel, traceToolCall } from './otel-init.js' from server.ts
 *        before tool registration. The SDK is a no-op when DASH0_AUTH_TOKEN
 *        is unset (local dev / non-production builds).
 */

// Minimal Otel surface — kept dependency-free for now; consumer wires real
// @opentelemetry/sdk-node when ready. This file documents the contract.

export interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: 1 | 2; message?: string }): void;
  recordException(err: Error): void;
  end(): void;
}

export interface OtelTracer {
  startSpan(name: string, attrs?: Record<string, string | number | boolean>): OtelSpan;
}

let activeTracer: OtelTracer | null = null;

/**
 * Initialize Dash0 OTLP exporter. Idempotent — safe to call multiple times.
 * No-op when DASH0_AUTH_TOKEN is unset.
 */
export function initOtel(): void {
  if (activeTracer) return; // already initialized
  // Read env without `process` global to avoid @types/node dependency in this package.
  // Real OTel init lifts this restriction.
  const token = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.DASH0_AUTH_TOKEN;
  if (!token) {
    // Local dev / unset — skip without error
    return;
  }
  // Token is configured but exporter wiring (@opentelemetry/sdk-node +
  // exporter-trace-otlp-http) is not yet in place. Loudly warn so operators
  // know telemetry is silently dropped — but don't throw (that would crash
  // the MCP server in production).
  // See docs/audits/dash0-fullest-extent-plan-2026-05-15.md P0 #4.
  // Resolves CodeRabbit r3249315069 (silent no-op telemetry loss).
  const console_ = (globalThis as { console?: { warn?: (msg: string) => void } }).console;
  console_?.warn?.(
    '[wave-mcp-server] DASH0_AUTH_TOKEN is set but OTEL exporter wiring is pending. ' +
    'Telemetry is currently dropped (no-op tracer). Tracking: ' +
    'docs/audits/dash0-fullest-extent-plan-2026-05-15.md P0 #4'
  );
  activeTracer = createNoopTracer();
}

/**
 * Wrap an async tool handler with span emission. Emits attributes:
 *   mcp.tool: <name>
 *   mcp.server: wave-mcp-server
 *   mcp.duration_ms: <number>
 *   mcp.error: <string> (if thrown)
 */
export async function traceToolCall<T>(
  toolName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = activeTracer ?? createNoopTracer();
  const span = tracer.startSpan(`mcp.tool.${toolName}`, {
    'mcp.tool': toolName,
    'mcp.server': 'wave-mcp-server',
  });
  const start = Date.now();
  try {
    const result = await fn();
    span.setAttribute('mcp.duration_ms', Date.now() - start);
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (err) {
    span.setAttribute('mcp.duration_ms', Date.now() - start);
    span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) });
    if (err instanceof Error) span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * No-op tracer used when DASH0_AUTH_TOKEN is unset. Allows traceToolCall
 * to remain in the hot path without runtime cost beyond a Date.now() pair.
 */
function createNoopTracer(): OtelTracer {
  const noopSpan: OtelSpan = {
    setAttribute: () => {},
    setStatus: () => {},
    recordException: () => {},
    end: () => {},
  };
  return {
    startSpan: () => noopSpan,
  };
}
