package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// CollabService accesses the Collab product. Real-time collaboration rooms
type CollabService struct{ c *Client }

// CollabListRoomsParams holds the optional query parameters for Collab.ListRooms.
type CollabListRoomsParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	Status  *string // status
}

func (p *CollabListRoomsParams) apply(v url.Values) {
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

// ListRooms — List collaboration rooms (operationId: listCollabRooms, GET /collab/rooms).
func (s *CollabService) ListRooms(ctx context.Context, params *CollabListRoomsParams) (*Page[CollabRoom], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[CollabRoom]
	if err := s.c.doRequest(ctx, "GET", "/collab/rooms", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateRoom — Create a collaboration room (operationId: createCollabRoom, POST /collab/rooms).
func (s *CollabService) CreateRoom(ctx context.Context, body CollabRoomCreate) (*CollabRoom, error) {
	var out CollabRoom
	if err := s.c.doRequest(ctx, "POST", "/collab/rooms", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetRoom — Get a room (operationId: getCollabRoom, GET /collab/rooms/{roomId}).
func (s *CollabService) GetRoom(ctx context.Context, roomId string) (*CollabRoom, error) {
	path := strings.ReplaceAll("/collab/rooms/{roomId}", "{roomId}", url.PathEscape(roomId))
	var out CollabRoom
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteRoom — Delete a room (operationId: deleteCollabRoom, DELETE /collab/rooms/{roomId}).
func (s *CollabService) DeleteRoom(ctx context.Context, roomId string) error {
	path := strings.ReplaceAll("/collab/rooms/{roomId}", "{roomId}", url.PathEscape(roomId))
	return s.c.doRequest(ctx, "DELETE", path, nil, nil, nil)
}
