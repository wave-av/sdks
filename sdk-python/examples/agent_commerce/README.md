# WAVE Agent Commerce — Python SDK Examples

Pay-per-call AI services on the WAVE platform via ACP + mppx on Tempo.
Python equivalents of the TypeScript examples in
`packages/sdk-typescript/examples/agent-commerce/`.

## Examples

| File | Demonstrates |
|---|---|
| `01_pay_per_call.py` | One-shot vault token + paid endpoint (transcribe) |

## Prerequisites

```bash
pip install httpx
export WAVE_API_BASE=https://staging.wave.online
export AGENT_WALLET_ADDRESS=0x...
```

## Running

```bash
python 01_pay_per_call.py
```

## Pricing reference

Same pricing as TypeScript SDK — see
`packages/sdk-typescript/examples/agent-commerce/README.md`.

## Vault token failure modes

| HTTP | Code | Recovery |
|---|---|---|
| 402 | `NO_VAULT_TOKEN` | Call `/delegate_payment` to issue token |
| 402 | `TOKEN_EXPIRED` | Re-authorize |
| 402 | `TOKEN_REVOKED` | Re-authorize |
| 402 | `SIGNATURE_INVALID` | Token tampered — re-authorize |
| 402 | `SPEND_CAP_EXCEEDED` | Wait for period rollover or re-authorize with higher cap |
| 402 | `ANOMALY_HOLD` | Resolve anomaly via `/admin/argus`, retry after `Retry-After` seconds |
| 402 | `GEO_RESTRICTED` | Service unavailable in caller region |

## Related

- Full architecture: `/docs/agent-commerce`
- Argus observability: `/docs/argus`
- ACP spec: https://www.agenticcommerce.dev/docs/reference/payments
