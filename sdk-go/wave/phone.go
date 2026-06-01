package wave

import (
	"context"
	"net/url"
	"strconv"
)

// PhoneService accesses the Phone product. VoIP phone lines and call management
type PhoneService struct{ c *Client }

// PhoneListLinesParams holds the optional query parameters for Phone.ListLines.
type PhoneListLinesParams struct {
	Page    *int64 // page
	PerPage *int64 // perPage
}

func (p *PhoneListLinesParams) apply(v url.Values) {
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

// ListLines — List phone lines (operationId: listPhoneLines, GET /phone/lines).
func (s *PhoneService) ListLines(ctx context.Context, params *PhoneListLinesParams) (*Page[PhoneLine], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[PhoneLine]
	if err := s.c.doRequest(ctx, "GET", "/phone/lines", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ProvisionLine — Provision a phone line (operationId: provisionPhoneLine, POST /phone/lines).
func (s *PhoneService) ProvisionLine(ctx context.Context, body PhoneLineProvision) (*PhoneLine, error) {
	var out PhoneLine
	if err := s.c.doRequest(ctx, "POST", "/phone/lines", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PhoneListCallsParams holds the optional query parameters for Phone.ListCalls.
type PhoneListCallsParams struct {
	Page      *int64  // page
	PerPage   *int64  // perPage
	LineID    *string // lineId
	Direction *string // direction
}

func (p *PhoneListCallsParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
	if p.LineID != nil {
		v.Set("lineId", *p.LineID)
	}
	if p.Direction != nil {
		v.Set("direction", *p.Direction)
	}
}

// ListCalls — List calls (operationId: listCalls, GET /phone/calls).
func (s *PhoneService) ListCalls(ctx context.Context, params *PhoneListCallsParams) (*Page[Call], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[Call]
	if err := s.c.doRequest(ctx, "GET", "/phone/calls", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// MakeCall — Make a call (operationId: makeCall, POST /phone/calls).
func (s *PhoneService) MakeCall(ctx context.Context, body CallCreate) (*Call, error) {
	var out Call
	if err := s.c.doRequest(ctx, "POST", "/phone/calls", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
