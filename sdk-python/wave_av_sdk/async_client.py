"""
WAVE SDK - Async API Client

Async HTTP client with authentication, rate limiting, and retry logic.
Uses httpx.AsyncClient for non-blocking I/O.

Example:
    >>> from wave.async_client import AsyncWaveClient
    >>> async with AsyncWaveClient(api_key="key") as client:
    ...     streams = await client.get("/v1/streams")
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

from wave.client import WaveError, RateLimitError

logger = logging.getLogger("wave")


class AsyncWaveClient:
    """
    Async WAVE API client.

    Drop-in async replacement for WaveClient. All HTTP methods are coroutines.
    """

    def __init__(
        self,
        api_key: str,
        organization_id: str | None = None,
        base_url: str = "https://api.wave.online",
        timeout: float = 30.0,
        max_retries: int = 3,
        debug: bool = False,
    ):
        if not api_key:
            raise ValueError("WAVE SDK: api_key is required")

        self.api_key = api_key
        self.organization_id = organization_id
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.debug = debug

        if debug:
            logging.basicConfig(level=logging.DEBUG)

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers=self._build_headers(),
        )

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "wave-sdk-python/2.0.0",
        }
        if self.organization_id:
            headers["X-Organization-Id"] = self.organization_id
        return headers

    async def get(self, path: str, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        return await self._request("GET", path, params=params, **kwargs)

    async def post(self, path: str, json: dict[str, Any] | None = None, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        return await self._request("POST", path, json=json, params=params, **kwargs)

    async def put(self, path: str, json: dict[str, Any] | None = None, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        return await self._request("PUT", path, json=json, params=params, **kwargs)

    async def patch(self, path: str, json: dict[str, Any] | None = None, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        return await self._request("PATCH", path, json=json, params=params, **kwargs)

    async def delete(self, path: str, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        return await self._request("DELETE", path, params=params, **kwargs)

    async def _request(
        self,
        method: str,
        path: str,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        no_retry: bool = False,
        **kwargs: Any,
    ) -> Any:
        if params:
            params = {k: v for k, v in params.items() if v is not None}

        max_retries = 0 if no_retry else self.max_retries
        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                if self.debug:
                    logger.debug(f"[WaveSDK:async] {method} {path}")

                response = await self._client.request(
                    method, path, json=json, params=params, **kwargs
                )

                if response.status_code == 429:
                    retry_after = self._parse_retry_after(response)
                    if attempt < max_retries:
                        logger.warning(f"Rate limited. Retrying in {retry_after}s")
                        await asyncio.sleep(retry_after)
                        continue
                    raise RateLimitError(
                        "Rate limit exceeded",
                        retry_after,
                        response.headers.get("x-request-id"),
                    )

                if not response.is_success:
                    error = self._parse_error(response)
                    if error.retryable and attempt < max_retries:
                        delay = self._calculate_backoff(attempt)
                        logger.warning(f"Request failed. Retrying in {delay}s")
                        await asyncio.sleep(delay)
                        continue
                    raise error

                if response.headers.get("content-type", "").startswith("application/json"):
                    return response.json()
                return None

            except httpx.RequestError as e:
                last_error = e
                if attempt < max_retries:
                    delay = self._calculate_backoff(attempt)
                    logger.warning(f"Request error: {e}. Retrying in {delay}s")
                    await asyncio.sleep(delay)
                    continue
                raise WaveError(str(e), "NETWORK_ERROR", 0) from e

        if last_error:
            raise last_error
        raise WaveError("Request failed after retries", "UNKNOWN_ERROR", 0)

    def _parse_error(self, response: httpx.Response) -> WaveError:
        request_id = response.headers.get("x-request-id")
        try:
            body = response.json()
            return WaveError(
                body.get("error", {}).get("message", f"HTTP {response.status_code}"),
                body.get("error", {}).get("code", f"HTTP_{response.status_code}"),
                response.status_code,
                request_id or body.get("request_id"),
                body.get("error", {}).get("details"),
            )
        except Exception:
            return WaveError(
                f"HTTP {response.status_code}: {response.reason_phrase}",
                f"HTTP_{response.status_code}",
                response.status_code,
                request_id,
            )

    def _parse_retry_after(self, response: httpx.Response) -> float:
        retry_after = response.headers.get("retry-after")
        if not retry_after:
            return 1.0
        try:
            return float(retry_after)
        except ValueError:
            return 1.0

    def _calculate_backoff(self, attempt: int) -> float:
        base_delay = 1.0
        max_delay = 30.0
        delay = min(base_delay * (2**attempt), max_delay)
        return delay + random.random() * delay * 0.25

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncWaveClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
