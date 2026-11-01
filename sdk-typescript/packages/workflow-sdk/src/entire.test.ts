import { describe, expect, it } from 'vitest';
import {
  ENTIRE_RESUME_TOKEN_PARAM,
  entireResumeTokenOf,
  formatEntireResumeToken,
  isEntireCheckpointId,
  isEntireSessionId,
  parseEntireResumeToken,
  withEntireResumeToken,
} from './entire';
import type { ExecuteWorkflowRequest, WorkflowExecution } from './types';

// Shapes observed live (entire-integration E7): checkpoint ids are 12-char
// lowercase hex (`entire checkpoint list/explain --json`); trail ids are ULIDs
// and are NOT checkpoint ids; session ids arrive as harness UUIDs or ULIDs.
const CP = 'a829e9d5cff9';
const SESSION_UUID = '143acdd9-cb3d-4b18-9105-5d39d08541e4';
const SESSION_ULID = '01M6CFYTMYZFV11DE5VCMXP422';
const TRAIL_ULID = SESSION_ULID;

describe('Entire resume tokens (E7-P5 rank 5)', () => {
  it('validates id shapes against live-observed forms', () => {
    expect(isEntireCheckpointId(CP)).toBe(true);
    expect(isEntireCheckpointId(TRAIL_ULID)).toBe(false); // trail id, not a checkpoint
    expect(isEntireCheckpointId(CP.toUpperCase())).toBe(false);
    expect(isEntireCheckpointId('a829e9d5cff')).toBe(false);
    expect(isEntireCheckpointId('a829e9d5cff9a')).toBe(false);
    expect(isEntireSessionId(SESSION_UUID)).toBe(true);
    expect(isEntireSessionId(SESSION_ULID)).toBe(true);
    expect(isEntireSessionId('fake-session-3')).toBe(false);
  });

  it('formats and parses tokens round-trip', () => {
    expect(formatEntireResumeToken({ checkpointId: CP })).toBe(`entire:${CP}`);
    expect(formatEntireResumeToken({ checkpointId: CP, sessionId: SESSION_UUID })).toBe(
      `entire:${CP}:${SESSION_UUID}`
    );
    expect(parseEntireResumeToken(`entire:${CP}`)).toEqual({ checkpointId: CP });
    expect(parseEntireResumeToken(`entire:${CP}:${SESSION_UUID}`)).toEqual({
      checkpointId: CP,
      sessionId: SESSION_UUID,
    });
  });

  it('format fails fast on invalid ids; parse returns null and never throws', () => {
    expect(() => formatEntireResumeToken({ checkpointId: TRAIL_ULID })).toThrow(/checkpoint/);
    expect(() => formatEntireResumeToken({ checkpointId: CP, sessionId: 'nope' })).toThrow(/session/);
    for (const bad of ['', 'entire:', 'entire:xyz', `entire:${TRAIL_ULID}`, `entire:${CP}:junk`, CP, 42, null, undefined]) {
      expect(parseEntireResumeToken(bad as never)).toBeNull();
    }
  });

  it('withEntireResumeToken merges input_params without touching checkpoint_id or mutating', () => {
    const serverCheckpoint = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const req: ExecuteWorkflowRequest = {
      input_params: { environment: 'production' },
      checkpoint_id: serverCheckpoint,
    };
    const out = withEntireResumeToken(req, { checkpointId: CP, sessionId: SESSION_UUID });
    expect(out).not.toBe(req);
    expect(out.checkpoint_id).toBe(serverCheckpoint); // server UUID namespace untouched
    expect(out.input_params).toEqual({
      environment: 'production',
      [ENTIRE_RESUME_TOKEN_PARAM]: `entire:${CP}:${SESSION_UUID}`,
    });
    expect(req.input_params).toEqual({ environment: 'production' }); // original untouched
    // A raw token string is accepted too, and validated the same way.
    expect(withEntireResumeToken({}, `entire:${CP}`).input_params?.[ENTIRE_RESUME_TOKEN_PARAM]).toBe(`entire:${CP}`);
    expect(() => withEntireResumeToken({}, 'entire:nope')).toThrow();
  });

  it('entireResumeTokenOf extracts only well-formed tokens from an execution', () => {
    const base = { input_params: { [ENTIRE_RESUME_TOKEN_PARAM]: `entire:${CP}:${SESSION_ULID}` } } as WorkflowExecution;
    expect(entireResumeTokenOf(base)).toEqual({ checkpointId: CP, sessionId: SESSION_ULID });
    expect(entireResumeTokenOf({ input_params: {} } as WorkflowExecution)).toBeNull();
    expect(entireResumeTokenOf({ input_params: { [ENTIRE_RESUME_TOKEN_PARAM]: 42 } } as unknown as WorkflowExecution)).toBeNull();
    expect(entireResumeTokenOf({} as WorkflowExecution)).toBeNull();
    expect(entireResumeTokenOf(null as never)).toBeNull();
  });
});
