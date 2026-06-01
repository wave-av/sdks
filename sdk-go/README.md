# WAVE SDK for Go

Official Go client for the [WAVE](https://wave.online) API. Generated from the gateway OpenAPI
contract — the most contract-accurate client in the fleet.

```bash
go get github.com/wave-av/sdks/sdk-go@latest
```

## Usage

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/wave-av/sdks/sdk-go/wave"
)

func main() {
	c, err := wave.New("wave_live_...")
	if err != nil {
		log.Fatal(err)
	}

	clip, err := c.Clips.Get(context.Background(), "clip_123")
	if err != nil {
		var apiErr *wave.Error
		if errors.As(err, &apiErr) {
			log.Fatalf("[%s] %s (status %d)", apiErr.Code, apiErr.Message, apiErr.StatusCode)
		}
		log.Fatal(err)
	}
	fmt.Println(*clip.Title)

	page, _ := c.Clips.List(context.Background(), &wave.ClipsListParams{VideoID: ptr("vid_1")})
	fmt.Println(len(page.Data), "clips of", page.Pagination.Total)
}

func ptr[T any](v T) *T { return &v }
```

## Notes

- **Auth + entitlement** are enforced server-side at the gateway (`401` unauthenticated, `402`
  not-entitled, `403` out-of-scope). Installing this package does not grant access.
- **Configuration:** `wave.New(key, wave.WithBaseURL(...), wave.WithMaxRetries(n), wave.WithHTTPClient(...))`.
  Defaults: base `https://api.wave.online/v1`, 3 retries, 30s timeout.
- **Errors:** non-2xx → `*wave.Error`; `429` (after retries) → `*wave.RateLimitError`. Retries apply
  to `429`/`5xx`/transport errors with exponential backoff and `Retry-After`.
- **Generated** by `codegen/` from `codegen/openapi.yaml`; do not edit `wave/*.go` by hand.

## Status

`v0.1.0` — covers all 12 contract-frozen products (49 operations). New; not yet exercised against the
live gateway end-to-end. License: MIT.
