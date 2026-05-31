/**
 * WAVE Discovery MCP tool (WDS.10).
 *
 * Exposes `wave_discovery_list` so MCP-aware agents (Claude Code,
 * Cursor, Cline, etc.) can probe multi-protocol device discovery from
 * any host without leaving their editor.
 *
 * Per ADR-0165. Plan: .claude/plans/wave-discovery-service/overview.md
 */

import { z } from 'zod';

export const WAVE_DISCOVERY_PROTOCOLS = [
  'ndi-mdns',
  'ndi-discovery-server',
  'nmos-is04',
  'nmos-is05',
  'dante',
  'sap-sdp',
  'sdvoe',
  'avb-tsn',
  'omt-mdns',
  'airplay',
  'mdns-generic',
  'wave-tunnel',
  'usb',
  'fleet',
  'livekit',
  'zoom',
  'desktop-pairing',
  'network-scan',
] as const;

export const WaveDiscoveryListInputSchema = z.object({
  organization_id: z.string().uuid().describe('WAVE organization UUID. Caller must be a member.'),
  protocols: z
    .array(z.enum(WAVE_DISCOVERY_PROTOCOLS))
    .optional()
    .describe('Filter to specific protocols. Omit for all.'),
  segment_id: z.string().uuid().optional().describe('Filter to one ncp_network_segment.'),
  fresh: z
    .boolean()
    .optional()
    .default(false)
    .describe('Bypass Redis cache and run live discovery.'),
  include_unhealthy: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include circuit-broken adapter results with warnings.'),
});

export type WaveDiscoveryListInput = z.infer<typeof WaveDiscoveryListInputSchema>;

export interface WaveDiscoveryMcpConfig {
  apiUrl: string;
  apiKey: string;
}

export interface WaveDiscoveryMcpResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Tool definition for `wave_discovery_list`.
 *
 * Caller MCP host wires this into its tool registry. Returns
 * MCP-shaped result with formatted text + raw JSON in the
 * content array.
 */
export const waveDiscoveryListTool = {
  name: 'wave_discovery_list',
  title: 'WAVE Discovery — list devices',
  description:
    'Probe multi-protocol device discovery across the caller WAVE organization. ' +
    'Returns unified device list with per-protocol provenance, dedup-by-fingerprint, ' +
    'adapter health per protocol. Solves NDI VLAN/IGMP failure via WAVE Tunnel agents. ' +
    'See ADR-0165.',
  inputSchema: WaveDiscoveryListInputSchema,

  async execute(
    input: WaveDiscoveryListInput,
    config: WaveDiscoveryMcpConfig
  ): Promise<WaveDiscoveryMcpResult> {
    const params = new URLSearchParams({ organization_id: input.organization_id });
    if (input.protocols?.length) params.set('protocols', input.protocols.join(','));
    if (input.segment_id) params.set('segment_id', input.segment_id);
    if (input.fresh) params.set('fresh', 'true');
    if (input.include_unhealthy) params.set('include_unhealthy', 'true');

    const url = `${config.apiUrl.replace(/\/$/, '')}/v1/discovery?${params}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          accept: 'application/json',
        },
      });

      const text = await response.text();
      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `WAVE Discovery error ${response.status}:\n${text}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `WAVE Discovery request failed: ${msg}` }],
        isError: true,
      };
    }
  },
};
