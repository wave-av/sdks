package wave

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://api.wave.online/v1"
	userAgent      = "wave-sdk-go/0.1.0"
)

// Client is the WAVE API client. Construct it with New and reach products via
// the typed service fields (c.Clips, c.Voice, ...).
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	maxRetries int

	Clips      *ClipsService
	Voice      *VoiceService
	Captions   *CaptionsService
	Chapters   *ChaptersService
	Editor     *EditorService
	Phone      *PhoneService
	Collab     *CollabService
	Podcast    *PodcastService
	StudioAi   *StudioAiService
	Transcribe *TranscribeService
	Sentiment  *SentimentService
	Search     *SearchService
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the gateway base URL (e.g. the staging endpoint).
func WithBaseURL(u string) Option { return func(c *Client) { c.baseURL = strings.TrimRight(u, "/") } }

// WithHTTPClient supplies a custom *http.Client (timeouts, proxy, transport).
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.httpClient = h } }

// WithMaxRetries sets the retry budget for retryable failures (default 3).
func WithMaxRetries(n int) Option { return func(c *Client) { c.maxRetries = n } }

// New creates a Client. apiKey is required.
func New(apiKey string, opts ...Option) (*Client, error) {
	if apiKey == "" {
		return nil, errors.New("wave: apiKey is required")
	}
	c := &Client{
		baseURL:    defaultBaseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		maxRetries: 3,
	}
	for _, o := range opts {
		o(c)
	}
	c.Clips = &ClipsService{c: c}
	c.Voice = &VoiceService{c: c}
	c.Captions = &CaptionsService{c: c}
	c.Chapters = &ChaptersService{c: c}
	c.Editor = &EditorService{c: c}
	c.Phone = &PhoneService{c: c}
	c.Collab = &CollabService{c: c}
	c.Podcast = &PodcastService{c: c}
	c.StudioAi = &StudioAiService{c: c}
	c.Transcribe = &TranscribeService{c: c}
	c.Sentiment = &SentimentService{c: c}
	c.Search = &SearchService{c: c}
	return c, nil
}

// doRequest performs an authenticated request with retry/backoff and decodes a
// JSON response into out (out may be nil for 204/no-content endpoints).
func (c *Client) doRequest(ctx context.Context, method, path string, query url.Values, body, out any) error {
	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	var rawBody []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return newError(err.Error(), "SERIALIZATION_ERROR", 0, "", nil)
		}
		rawBody = b
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(rawBody))
		if err != nil {
			return newError(err.Error(), "REQUEST_ERROR", 0, "", nil)
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", userAgent)
		if rawBody != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = newError(err.Error(), "NETWORK_ERROR", 0, "", nil)
			if attempt < c.maxRetries {
				if cerr := sleepCtx(ctx, backoff(attempt)); cerr != nil {
					return cerr
				}
				continue
			}
			return lastErr
		}

		reqID := resp.Header.Get("x-request-id")

		if resp.StatusCode == 429 {
			ra := parseRetryAfter(resp)
			resp.Body.Close()
			if attempt < c.maxRetries {
				if cerr := sleepCtx(ctx, time.Duration(ra*float64(time.Second))); cerr != nil {
					return cerr
				}
				continue
			}
			return &RateLimitError{Message: "rate limit exceeded", Code: "RATE_LIMITED", StatusCode: 429, RequestID: reqID, RetryAfter: ra}
		}

		if resp.StatusCode >= 400 {
			apiErr := parseError(resp, reqID)
			resp.Body.Close()
			if apiErr.Retryable && attempt < c.maxRetries {
				lastErr = apiErr
				if cerr := sleepCtx(ctx, backoff(attempt)); cerr != nil {
					return cerr
				}
				continue
			}
			return apiErr
		}

		defer resp.Body.Close()
		if out == nil || resp.StatusCode == http.StatusNoContent {
			io.Copy(io.Discard, resp.Body)
			return nil
		}
		if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
			io.Copy(io.Discard, resp.Body)
			return nil
		}
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil && err != io.EOF {
			return newError(err.Error(), "DESERIALIZATION_ERROR", resp.StatusCode, reqID, nil)
		}
		return nil
	}
	if lastErr != nil {
		return lastErr
	}
	return newError("request failed after retries", "UNKNOWN_ERROR", 0, "", nil)
}

func parseError(resp *http.Response, reqID string) *Error {
	var envelope struct {
		Error struct {
			Message string `json:"message"`
			Code    string `json:"code"`
			Details any    `json:"details"`
		} `json:"error"`
		RequestID string `json:"request_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err == nil && envelope.Error.Message != "" {
		rid := reqID
		if rid == "" {
			rid = envelope.RequestID
		}
		return newError(envelope.Error.Message, envelope.Error.Code, resp.StatusCode, rid, envelope.Error.Details)
	}
	return newError(fmt.Sprintf("HTTP %d", resp.StatusCode), fmt.Sprintf("HTTP_%d", resp.StatusCode), resp.StatusCode, reqID, nil)
}

func parseRetryAfter(resp *http.Response) float64 {
	if v := resp.Header.Get("Retry-After"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return 1.0
}

func backoff(attempt int) time.Duration {
	d := math.Min(math.Pow(2, float64(attempt)), 30)
	jitter := rand.Float64() * d * 0.25
	return time.Duration((d + jitter) * float64(time.Second))
}

// sleepCtx waits for d, but returns the context error immediately if ctx is
// cancelled or its deadline passes during the wait — so a cancelled request
// aborts its retry backoff instead of blocking for the full delay.
func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// compile-time assertions that both error types satisfy error.
var _ error = (*Error)(nil)
var _ error = (*RateLimitError)(nil)
