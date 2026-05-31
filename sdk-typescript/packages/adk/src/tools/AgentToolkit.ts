/**
 * AgentToolkit — MCP-compatible tool definitions for AI agents
 *
 * Defines the tools that AI agents can use to control WAVE infrastructure.
 * Compatible with Claude MCP, OpenAI function calling, and LangChain tools.
 */

import { z } from 'zod';

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, { type: string; description: string; required?: boolean }>;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export class AgentToolkit {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.wave.online';
  }

  private validated(schema: z.ZodObject<z.ZodRawShape>, handler: (params: Record<string, unknown>) => Promise<unknown>) {
    return async (params: Record<string, unknown>) => {
      const parsed = schema.parse(params);
      return handler(parsed as Record<string, unknown>);
    };
  }

  getTools(): AgentTool[] {
    const createStreamSchema = z.object({ title: z.string().min(1), protocol: z.enum(['webrtc', 'srt', 'rtmp', 'ndi']).optional() });
    const streamIdSchema = z.object({ streamId: z.string().uuid() });
    const clipSchema = z.object({ streamId: z.string().uuid(), startTime: z.number().min(0), endTime: z.number().min(0) });
    const switchSchema = z.object({ switcherId: z.string(), sourceId: z.string(), transition: z.enum(['cut', 'mix', 'wipe']).optional() });
    const graphicSchema = z.object({ switcherId: z.string(), templateId: z.string(), data: z.record(z.unknown()).optional() });
    const moderateSchema = z.object({ messageId: z.string(), action: z.enum(['approve', 'flag', 'block']) });
    const captionSchema = z.object({ streamId: z.string().uuid(), language: z.string().length(2).optional() });
    const analyticsSchema = z.object({ streamId: z.string().uuid(), timeRange: z.enum(['1h', '24h', '7d']).optional() });
    const highlightSchema = z.object({ streamId: z.string().uuid(), label: z.string().min(1) });
    const cameraSchema = z.object({ cameraId: z.string(), pan: z.number().min(0).max(1).optional(), tilt: z.number().min(0).max(1).optional(), zoom: z.number().min(0).max(1).optional() });

    return [
      {
        name: 'wave_create_stream',
        description: 'Create a new live stream with specified protocol and settings',
        parameters: {
          title: { type: 'string', description: 'Stream title', required: true },
          protocol: { type: 'string', description: 'Protocol: webrtc, srt, rtmp, ndi' },
        },
        schema: createStreamSchema,
        handler: this.validated(createStreamSchema, (params) => this.call('POST', '/v1/streams', params)),
      },
      {
        name: 'wave_monitor_stream',
        description: 'Get real-time quality metrics for a stream',
        parameters: {
          streamId: { type: 'string', description: 'Stream ID', required: true },
        },
        schema: streamIdSchema,
        handler: this.validated(streamIdSchema, (params) => this.call('GET', `/v1/streams/${params.streamId}/health`)),
      },
      {
        name: 'wave_create_clip',
        description: 'Extract a clip from a stream at specified timestamps',
        parameters: {
          streamId: { type: 'string', description: 'Stream ID', required: true },
          startTime: { type: 'number', description: 'Start time in seconds', required: true },
          endTime: { type: 'number', description: 'End time in seconds', required: true },
        },
        schema: clipSchema,
        handler: this.validated(clipSchema, (params) => this.call('POST', '/v1/clips', params)),
      },
      {
        name: 'wave_switch_camera',
        description: 'Switch the live production to a different camera source',
        parameters: {
          switcherId: { type: 'string', description: 'Switcher instance ID', required: true },
          sourceId: { type: 'string', description: 'Source to switch to', required: true },
          transition: { type: 'string', description: 'Transition type: cut, mix, wipe' },
        },
        schema: switchSchema,
        handler: this.validated(switchSchema, (params) => this.call('POST', `/v1/switcher/${params.switcherId}/switch`, params)),
      },
      {
        name: 'wave_show_graphic',
        description: 'Display a graphics overlay on the live production',
        parameters: {
          switcherId: { type: 'string', description: 'Switcher instance ID', required: true },
          templateId: { type: 'string', description: 'Graphics template ID', required: true },
          data: { type: 'object', description: 'Template data bindings' },
        },
        schema: graphicSchema,
        handler: this.validated(graphicSchema, (params) => this.call('POST', '/v1/graphics/show', params)),
      },
      {
        name: 'wave_moderate_chat',
        description: 'Moderate a chat message (approve, flag, or block)',
        parameters: {
          messageId: { type: 'string', description: 'Message ID', required: true },
          action: { type: 'string', description: 'Action: approve, flag, block', required: true },
        },
        schema: moderateSchema,
        handler: this.validated(moderateSchema, (params) => this.call('POST', '/v1/moderation/action', params)),
      },
      {
        name: 'wave_start_captions',
        description: 'Start real-time captioning on a stream',
        parameters: {
          streamId: { type: 'string', description: 'Stream ID', required: true },
          language: { type: 'string', description: 'Language code (e.g., en, es, fr)' },
        },
        schema: captionSchema,
        handler: this.validated(captionSchema, (params) => this.call('POST', '/v1/captions/start', params)),
      },
      {
        name: 'wave_analyze_quality',
        description: 'Get detailed quality analytics for a stream',
        parameters: {
          streamId: { type: 'string', description: 'Stream ID', required: true },
          timeRange: { type: 'string', description: 'Time range: 1h, 24h, 7d' },
        },
        schema: analyticsSchema,
        handler: this.validated(analyticsSchema, (params) => this.call('GET', `/v1/analytics/stream/${params.streamId}/qoe`)),
      },
      {
        name: 'wave_mark_highlight',
        description: 'Mark a point of interest for replay/highlights',
        parameters: {
          streamId: { type: 'string', description: 'Stream ID', required: true },
          label: { type: 'string', description: 'Highlight label', required: true },
        },
        schema: highlightSchema,
        handler: this.validated(highlightSchema, (params) => this.call('POST', '/v1/replay/poi', params)),
      },
      {
        name: 'wave_control_camera',
        description: 'Control a PTZ camera (pan, tilt, zoom, focus)',
        parameters: {
          cameraId: { type: 'string', description: 'Camera ID', required: true },
          pan: { type: 'number', description: 'Pan position (0-1)' },
          tilt: { type: 'number', description: 'Tilt position (0-1)' },
          zoom: { type: 'number', description: 'Zoom level (0-1)' },
        },
        schema: cameraSchema,
        handler: this.validated(cameraSchema, (params) => this.call('POST', `/v1/cameras/${params.cameraId}/control`, params)),
      },
    ];
  }

  /**
   * Find a tool by name with did-you-mean suggestions for typos.
   * Throws a helpful error if the tool doesn't exist.
   *
   * @example
   * ```typescript
   * const tool = toolkit.findTool('wave_create_streem');
   * // Throws: Unknown tool "wave_create_streem". Did you mean "wave_create_stream"?
   * ```
   */
  findTool(name: string): AgentTool {
    const tools = this.getTools();
    const exact = tools.find(t => t.name === name);
    if (exact) return exact;

    // Find closest match using Levenshtein distance
    const suggestions = tools
      .map(t => ({ name: t.name, distance: levenshtein(name, t.name) }))
      .filter(s => s.distance <= 5)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    const available = tools.map(t => t.name).join(', ');

    if (suggestions.length > 0) {
      const didYouMean = suggestions.map(s => `"${s.name}"`).join(', ');
      throw new WaveToolError(
        `Unknown tool "${name}". Did you mean ${didYouMean}?`,
        'WAVE_ERR_UNKNOWN_TOOL',
        { requested: name, suggestions: suggestions.map(s => s.name), available: tools.map(t => t.name) }
      );
    }

    throw new WaveToolError(
      `Unknown tool "${name}". Available tools: ${available}`,
      'WAVE_ERR_UNKNOWN_TOOL',
      { requested: name, available: tools.map(t => t.name) }
    );
  }

  toMCPTools(): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
    return this.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, val]) => [key, { type: val.type, description: val.description }])
        ),
        required: Object.entries(tool.parameters).filter(([_, v]) => v.required).map(([k]) => k),
      },
    }));
  }

  private async call(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw WaveToolError.fromApiResponse(response.status, errorBody, `${method} ${path}`);
    }

    return response.json();
  }
}

