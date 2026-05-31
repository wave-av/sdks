# WAVE error codes

Every WAVE API error includes a code, message, and fix suggestion.

## Error code reference

| Code | HTTP | Retry? | Message | Fix |
|------|------|--------|---------|-----|
| `WAVE_ERR_BAD_REQUEST` | 400 | No | Invalid request parameters | Check tool parameters match the expected schema |
| `WAVE_ERR_UNAUTHORIZED` | 401 | No | API key is invalid or expired | Check your `WAVE_AGENT_KEY` env var. Get a new key at [wave.online/developers/keys](https://wave.online/developers/keys) |
| `WAVE_ERR_FORBIDDEN` | 403 | No | Insufficient permissions | Upgrade your plan or request access at wave.online/settings |
| `WAVE_ERR_NOT_FOUND` | 404 | No | Resource does not exist | Verify the stream/camera/production ID is correct |
| `WAVE_ERR_CONFLICT` | 409 | No | Resource already in requested state | Check current status before acting (e.g., stream may already be active) |
| `WAVE_ERR_RATE_LIMITED` | 429 | Yes (Retry-After) | Too many requests | Wait for `Retry-After` header period. Upgrade to Pro for higher limits |
| `WAVE_ERR_SERVER` | 500 | Yes (backoff) | Server error | Retry after 1-5s with exponential backoff. Check [status.wave.online](https://status.wave.online) |
| `WAVE_ERR_UNAVAILABLE` | 503 | Yes (backoff) | Service temporarily unavailable | Retry with backoff. Check [status.wave.online](https://status.wave.online) |
| `WAVE_ERR_UNKNOWN_TOOL` | N/A | No | Unknown tool name | Check spelling. The error includes "did you mean" suggestions |
| `WAVE_ERR_VALIDATION` | N/A | No | Zod validation failed | Check parameter types and required fields |

## Handling errors

```typescript
import { WaveToolError } from '@wave-av/adk';

try {
  const stream = await toolkit.findTool('wave_create_stream').handler({ title: 'My stream' });
} catch (error) {
  if (error instanceof WaveToolError) {
    console.log(error.code);     // "WAVE_ERR_UNAUTHORIZED"
    console.log(error.message);  // "API key is invalid or expired. Check your WAVE_AGENT_KEY..."
    console.log(error.context);  // { status: 401, operation: "POST /v1/streams" }

    if (error.code === 'WAVE_ERR_RATE_LIMITED') {
      // Retry after the suggested period
      const retryAfter = (error.context.retryAfter as number) ?? 2;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
    }
  }
}
```

## Retry strategy

| Error type | Strategy | Max retries |
|-----------|----------|-------------|
| 429 Rate limited | Wait for `Retry-After` header value | 3 |
| 500 Server error | Exponential backoff: 1s, 2s, 4s | 3 |
| 503 Unavailable | Exponential backoff: 1s, 2s, 4s | 3 |
| Network error | Exponential backoff: 1s, 2s, 4s | 3 |
| 400/401/403/404 | Do not retry | 0 |

The ADK `WaveAgent.apiCall()` handles retries automatically. You only need manual retry logic if using `AgentToolkit` directly.
