package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// PodcastService accesses the Podcast product. Podcast show and episode management
type PodcastService struct{ c *Client }

// PodcastListShowsParams holds the optional query parameters for Podcast.ListShows.
type PodcastListShowsParams struct {
	Page    *int64 // page
	PerPage *int64 // perPage
}

func (p *PodcastListShowsParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
}

// ListShows — List podcast shows (operationId: listPodcastShows, GET /podcast/shows).
func (s *PodcastService) ListShows(ctx context.Context, params *PodcastListShowsParams) (*Page[PodcastShow], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[PodcastShow]
	if err := s.c.doRequest(ctx, "GET", "/podcast/shows", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateShow — Create a podcast show (operationId: createPodcastShow, POST /podcast/shows).
func (s *PodcastService) CreateShow(ctx context.Context, body PodcastShowCreate) (*PodcastShow, error) {
	var out PodcastShow
	if err := s.c.doRequest(ctx, "POST", "/podcast/shows", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PodcastListEpisodesParams holds the optional query parameters for Podcast.ListEpisodes.
type PodcastListEpisodesParams struct {
	Page    *int64 // page
	PerPage *int64 // perPage
}

func (p *PodcastListEpisodesParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
}

// ListEpisodes — List episodes for a show (operationId: listPodcastEpisodes, GET /podcast/shows/{showId}/episodes).
func (s *PodcastService) ListEpisodes(ctx context.Context, showId string, params *PodcastListEpisodesParams) (*Page[PodcastEpisode], error) {
	path := strings.ReplaceAll("/podcast/shows/{showId}/episodes", "{showId}", url.PathEscape(showId))
	vals := url.Values{}
	params.apply(vals)
	var out Page[PodcastEpisode]
	if err := s.c.doRequest(ctx, "GET", path, vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateEpisode — Create an episode (operationId: createPodcastEpisode, POST /podcast/shows/{showId}/episodes).
func (s *PodcastService) CreateEpisode(ctx context.Context, showId string, body PodcastEpisodeCreate) (*PodcastEpisode, error) {
	path := strings.ReplaceAll("/podcast/shows/{showId}/episodes", "{showId}", url.PathEscape(showId))
	var out PodcastEpisode
	if err := s.c.doRequest(ctx, "POST", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
