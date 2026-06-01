package wave

import (
	"context"
	"net/url"
	"strconv"
)

// SearchService accesses the Search product. Semantic content search
type SearchService struct{ c *Client }

// Search — Search content (operationId: search, POST /search).
func (s *SearchService) Search(ctx context.Context, body SearchRequest) (map[string]any, error) {
	var out map[string]any
	if err := s.c.doRequest(ctx, "POST", "/search", nil, body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchQuickParams holds the optional query parameters for Search.Quick.
type SearchQuickParams struct {
	Limit *int64 // limit
}

func (p *SearchQuickParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Limit != nil {
		v.Set("limit", strconv.FormatInt(*p.Limit, 10))
	}
}

// Quick — Quick search (operationId: quickSearch, GET /search/quick).
func (s *SearchService) Quick(ctx context.Context, q string, params *SearchQuickParams) (map[string]any, error) {
	vals := url.Values{}
	vals.Set("q", q)
	params.apply(vals)
	var out map[string]any
	if err := s.c.doRequest(ctx, "GET", "/search/quick", vals, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchSuggestParams holds the optional query parameters for Search.Suggest.
type SearchSuggestParams struct {
	Limit *int64 // limit
}

func (p *SearchSuggestParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Limit != nil {
		v.Set("limit", strconv.FormatInt(*p.Limit, 10))
	}
}

// Suggest — Get search suggestions (operationId: searchSuggest, GET /search/suggest).
func (s *SearchService) Suggest(ctx context.Context, q string, params *SearchSuggestParams) (map[string]any, error) {
	vals := url.Values{}
	vals.Set("q", q)
	params.apply(vals)
	var out map[string]any
	if err := s.c.doRequest(ctx, "GET", "/search/suggest", vals, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Semantic — Semantic search (operationId: semanticSearch, POST /search/semantic).
func (s *SearchService) Semantic(ctx context.Context, body map[string]any) (map[string]any, error) {
	var out map[string]any
	if err := s.c.doRequest(ctx, "POST", "/search/semantic", nil, body, &out); err != nil {
		return nil, err
	}
	return out, nil
}
