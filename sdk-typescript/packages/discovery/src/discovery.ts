/**
 * WAVE Discovery — TypeScript SDK surface (WDS.10)
 *
 * Public API: `waveAv.discovery.list(options)`. Calls
 * GET /v1/discovery with the caller's API key + org context.
 *
 * Per ADR-0165. Plan: .claude/plans/wave-discovery-service/overview.md
 */

export type WaveDiscoveryProtocol =
  | 'ndi-mdns'
  | 'ndi-discovery-server'
  | 'nmos-is04'
  | 'nmos-is05'
  | 'dante'
  | 'sap-sdp'
  | 'sdvoe'
  | 'avb-tsn'
  | 'omt-mdns'
  | 'airplay'
  | 'mdns-generic'
  | 'wave-tunnel'
  | 'usb'
  | 'fleet'
  | 'livekit'
  | 'zoom'
  | 'desktop-pairing'
  | 'network-scan';

export interface WaveDiscoveryListOptions {
  organizationId: string;
  protocols?: WaveDiscoveryProtocol[];
  segmentId?: string;
  fresh?: boolean;
  includeUnhealthy?: boolean;
}

export interface WaveDiscoveredDevice {
  display_name: string;
  device_class: string;
  hostname?: string;
  capabilities?: Record<string, boolean | number | string>;
  fingerprint: string;
  canonical_protocol: WaveDiscoveryProtocol;
  provenance: Array<{
    protocol: WaveDiscoveryProtocol;
    adapter_id: string;
    first_seen_at: string;
    last_seen_at: string;
  }>;
  subnet_id?: string;
}

export interface WaveDiscoveryListResult {
  devices: WaveDiscoveredDevice[];
  adapter_health: Record<string, 'healthy' | 'degraded' | 'unhealthy' | 'unknown'>;
  duration_ms: number;
  cache_hit: boolean;
  queried_at: string;
}

export class WaveDiscoveryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async list(options: WaveDiscoveryListOptions): Promise<WaveDiscoveryListResult> {
    const params = new URLSearchParams({ organization_id: options.organizationId });
    if (options.protocols?.length) params.set('protocols', options.protocols.join(','));
    if (options.segmentId) params.set('segment_id', options.segmentId);
    if (options.fresh) params.set('fresh', 'true');
    if (options.includeUnhealthy) params.set('include_unhealthy', 'true');

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/discovery?${params}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WAVE Discovery ${response.status}: ${body}`);
    }

    return (await response.json()) as WaveDiscoveryListResult;
  }
}
