import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VERSION,
  WORKFLOW_ROUTES,
  WaveWorkflowClient,
  WorkflowApiError,
  WorkflowBuilder,
  WorkflowClientError,
  ExecuteWorkflowRequestSchema,
  WorkflowDefinitionSchema,
  type WorkflowWebSocket,
} from '../index';

const KEY = 'wave_test_key_that_must_never_leak_0123456789';
const RID = 'f2fc5fdc-63c2-401f-b137-16d5c1d79a50';

interface Call {
  url: string;
  init: RequestInit;
}

function mockFetch(respond: (url: string, init: RequestInit) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    })
  );
  return calls;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const notMapped = () =>
  json(404, {
    error: {
      code: 'ROUTE_NOT_MAPPED',
      message: 'The gateway has no scope rule for this route, so it is denied by default (fail-closed).',
      doc_url: 'https://gateway.wave.online/.well-known/wave-skills.json',
      request_id: RID,
    },
  });

function client(extra: Partial<ConstructorParameters<typeof WaveWorkflowClient>[0]> = {}) {
  return new WaveWorkflowClient({ apiKey: KEY, organizationId: 'org_123', ...extra });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('constructor', () => {
  it.each([undefined, '', '   '])('rejects an empty apiKey (%j) instead of sending "Bearer undefined"', (apiKey) => {
    const fetchSpy = mockFetch(() => json(200, {}));
    expect(() => new WaveWorkflowClient({ apiKey: apiKey as string, organizationId: 'org' })).toThrow(
      expect.objectContaining({ name: 'WorkflowClientError', code: 'WAVE_ERR_MISSING_API_KEY' })
    );
    expect(fetchSpy).toHaveLength(0);
  });

  it('refuses a plain-http baseUrl for a remote host, so the bearer key never travels unencrypted', () => {
    expect(() => client({ baseUrl: 'http://api.wave.online' })).toThrow(WorkflowClientError);
    expect(() => client({ baseUrl: 'https://user:pw@api.wave.online' })).toThrow(WorkflowClientError);
    expect(() => client({ baseUrl: 'http://localhost:8787' })).not.toThrow();
  });

  it('normalises a trailing slash on baseUrl', async () => {
    const calls = mockFetch(() => json(200, { workflows: [], total: 0 }));
    await client({ baseUrl: 'https://api.wave.online/' }).listWorkflows();
    expect(calls[0]?.url).toBe('https://api.wave.online/v1/workflows');
  });
});

describe('requests', () => {
  it('authenticates with the Authorization header only, and sends no bare "?"', async () => {
    const calls = mockFetch(() => json(200, { workflows: [], total: 0 }));
    await client().listWorkflows();
    const call = calls[0]!;
    expect(call.url).toBe('https://api.wave.online/v1/workflows');
    expect(call.url).not.toContain(KEY);
    expect((call.init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${KEY}`);
    expect((call.init.headers as Record<string, string>)['X-Organization-Id']).toBe('org_123');
    expect(call.init.method).toBe('GET');
    expect(call.init.body).toBeUndefined();
  });

  it('encodes query values', async () => {
    const calls = mockFetch(() => json(200, { executions: [], total: 0, has_more: false }));
    await client().listExecutions({ workflow_id: 'a&b=c', limit: 5 });
    expect(calls[0]?.url).toBe('https://api.wave.online/v1/executions?workflow_id=a%26b%3Dc&limit=5');
  });

  it('URL-encodes path parameters so an id cannot walk to another route', async () => {
    const calls = mockFetch(() => json(200, { id: 'x' }));
    await client().getWorkflow('a/../../billing?x=1');
    expect(calls[0]?.url).toBe('https://api.wave.online/v1/workflows/a%2F..%2F..%2Fbilling%3Fx%3D1');
  });

  it.each(['', '.', '..'])('rejects the path parameter %j before any network I/O', async (id) => {
    const calls = mockFetch(() => json(200, {}));
    await expect(client().getExecution(id)).rejects.toMatchObject({
      name: 'WorkflowClientError',
      code: 'WAVE_ERR_INVALID_ARGUMENT',
    });
    expect(calls).toHaveLength(0);
  });

  it('sends a JSON body on POST routes', async () => {
    const calls = mockFetch(() => json(200, { execution: { id: 'exe_1', status: 'pending' } }));
    const execution = await client().execute('my-flow', { input_params: { a: 1 } });
    expect(execution.id).toBe('exe_1');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.url).toBe('https://api.wave.online/v1/workflows/my-flow/execute');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ input_params: { a: 1 } });
  });

  it('turns a timeout into WAVE_ERR_TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            );
          })
      )
    );
    await expect(client({ timeout: 5 }).getExecution('exe_1')).rejects.toMatchObject({
      code: 'WAVE_ERR_TIMEOUT',
    });
  });
});

describe('gateway errors', () => {
  it('rejects with a typed WorkflowApiError carrying status, gateway code and request id', async () => {
    mockFetch(notMapped);
    const error = await client().listWorkflows({ limit: 5 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkflowApiError);
    const apiError = error as WorkflowApiError;
    expect(apiError.status).toBe(404);
    expect(apiError.code).toBe('ROUTE_NOT_MAPPED');
    expect(apiError.requestId).toBe(RID);
    expect(apiError.route).toBe('GET /v1/workflows');
    expect(apiError.docUrl).toContain('wave-skills.json');
    // 1.0.x callers matched on this prefix; keep it.
    expect(apiError.message.startsWith('API error (404) ROUTE_NOT_MAPPED')).toBe(true);
    expect(apiError.message).toContain(RID);
  });

  it('falls back to the x-request-id header when the body is not JSON', async () => {
    mockFetch(() => new Response('upstream exploded', { status: 502, headers: { 'x-request-id': 'rid-hdr' } }));
    await expect(client().getWorkflow('flow')).rejects.toMatchObject({
      status: 502,
      code: undefined,
      requestId: 'rid-hdr',
      body: 'upstream exploded',
    });
  });

  it('never puts the API key in an error', async () => {
    mockFetch(() => json(401, { error: { code: 'AUTH_INVALID_KEY', message: 'bad key', request_id: RID } }));
    const error = (await client().getLogs('exe_1', { level: 'error' }).catch((e: unknown) => e)) as WorkflowApiError;
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(KEY);
  });

  it('every client method calls its WORKFLOW_ROUTES entry and surfaces the gateway refusal', async () => {
    const calls = mockFetch(notMapped);
    const c = client();
    const invocations: Array<[keyof typeof WORKFLOW_ROUTES, () => Promise<unknown>]> = [
      ['getWorkflow', () => c.getWorkflow('flow')],
      ['listWorkflows', () => c.listWorkflows()],
      ['execute', () => c.execute('flow')],
      ['getExecution', () => c.getExecution('exe_1')],
      ['listExecutions', () => c.listExecutions()],
      ['cancelExecution', () => c.cancelExecution('exe_1')],
      ['pauseExecution', () => c.pauseExecution('exe_1')],
      ['resumeExecution', () => c.resumeExecution('exe_1')],
      ['retryExecution', () => c.retryExecution('exe_1', { from_checkpoint: true })],
      ['getLogs', () => c.getLogs('exe_1')],
    ];
    // Every HTTP route in the table is exercised (the 11th is the WebSocket, tested below).
    expect(invocations.map(([name]) => name).sort()).toEqual(
      Object.keys(WORKFLOW_ROUTES).filter((name) => name !== 'subscribeToExecution').sort()
    );
    for (const [name, invoke] of invocations) {
      await expect(invoke(), name).rejects.toMatchObject({ code: 'ROUTE_NOT_MAPPED', status: 404 });
      const call = calls.at(-1)!;
      const route = WORKFLOW_ROUTES[name];
      expect(call.init.method, name).toBe(route.method);
      const expected = route.path.replace('{slug}', 'flow').replace('{executionId}', 'exe_1');
      expect(new URL(call.url).pathname, name).toBe(expected);
    }
  });
});

class FakeSocket implements WorkflowWebSocket {
  static last: FakeSocket | undefined;
  readyState = 1;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;
  constructor(
    readonly url: string,
    readonly init: unknown
  ) {
    FakeSocket.last = this;
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
}

describe('subscribeToExecution', () => {
  it('sends the key in the handshake Authorization header, never in the URL', () => {
    const factory = vi.fn((url: string, init: { headers: Record<string, string> }) => new FakeSocket(url, init));
    const c = client({ webSocketFactory: factory });
    const unsubscribe = c.subscribeToExecution('exe/1');

    const [url, init] = factory.mock.calls[0]!;
    expect(url).toBe('wss://api.wave.online/v1/executions/exe%2F1/events');
    expect(url).not.toContain(KEY);
    expect(url).not.toContain('token');
    expect(init.headers['Authorization']).toBe(`Bearer ${KEY}`);

    unsubscribe();
    expect(FakeSocket.last?.closed).toBe(true);
  });

  it('uses the global WebSocket with headers on Node.js by default', () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    client().subscribeToExecution('exe_1');
    const socket = FakeSocket.last!;
    expect(socket.url).toBe('wss://api.wave.online/v1/executions/exe_1/events');
    expect(socket.init).toEqual({ headers: expect.objectContaining({ Authorization: `Bearer ${KEY}` }) });
  });

  it('emits typed events and reports bad frames as errors', () => {
    const c = client({ webSocketFactory: (url, init) => new FakeSocket(url, init) });
    const completed = vi.fn();
    const errors = vi.fn();
    c.on('execution.completed', completed);
    c.on('error', errors);
    c.subscribeToExecution('exe_1');

    const socket = FakeSocket.last!;
    socket.onmessage?.({ data: JSON.stringify({ type: 'execution.completed', data: { duration_ms: 5 } }) });
    socket.onmessage?.({ data: 'not json' });
    socket.onerror?.(new Event('error'));

    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ type: 'execution.completed' }));
    expect(errors).toHaveBeenCalledTimes(2);
    expect(String(errors.mock.calls[1]?.[0]?.message)).toContain('/v1/executions/{executionId}/events');
  });

  it('refuses to connect when the runtime cannot send headers, rather than leaking the key', () => {
    vi.stubGlobal('WebSocket', undefined);
    const c = client();
    expect(() => c.subscribeToExecution('exe_1')).toThrow(
      expect.objectContaining({ code: 'WAVE_ERR_WEBSOCKET_UNSUPPORTED' })
    );
  });
});

describe('schemas and builder (zod 4 dependency)', () => {
  it('builds and validates the README workflow', () => {
    const workflow = new WorkflowBuilder('data-pipeline')
      .name('Data Processing Pipeline')
      .category('data-processing')
      .version('1.0.0')
      .phase('extract', (phase) => phase.agent('data-extractor', { source: 'api' }))
      .build();
    expect(workflow.slug).toBe('data-pipeline');
    expect(WorkflowDefinitionSchema.safeParse(workflow).success).toBe(true);
  });

  it('validates record-typed fields', () => {
    expect(ExecuteWorkflowRequestSchema.safeParse({ input_params: { a: 1 } }).success).toBe(true);
    expect(ExecuteWorkflowRequestSchema.safeParse({ input_params: 'nope' }).success).toBe(false);
  });
});

describe('package metadata', () => {
  it('VERSION matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      version: string;
      peerDependencies?: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(VERSION).toBe(pkg.version);
    // zod is a dependency, not a peer: installing next to zod 3 or zod 4 never fails with ERESOLVE.
    expect(pkg.peerDependencies?.['zod']).toBeUndefined();
    expect(pkg.dependencies['zod']).toBeDefined();
  });
});
