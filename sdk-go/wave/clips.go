package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// ClipsService accesses the Clips product. AI-powered highlight detection and clip management
type ClipsService struct{ c *Client }

// ClipsListParams holds the optional query parameters for Clips.List.
type ClipsListParams struct {
	Page     *int64  // page
	PerPage  *int64  // perPage
	VideoID  *string // videoId
	Status   *string // status
	Category *string // category
}

func (p *ClipsListParams) apply(v url.Values) {
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
	if p.Category != nil {
		v.Set("category", *p.Category)
	}
}

// List — List clips (operationId: listClips, GET /clips).
func (s *ClipsService) List(ctx context.Context, params *ClipsListParams) (*Page[Clip], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[Clip]
	if err := s.c.doRequest(ctx, "GET", "/clips", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Create — Create a clip (operationId: createClip, POST /clips).
func (s *ClipsService) Create(ctx context.Context, body ClipCreate) (*Clip, error) {
	var out Clip
	if err := s.c.doRequest(ctx, "POST", "/clips", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get — Get a clip (operationId: getClip, GET /clips/{clipId}).
func (s *ClipsService) Get(ctx context.Context, clipId string) (*Clip, error) {
	path := strings.ReplaceAll("/clips/{clipId}", "{clipId}", url.PathEscape(clipId))
	var out Clip
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update — Update a clip (operationId: updateClip, PATCH /clips/{clipId}).
func (s *ClipsService) Update(ctx context.Context, clipId string, body ClipUpdate) (*Clip, error) {
	path := strings.ReplaceAll("/clips/{clipId}", "{clipId}", url.PathEscape(clipId))
	var out Clip
	if err := s.c.doRequest(ctx, "PATCH", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete — Delete a clip (operationId: deleteClip, DELETE /clips/{clipId}).
func (s *ClipsService) Delete(ctx context.Context, clipId string) error {
	path := strings.ReplaceAll("/clips/{clipId}", "{clipId}", url.PathEscape(clipId))
	return s.c.doRequest(ctx, "DELETE", path, nil, nil, nil)
}

// Detect — Start AI clip detection (operationId: detectClips, POST /clips/detect).
func (s *ClipsService) Detect(ctx context.Context, body ClipDetectRequest) (*DetectionJob, error) {
	var out DetectionJob
	if err := s.c.doRequest(ctx, "POST", "/clips/detect", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
