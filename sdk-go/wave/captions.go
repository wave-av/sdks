package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// CaptionsService accesses the Captions product. Auto-captioning and multi-language translation
type CaptionsService struct{ c *Client }

// CaptionsListParams holds the optional query parameters for Captions.List.
type CaptionsListParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	VideoID *string // videoId
	Status  *string // status
}

func (p *CaptionsListParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
	if p.VideoID != nil {
		v.Set("videoId", *p.VideoID)
	}
	if p.Status != nil {
		v.Set("status", *p.Status)
	}
}

// List — List caption jobs (operationId: listCaptions, GET /captions).
func (s *CaptionsService) List(ctx context.Context, params *CaptionsListParams) (*Page[CaptionJob], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[CaptionJob]
	if err := s.c.doRequest(ctx, "GET", "/captions", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateJob — Create a caption job (operationId: createCaptionJob, POST /captions).
func (s *CaptionsService) CreateJob(ctx context.Context, body CaptionJobCreate) (*CaptionJob, error) {
	var out CaptionJob
	if err := s.c.doRequest(ctx, "POST", "/captions", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetJob — Get a caption job (operationId: getCaptionJob, GET /captions/{jobId}).
func (s *CaptionsService) GetJob(ctx context.Context, jobId string) (*CaptionJob, error) {
	path := strings.ReplaceAll("/captions/{jobId}", "{jobId}", url.PathEscape(jobId))
	var out CaptionJob
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteJob — Delete a caption job (operationId: deleteCaptionJob, DELETE /captions/{jobId}).
func (s *CaptionsService) DeleteJob(ctx context.Context, jobId string) error {
	path := strings.ReplaceAll("/captions/{jobId}", "{jobId}", url.PathEscape(jobId))
	return s.c.doRequest(ctx, "DELETE", path, nil, nil, nil)
}

// CaptionsDownloadParams holds the optional query parameters for Captions.Download.
type CaptionsDownloadParams struct {
	Format *string // format
}

func (p *CaptionsDownloadParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Format != nil {
		v.Set("format", *p.Format)
	}
}

// Download — Download captions (operationId: downloadCaptions, GET /captions/{jobId}/download).
func (s *CaptionsService) Download(ctx context.Context, jobId string, language string, params *CaptionsDownloadParams) (map[string]any, error) {
	path := strings.ReplaceAll("/captions/{jobId}/download", "{jobId}", url.PathEscape(jobId))
	vals := url.Values{}
	vals.Set("language", language)
	params.apply(vals)
	var out map[string]any
	if err := s.c.doRequest(ctx, "GET", path, vals, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}
