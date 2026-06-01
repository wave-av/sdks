package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// TranscribeService accesses the Transcribe product. Speech-to-text transcription
type TranscribeService struct{ c *Client }

// TranscribeListTranscriptionsParams holds the optional query parameters for Transcribe.ListTranscriptions.
type TranscribeListTranscriptionsParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	Status  *string // status
}

func (p *TranscribeListTranscriptionsParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
	if p.Status != nil {
		v.Set("status", *p.Status)
	}
}

// ListTranscriptions — List transcriptions (operationId: listTranscriptions, GET /transcribe).
func (s *TranscribeService) ListTranscriptions(ctx context.Context, params *TranscribeListTranscriptionsParams) (*Page[Transcription], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[Transcription]
	if err := s.c.doRequest(ctx, "GET", "/transcribe", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateTranscription — Create a transcription (operationId: createTranscription, POST /transcribe).
func (s *TranscribeService) CreateTranscription(ctx context.Context, body TranscriptionCreate) (*Transcription, error) {
	var out Transcription
	if err := s.c.doRequest(ctx, "POST", "/transcribe", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetTranscription — Get a transcription (operationId: getTranscription, GET /transcribe/{transcriptionId}).
func (s *TranscribeService) GetTranscription(ctx context.Context, transcriptionId string) (*Transcription, error) {
	path := strings.ReplaceAll("/transcribe/{transcriptionId}", "{transcriptionId}", url.PathEscape(transcriptionId))
	var out Transcription
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteTranscription — Delete a transcription (operationId: deleteTranscription, DELETE /transcribe/{transcriptionId}).
func (s *TranscribeService) DeleteTranscription(ctx context.Context, transcriptionId string) error {
	path := strings.ReplaceAll("/transcribe/{transcriptionId}", "{transcriptionId}", url.PathEscape(transcriptionId))
	return s.c.doRequest(ctx, "DELETE", path, nil, nil, nil)
}
