/**
 * Entire resume tokens (entire-integration E7-P5, rank 5).
 *
 * A workflow execution can carry the Entire checkpoint that produced its
 * context, so a retry/resume deep-links back to `entire checkpoint explain`
 * and the originating agent session. The token rides in `input_params` under
 * {@link ENTIRE_RESUME_TOKEN_PARAM}; it deliberately does NOT overload
 * `ExecuteWorkflowRequest.checkpoint_id`, which is the workflow server's own
 * UUID checkpoint namespace (`from_checkpoint` retries stay server-side).
 *
 * Id shapes are the live-observed ones: checkpoint ids are 12-char lowercase
 * hex (`entire checkpoint list/explain --json`, e.g. `a829e9d5cff9`) — Entire
 * trail/change ULIDs are a different namespace and are rejected here. Session
 * ids arrive as harness UUIDs or ULIDs.
 */

import type { ExecuteWorkflowRequest, WorkflowExecution } from './types';

/** input_params key under which the resume token rides. */
export const ENTIRE_RESUME_TOKEN_PARAM = 'entire_resume_token';

export const ENTIRE_CHECKPOINT_ID_RE = /^[0-9a-f]{12}$/;
export const ENTIRE_SESSION_ID_RE =
  /^([0-9A-HJKMNP-TV-Z]{26}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function isEntireCheckpointId(v: unknown): v is string {
  return typeof v === 'string' && ENTIRE_CHECKPOINT_ID_RE.test(v);
}

export function isEntireSessionId(v: unknown): v is string {
  return typeof v === 'string' && ENTIRE_SESSION_ID_RE.test(v);
}

export interface EntireResumeTokenParts {
  checkpointId: string;
  sessionId?: string;
}

/**
 * Format a resume token: `entire:<checkpointId>` or
 * `entire:<checkpointId>:<sessionId>`. Fails fast — a malformed id here is a
 * caller bug, and stamping it would poison every retry of the execution.
 */
export function formatEntireResumeToken(parts: EntireResumeTokenParts): string {
  if (!isEntireCheckpointId(parts.checkpointId)) {
    throw new Error(
      `invalid Entire checkpoint id ${JSON.stringify(parts.checkpointId)} (expected 12-char lowercase hex)`
    );
  }
  if (parts.sessionId !== undefined && !isEntireSessionId(parts.sessionId)) {
    throw new Error(
      `invalid Entire session id ${JSON.stringify(parts.sessionId)} (expected a ULID or UUID)`
    );
  }
  return parts.sessionId
    ? `entire:${parts.checkpointId}:${parts.sessionId}`
    : `entire:${parts.checkpointId}`;
}

/** Parse a stored token. Untrusted input: returns null, never throws. */
export function parseEntireResumeToken(token: unknown): EntireResumeTokenParts | null {
  if (typeof token !== 'string') return null;
  const seg = token.split(':');
  if (seg[0] !== 'entire' || seg.length < 2 || seg.length > 3) return null;
  const checkpointId = seg[1];
  if (!isEntireCheckpointId(checkpointId)) return null;
  if (seg.length === 3) {
    if (!isEntireSessionId(seg[2])) return null;
    return { checkpointId, sessionId: seg[2] };
  }
  return { checkpointId };
}

/**
 * Return a NEW execute request carrying the Entire resume token in
 * `input_params`. Accepts parts or a preformatted token (validated either
 * way). `checkpoint_id` (the server UUID namespace) is left untouched, and
 * the original request is not mutated.
 */
export function withEntireResumeToken<T extends ExecuteWorkflowRequest>(
  request: T,
  token: EntireResumeTokenParts | string
): T {
  const formatted =
    typeof token === 'string'
      ? (() => {
          const parts = parseEntireResumeToken(token);
          if (!parts) throw new Error(`invalid Entire resume token ${JSON.stringify(token)}`);
          return formatEntireResumeToken(parts);
        })()
      : formatEntireResumeToken(token);
  return {
    ...request,
    input_params: { ...request.input_params, [ENTIRE_RESUME_TOKEN_PARAM]: formatted },
  };
}

/** The Entire link a stored execution was stamped with, or null. */
export function entireResumeTokenOf(
  execution: Pick<WorkflowExecution, 'input_params'> | null | undefined
): EntireResumeTokenParts | null {
  if (!execution || typeof execution !== 'object') return null;
  return parseEntireResumeToken(execution.input_params?.[ENTIRE_RESUME_TOKEN_PARAM]);
}