/**
 * Structured error with code, message, and context.
 * Every error tells the developer: what happened + how to fix it.
 */
export class WaveToolError extends Error {
  readonly code: string;
  readonly fix: string;
  readonly context: Record<string, unknown>;

  constructor(message: string, code: string, context: Record<string, unknown> = {}, fix = '') {
    super(message);
    this.name = 'WaveToolError';
    this.code = code;
    this.fix = fix;
    this.context = context;
  }

  static fromApiResponse(status: number, body: unknown, operation: string): WaveToolError {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body ?? '');
    const messages: Record<number, { code: string; message: string; fix: string }> = {
      400: { code: 'WAVE_ERR_BAD_REQUEST', message: 'Invalid request parameters.', fix: 'Check the tool parameters match the expected schema.' },
      401: { code: 'WAVE_ERR_UNAUTHORIZED', message: 'API key is invalid or expired.', fix: 'Check your WAVE_AGENT_KEY environment variable. Get a new key at wave.online/developers/keys.' },
      403: { code: 'WAVE_ERR_FORBIDDEN', message: 'Your API key lacks permission for this operation.', fix: 'Upgrade your plan or request access at wave.online/settings.' },
      404: { code: 'WAVE_ERR_NOT_FOUND', message: 'The requested resource does not exist.', fix: 'Verify the stream/camera/production ID is correct.' },
      409: { code: 'WAVE_ERR_CONFLICT', message: 'Resource is already in the requested state.', fix: 'The stream may already be active. Check its current status first.' },
      429: { code: 'WAVE_ERR_RATE_LIMITED', message: 'Too many requests.', fix: 'Wait for the Retry-After period. Consider upgrading to Pro for higher limits.' },
      500: { code: 'WAVE_ERR_SERVER', message: 'WAVE server error.', fix: 'Retry after a moment. If persistent, check status.wave.online.' },
      503: { code: 'WAVE_ERR_UNAVAILABLE', message: 'WAVE service temporarily unavailable.', fix: 'Retry with exponential backoff. Check status.wave.online.' },
    };

    const info = messages[status] ?? {
      code: `WAVE_ERR_HTTP_${status}`,
      message: `API returned HTTP ${status}.`,
      fix: 'Check the WAVE API documentation.',
    };

    return new WaveToolError(
      `${info.message} ${info.fix}`,
      info.code,
      { status, operation, body: bodyStr.slice(0, 500) },
      info.fix
    );
  }
}

/** Levenshtein distance for did-you-mean suggestions */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? a.length;
}
