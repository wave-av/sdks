"""WAVE Agent Commerce — Pay-Per-Call Example (Python).

Mirrors packages/sdk-typescript/examples/agent-commerce/01-pay-per-call.ts.
Demonstrates one-shot vault token + paid endpoint flow:
    1. POST /api/v1/acp/delegate_payment with handler + allowance
    2. WAVE returns vt_<base64url-payload>.<hmac-sig>
    3. Agent attaches Accept-Payment header on subsequent paid calls
    4. WAVE validates HMAC + expiry + revocation, settles via mppx

Usage:
    export WAVE_API_BASE=https://staging.wave.online
    export AGENT_WALLET_ADDRESS=0x...
    python 01_pay_per_call.py

Requires:
    pip install httpx
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, TypedDict

import httpx


WAVE_API_BASE = os.environ.get("WAVE_API_BASE", "https://staging.wave.online")
AGENT_WALLET = os.environ.get(
    "AGENT_WALLET_ADDRESS",
    "0x16c462902fF4D940Ec4F5adc53045A42ab0F7Ab7",
)


class DelegatePaymentResponse(TypedDict):
    vault_token: str
    expires_at: str
    handler: Dict[str, Any]
    allowance: Dict[str, Any]


def obtain_vault_token() -> DelegatePaymentResponse:
    """Authorize a spending allowance + obtain vault token."""
    request = {
        "handler": {
            "type": "crypto",
            "chain": "tempo",
            "asset": "pathusd",
            "wallet_type": "smart_wallet",
            "session_mode": "pull",
            "recipient": AGENT_WALLET,
            "rate_limit": {"max_per_second": 10},
        },
        "allowance": {"max_amount": "5.00", "period_seconds": 3600},
        "expires_in_seconds": 1800,
        "agent_metadata": {
            "agent_id": "transcription-bot-py-v1",
            "agent_name": "Transcription Bot (Python)",
            "operator_org": "agentcorp",
        },
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{WAVE_API_BASE}/api/v1/acp/delegate_payment",
            json=request,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]


def transcribe_with_vault_token(audio_url: str, vault_token: str) -> Dict[str, Any]:
    """Use the vault token on a paid endpoint."""
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{WAVE_API_BASE}/api/v1/mpp/transcribe",
            json={"audio_url": audio_url},
            headers={
                "Content-Type": "application/json",
                "Accept-Payment": vault_token,
            },
        )

        if response.status_code == 402:
            problem = response.json()
            raise RuntimeError(
                f"Payment required: {problem.get('detail')} "
                f"(code: {problem.get('code')})"
            )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]


def main() -> None:
    print("1. Obtaining vault token from /api/v1/acp/delegate_payment...")
    auth = obtain_vault_token()
    print(f"   ✓ Token issued, expires at {auth['expires_at']}")
    print(
        f"   ✓ Spending allowance: ${auth['allowance']['max_amount']} per "
        f"{auth['allowance']['period_seconds']}s"
    )

    print("2. Transcribing audio with vault token...")
    result = transcribe_with_vault_token(
        "https://example.com/podcast-episode-1.mp3",
        auth["vault_token"],
    )
    print(f"   ✓ Transcription complete: {result}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f"Failed: {err}", file=sys.stderr)
        sys.exit(1)
