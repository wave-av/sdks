"""MVP Stream Consume — Python SDK example.

Demonstrates the WAVE Agent Video Layer happy path:
    1. Agent discovers a resource via /api/v1/agentic-media/discover
    2. Server replies 402 Payment Required with negotiation envelope
    3. Agent obtains a vt_stream_ vault token from /api/v1/acp/delegate_payment
    4. Agent retries with Accept-Payment header → server issues delivery URL
    5. Agent consumes the stream; receipt is persisted (EU AI Act Art. 26)

Requires: pip install requests

Run:
    python3 packages/sdk-python/examples/agent_commerce/mvp_stream_consume.py

@see docs/specs/mvp-machine-video-protocol-v1.md
@see docs/decisions/adr/0135-wave-as-ai-video-layer.md
"""

import os
import sys
import requests

WAVE_API = os.environ.get('WAVE_API_BASE', 'https://wave.online')
AGENT_API_KEY = os.environ.get('WAVE_AGENT_API_KEY', '')


def _build_url(path: str) -> str:
    """Build URL — restrict to https/http to prevent file:// scheme abuse."""
    url = f'{WAVE_API}{path}'
    if not url.startswith(('https://', 'http://')):
        raise ValueError(f'unsafe URL scheme: {url[:32]}...')
    return url


def discover() -> dict:
    """Step 1: discover resources, negotiate codec/protocol."""
    resp = requests.get(
        _build_url('/api/v1/agentic-media/discover?kind=stream&limit=10'),
        headers={
            'Accept-Codec': 'video/h264, video/h265;q=0.8, video/av1;q=0.5',
            'Accept-Protocol': 'webrtc, hls;q=0.7',
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()['data']


def delegate_payment(amount_cents: int) -> str:
    """Step 2-3: obtain a vt_stream_ vault token."""
    resp = requests.post(
        _build_url('/api/v1/acp/delegate_payment'),
        json={
            'handler': 'wave-stream',
            'allowance': {'currency': 'usd', 'amount_cents': amount_cents},
            'expires_in_seconds': 3600,
        },
        headers={'Authorization': f'Bearer {AGENT_API_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()['data']['vault_token']


def request_delivery(vault_token: str, resource_id: str) -> dict:
    """Step 4: redeem vault token for time-limited delivery URL."""
    resp = requests.post(
        _build_url('/api/v1/agentic-media/delivery'),
        json={'resource_id': resource_id, 'protocol': 'hls'},
        headers={'Accept-Payment': vault_token},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()['data']


def main() -> int:
    try:
        print('1. Discovering streams...')
        discovery = discover()
        print(f'   Found {len(discovery["results"])} resources via '
              f'{discovery["negotiation"]["protocol"]}/{discovery["negotiation"]["codec"]}')

        if not discovery['results']:
            print('   No resources available — exiting.')
            return 0

        target = discovery['results'][0]
        print(f'2. Delegating payment for {target["resource_id"]} '
              f'(${target["price_cents"] / 100})...')
        vault_token = delegate_payment(target['price_cents'] * 2)
        print(f'   Got vault token: {vault_token[:24]}...')

        print('3. Requesting delivery URL...')
        delivery = request_delivery(vault_token, target['resource_id'])
        print(f'   {delivery["protocol"].upper()} URL: {delivery["delivery_url"]}')
        print(f'   Receipt: {delivery["receipt_id"]}')
        print(f'   Valid until: {delivery["expires_at"]}')

        print('4. Stream is ready to consume — pipe delivery_url through your '
              'player or transcoder.')
        return 0
    except requests.HTTPError as e:
        body = e.response.text if e.response is not None else str(e)
        print(f'MVP demo failed: HTTP {e.response.status_code if e.response else "?"} — {body}',
              file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f'MVP demo failed: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
