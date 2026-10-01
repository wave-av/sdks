/**
 * WAVE Workflow SDK errors
 *
 * Two classes, so callers can tell "the gateway answered no" apart from
 * "the client refused to send the request":
 *
 * - `WorkflowApiError`: the WAVE API answered with a non-2xx status. Carries the
 *   HTTP status, the gateway's machine-readable `code` (for example
 *   `ROUTE_NOT_MAPPED`, `AUTH_INVALID_KEY`, `SCOPE_INSUFFICIENT`) and the
 *   `requestId` to quote to WAVE support.
 * - `WorkflowClientError`: the client stopped before any network I/O (missing
 *   API key, a runtime that cannot authenticate a WebSocket safely, a timeout).
 *
 * Neither error ever carries the API key or request headers.
 */

/** Machine-readable codes raised by the client itself (no network I/O happened). */
export type WorkflowClientErrorCode =
  | 'WAVE_ERR_MISSING_API_KEY'
  | 'WAVE_ERR_INVALID_ARGUMENT'
  | 'WAVE_ERR_WEBSOCKET_UNSUPPORTED'
  | 'WAVE_ERR_TIMEOUT';

export class WorkflowClientError extends Error {
  readonly code: WorkflowClientErrorCode;

  constructor(code: WorkflowClientErrorCode, message: string) {
    super(message);
    this.name = 'WorkflowClientError';
    this.code = code;
  }
}

/** Shape of a WAVE gateway error body: `{ "error": { "code", "message", "request_id", ... } }`. */
interface GatewayErrorBody {
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly request_id?: unknown;
    readonly doc_url?: unknown;
  };
}

export class WorkflowApiError extends Error {
  /** HTTP status the gateway answered with. */
  readonly status: number;
  /** Gateway error code, e.g. `ROUTE_NOT_MAPPED`. `undefined` when the body carried none. */
  readonly code: string | undefined;
  /** Request id from the error body or the `x-request-id` header. Quote it to WAVE support. */
  readonly requestId: string | undefined;
  /** Documentation link the gateway attached to the error, if any. */
  readonly docUrl: string | undefined;
  /** Method and path that failed, e.g. `GET /v1/workflows`. Never includes query values or credentials. */
  readonly route: string;
  /** Raw response body text (the gateway never echoes credentials into it). */
  readonly body: string;

  constructor(init: {
    status: number;
    code?: string;
    requestId?: string;
    docUrl?: string;
    route: string;
    body: string;
    detail?: string;
  }) {
    const code = init.code ? ` ${init.code}` : '';
    const detail = init.detail ? `: ${init.detail}` : init.body ? `: ${init.body.slice(0, 500)}` : '';
    const rid = init.requestId ? ` (request_id ${init.requestId})` : '';
    // Keeps the `API error (<status>)` prefix 1.0.x callers match on.
    super(`API error (${init.status})${code} on ${init.route}${detail}${rid}`);
    this.name = 'WorkflowApiError';
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.docUrl = init.docUrl;
    this.route = init.route;
    this.body = init.body;
  }

  /**
   * Build an error from a non-2xx response. `route` must be `METHOD /path`
   * without a query string; the caller passes the template path, not the URL.
   */
  static async fromResponse(response: Response, route: string): Promise<WorkflowApiError> {
    const body = await response.text().catch(() => '');
    let parsed: GatewayErrorBody | undefined;
    try {
      parsed = JSON.parse(body) as GatewayErrorBody;
    } catch {
      parsed = undefined;
    }
    const err = parsed?.error;
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
    return new WorkflowApiError({
      status: response.status,
      code: str(err?.code),
      requestId: str(err?.request_id) ?? response.headers.get('x-request-id') ?? undefined,
      docUrl: str(err?.doc_url),
      detail: str(err?.message),
      route,
      body,
    });
  }
}
