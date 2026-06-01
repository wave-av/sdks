package wave

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewRequiresAPIKey(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("expected error for empty apiKey")
	}
	c, err := New("wave_test_abc")
	if err != nil {
		t.Fatal(err)
	}
	if c.Clips == nil || c.Voice == nil || c.Search == nil || c.Transcribe == nil {
		t.Fatal("services not wired")
	}
}

func TestGetSendsAuthAndDecodes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer wave_test_abc" {
			t.Errorf("auth header = %q", got)
		}
		if r.URL.Path != "/clips/clip_123" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": "clip_123", "title": "demo"})
	}))
	defer srv.Close()

	c, _ := New("wave_test_abc", WithBaseURL(srv.URL))
	clip, err := c.Clips.Get(context.Background(), "clip_123")
	if err != nil {
		t.Fatal(err)
	}
	if clip.ID == nil || *clip.ID != "clip_123" {
		t.Fatalf("clip.ID = %v", clip.ID)
	}
}

func TestListDecodesPagination(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("page") != "2" {
			t.Errorf("page query = %q", r.URL.Query().Get("page"))
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"data":       []map[string]any{{"id": "a"}, {"id": "b"}},
			"pagination": map[string]any{"page": 2, "perPage": 20, "total": 2, "totalPages": 1},
		})
	}))
	defer srv.Close()

	c, _ := New("k", WithBaseURL(srv.URL))
	page := int64(2)
	res, err := c.Clips.List(context.Background(), &ClipsListParams{Page: &page})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Data) != 2 || res.Pagination.Page != 2 {
		t.Fatalf("got %d items, page %d", len(res.Data), res.Pagination.Page)
	}
}

func TestNestedErrorEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("x-request-id", "req_42")
		w.WriteHeader(403)
		json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{"code": "ENTITLEMENT_SCOPE", "message": "scope clips not entitled"},
		})
	}))
	defer srv.Close()

	c, _ := New("k", WithBaseURL(srv.URL))
	_, err := c.Clips.Get(context.Background(), "x")
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *Error, got %T", err)
	}
	if apiErr.Code != "ENTITLEMENT_SCOPE" || apiErr.StatusCode != 403 || apiErr.RequestID != "req_42" {
		t.Fatalf("error mis-parsed: %+v", apiErr)
	}
	if apiErr.Retryable {
		t.Fatal("403 should not be retryable")
	}
}

func TestRateLimitNoRetry(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "0")
		w.WriteHeader(429)
	}))
	defer srv.Close()

	c, _ := New("k", WithBaseURL(srv.URL), WithMaxRetries(0))
	_, err := c.Clips.Get(context.Background(), "x")
	var rl *RateLimitError
	if !errors.As(err, &rl) {
		t.Fatalf("expected *RateLimitError, got %T (%v)", err, err)
	}
}

func TestRetryRespectsContextDeadline(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503) // always retryable -> would loop through full backoff
	}))
	defer srv.Close()

	c, _ := New("k", WithBaseURL(srv.URL), WithMaxRetries(5))
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := c.Clips.Get(ctx, "x")
	elapsed := time.Since(start)
	if err == nil {
		t.Fatal("expected an error")
	}
	// Without context-aware backoff this blocks ~37s; it must abort promptly.
	if elapsed > 3*time.Second {
		t.Fatalf("retry backoff ignored context deadline: blocked %v", elapsed)
	}
}

func TestDeleteReturnsNoBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.WriteHeader(204)
	}))
	defer srv.Close()
	c, _ := New("k", WithBaseURL(srv.URL))
	if err := c.Clips.Delete(context.Background(), "x"); err != nil {
		t.Fatal(err)
	}
}
