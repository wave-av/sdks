package wave

import (
	"context"
	"net/url"
	"strconv"
)

// StudioAiService accesses the Studio AI product. Video enhancement and AI processing
type StudioAiService struct{ c *Client }

// StudioAiListEnhancementsParams holds the optional query parameters for StudioAi.ListEnhancements.
type StudioAiListEnhancementsParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	Type    *string // type
	Status  *string // status
}

func (p *StudioAiListEnhancementsParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
	if p.Type != nil {
		v.Set("type", *p.Type)
	}
	if p.Status != nil {
		v.Set("status", *p.Status)
	}
}

// ListEnhancements — List enhancement jobs (operationId: listEnhancements, GET /studio-ai/enhancements).
func (s *StudioAiService) ListEnhancements(ctx context.Context, params *StudioAiListEnhancementsParams) (*Page[Enhancement], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[Enhancement]
	if err := s.c.doRequest(ctx, "GET", "/studio-ai/enhancements", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateEnhancement — Create an enhancement job (operationId: createEnhancement, POST /studio-ai/enhancements).
func (s *StudioAiService) CreateEnhancement(ctx context.Context, body EnhancementCreate) (*Enhancement, error) {
	var out Enhancement
	if err := s.c.doRequest(ctx, "POST", "/studio-ai/enhancements", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PreviewEnhancement — Generate enhancement preview (operationId: previewEnhancement, POST /studio-ai/preview).
func (s *StudioAiService) PreviewEnhancement(ctx context.Context, body EnhancementPreviewRequest) (map[string]any, error) {
	var out map[string]any
	if err := s.c.doRequest(ctx, "POST", "/studio-ai/preview", nil, body, &out); err != nil {
		return nil, err
	}
	return out, nil
}
