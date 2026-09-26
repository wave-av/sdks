/**
 * MCP Body-Cap Saturation Detector (P11.6.1 + P11.6.2)
 *
 * CC 2.1.139 enforces a 16 MB SSE frame cap on MCP responses. This module
 * measures how close an MCP tool response is to the cap and flags when it
 * crosses the warning threshold (>= 15 MB / 94%) or the cap itself.
 *
 * Spec: docs/audits/cc-2140-integration/mcp-body-cap-saturation-spec.md
 * Target SLO: < 0.1% of responses saturate (per P14.4.5)
 *
 * Usage:
 *   import { detectSaturation } from './saturation-detector.js';
 *   const metrics = detectSaturation(toolName, serverName, body);
 *   if (metrics.willTruncate) { ... }
 */

export const SSE_CAP_BYTES = 16 * 1024 * 1024; // 16 MB CC 2.1.139 cap
export const WARN_THRESHOLD_BYTES = 15 * 1024 * 1024; // 94% — 1 MB envelope headroom

export interface SaturationMetrics {
  tool: string;
  server: string;
  bodyBytes: number;
  saturationPct: number;
  /** True when body crosses the 15 MB warning threshold. */
  willWarn: boolean;
  /** True when body reaches or exceeds the 16 MB SSE cap and CC will drop the frame.
   * Boundary semantics: `bodyBytes >= SSE_CAP_BYTES` (inclusive at 16 MB exactly).
   * Resolves CodeRabbit r3245270378 boundary doc/code mismatch. */
  willTruncate: boolean;
}

/**
 * Pure-JS UTF-8 byte length (avoids Buffer / TextEncoder dependency).
 * Counts UTF-8 byte width per code point per RFC 3629.
 */
function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes += 1;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      // High surrogate of a surrogate pair = 4-byte UTF-8 sequence
      bytes += 4;
      i++; // skip the low surrogate
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Measure the response body in bytes and compute saturation against the 16 MB cap.
 * Pure function — no side effects.
 */
export function detectSaturation(
  tool: string,
  server: string,
  body: string,
): SaturationMetrics {
  const bodyBytes = utf8ByteLength(body);
  const saturationPct = (bodyBytes / SSE_CAP_BYTES) * 100;
  const willWarn = bodyBytes >= WARN_THRESHOLD_BYTES;
  const willTruncate = bodyBytes >= SSE_CAP_BYTES;
  return { tool, server, bodyBytes, saturationPct, willWarn, willTruncate };
}
