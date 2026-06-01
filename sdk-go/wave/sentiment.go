package wave

import (
	"context"
	"net/url"
	"strconv"
)

// SentimentService accesses the Sentiment product. Sentiment and emotion analysis
type SentimentService struct{ c *Client }

// SentimentListAnalysesParams holds the optional query parameters for Sentiment.ListAnalyses.
type SentimentListAnalysesParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	Status  *string // status
}

func (p *SentimentListAnalysesParams) apply(v url.Values) {
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

// ListAnalyses — List sentiment analyses (operationId: listSentimentAnalyses, GET /sentiment).
func (s *SentimentService) ListAnalyses(ctx context.Context, params *SentimentListAnalysesParams) (*Page[SentimentAnalysis], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[SentimentAnalysis]
	if err := s.c.doRequest(ctx, "GET", "/sentiment", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateAnalysis — Create a sentiment analysis (operationId: createSentimentAnalysis, POST /sentiment).
func (s *SentimentService) CreateAnalysis(ctx context.Context, body SentimentAnalysisCreate) (*SentimentAnalysis, error) {
	var out SentimentAnalysis
	if err := s.c.doRequest(ctx, "POST", "/sentiment", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// AnalyzeText — Analyze text directly (operationId: analyzeText, POST /sentiment/analyze).
func (s *SentimentService) AnalyzeText(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	if err := s.c.doRequest(ctx, "POST", "/sentiment/analyze", nil, body, &out); err != nil {
		return nil, err
	}
	return out, nil
}
