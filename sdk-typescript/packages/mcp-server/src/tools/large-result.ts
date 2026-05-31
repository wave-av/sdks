/**
 * Large Result Helper — CC 2.1.91 maxResultSizeChars Support
 *
 * MCP tools that return large results (DB schemas, graph queries, analytics dumps)
 * can use this helper to annotate their responses with _meta["anthropic/maxResultSizeChars"]
 * which tells Claude Code to accept results up to 500K chars without truncation.
 *
 * Usage:
 *   import { largeTextContent } from './large-result.js';
 *   return largeTextContent(bigSchemaString);           // 500K limit
 *   return largeTextContent(data, 200_000);             // Custom limit
 *
 * Standard results should continue using textContent() — only use this for
 * genuinely large responses (schema dumps, full graph queries, audit reports).
 */

import { detectSaturation, captureSaturationEvent, SSE_CAP_BYTES, type SaturationMetrics } from './saturation-detector.js';

const DEFAULT_MAX_CHARS = 500_000;

interface TextContentBlock {
  type: 'text';
  text: string;
}

interface McpToolResult {
  content: TextContentBlock[];
  _meta?: Record<string, unknown>;
}

/**
 * Returns MCP tool result with maxResultSizeChars annotation.
 * Use for large results that would otherwise be truncated by CC's default limit.
 */
export function largeTextContent(
  text: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): McpToolResult {
  return {
    content: [{ type: 'text' as const, text }],
    _meta: {
      'anthropic/maxResultSizeChars': Math.min(maxChars, DEFAULT_MAX_CHARS),
    },
  };
}

/**
 * Returns MCP tool result with maxResultSizeChars only if the text exceeds
 * the threshold. Below the threshold, returns standard content (no _meta overhead).
 */
export function autoSizingTextContent(
  text: string,
  threshold: number = 50_000,
): McpToolResult {
  if (text.length > threshold) {
    return largeTextContent(text);
  }
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * Safely truncate an MCP response body to stay under the 16 MB SSE frame cap.
 * Per CC 2.1.139 saturation-detection spec (P11.6.x). Returns McpToolResult
 * with maxResultSizeChars annotation; emits Sentry warn/error via
 * captureSaturationEvent when willWarn/willTruncate cross threshold.
 *
 * Context is optional; when omitted, no Sentry side effect occurs.
 */
export function safeTruncateForSseCap(
  body: string,
  context?: { tool: string; server: string },
): McpToolResult {
  const ctx = context ?? { tool: 'unknown', server: 'unknown' };
  const metrics = detectSaturation(ctx.tool, ctx.server, body);
  if (!metrics.willTruncate) {
    // Resolves CR r3249315058: emit warn-level Sentry when within 15-16MB
    // saturation band even though no truncation applied yet.
    if (metrics.willWarn && context) {
      captureSaturationEvent(metrics);
    }
    // Resolves CR r3249315109: don't clamp to 500K maxResultSizeChars when
    // body is under SSE cap — that artificially restricts client display.
    return {
      content: [{ type: 'text' as const, text: body }],
      ...(metrics.willWarn && {
        _meta: {
          'mcp.original_bytes': metrics.bodyBytes,
          'mcp.saturation_pct': metrics.saturationPct,
        },
      }),
    };
  }
  const truncatedSuffix = '\n\n[TRUNCATED at 16 MB SSE cap — CC 2.1.139 frame limit]';
  // Byte-accurate truncation via TextEncoder (binary-search character boundary).
  // Previous implementation used `body.slice(0, targetBytes)` which treats
  // bytes as characters — UTF-8 multibyte content (emoji/CJK) could exceed
  // SSE_CAP_BYTES by 2-4x. Resolves CodeRabbit r3245270382 boundary bug.
  const encoder = new TextEncoder();
  const suffixBytes = encoder.encode(truncatedSuffix).length;
  const budgetBytes = SSE_CAP_BYTES - suffixBytes - 1024; // 1 KB envelope
  let lo = 0;
  let hi = body.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const bytes = encoder.encode(body.slice(0, mid)).length;
    if (bytes <= budgetBytes) lo = mid;
    else hi = mid - 1;
  }
  const truncated = body.slice(0, lo) + truncatedSuffix;
  // Resolves CR r3249315... (PR #4438): maxResultSizeChars must be a CHARACTER
  // count (not bytes). Use truncated.length so client knows the exact size.
  // Also emit saturation event in error tier per metrics.willTruncate=true.
  if (context) {
    captureSaturationEvent(metrics);
  }
  return {
    content: [{ type: 'text' as const, text: truncated }],
    _meta: {
      'anthropic/maxResultSizeChars': truncated.length,
      'mcp.truncated': true,
      'mcp.original_bytes': metrics.bodyBytes,
      'mcp.saturation_pct': metrics.saturationPct,
    },
  };
}

export { detectSaturation, captureSaturationEvent };
export type { SaturationMetrics };
