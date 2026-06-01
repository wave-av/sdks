package wave

import (
	"context"
	"net/url"
	"strings"
)

// ChaptersService accesses the Chapters product. AI chapter detection and video segmentation
type ChaptersService struct{ c *Client }

// List — List chapters for a video (operationId: listChapters, GET /videos/{videoId}/chapters).
func (s *ChaptersService) List(ctx context.Context, videoId string) (map[string]any, error) {
	path := strings.ReplaceAll("/videos/{videoId}/chapters", "{videoId}", url.PathEscape(videoId))
	var out map[string]any
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Create — Create a chapter (operationId: createChapter, POST /videos/{videoId}/chapters).
func (s *ChaptersService) Create(ctx context.Context, videoId string, body ChapterCreate) (*Chapter, error) {
	path := strings.ReplaceAll("/videos/{videoId}/chapters", "{videoId}", url.PathEscape(videoId))
	var out Chapter
	if err := s.c.doRequest(ctx, "POST", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Detect — Start AI chapter detection (operationId: detectChapters, POST /videos/{videoId}/chapters/detect).
func (s *ChaptersService) Detect(ctx context.Context, videoId string, body ChapterDetectRequest) (*DetectionJob, error) {
	path := strings.ReplaceAll("/videos/{videoId}/chapters/detect", "{videoId}", url.PathEscape(videoId))
	var out DetectionJob
	if err := s.c.doRequest(ctx, "POST", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
