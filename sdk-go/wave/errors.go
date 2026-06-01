package wave

import "fmt"

// Error is the canonical WAVE API error. The gateway emits a nested envelope
// {"error":{"code","message"}}; Code/Message are lifted from it.
type Error struct {
	Message    string
	Code       string
	StatusCode int
	RequestID  string
	Details    any
	Retryable  bool
}

func (e *Error) Error() string {
	return fmt.Sprintf("wave: [%s] %s", e.Code, e.Message)
}

// RateLimitError is returned on HTTP 429 once retries are exhausted.
type RateLimitError struct {
	Message    string
	Code       string
	StatusCode int
	RequestID  string
	RetryAfter float64 // seconds
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("wave: [%s] %s (retry after %.0fs)", e.Code, e.Message, e.RetryAfter)
}

func isRetryable(status int, code string) bool {
	if status == 429 || (status >= 500 && status < 600) {
		return true
	}
	switch code {
	case "TIMEOUT", "NETWORK_ERROR", "SERVICE_UNAVAILABLE":
		return true
	}
	return false
}

func newError(message, code string, status int, requestID string, details any) *Error {
	return &Error{Message: message, Code: code, StatusCode: status, RequestID: requestID, Details: details, Retryable: isRetryable(status, code)}
}
