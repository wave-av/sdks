package wave

import (
	"context"
	"net/url"
)

// VoiceService accesses the Voice product. Text-to-speech synthesis and voice cloning
type VoiceService struct{ c *Client }

// VoiceListParams holds the optional query parameters for Voice.List.
type VoiceListParams struct {
	Category *string // category
	Language *string // language
}

func (p *VoiceListParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Category != nil {
		v.Set("category", *p.Category)
	}
	if p.Language != nil {
		v.Set("language", *p.Language)
	}
}

// List — List available voices (operationId: listVoices, GET /voice/voices).
func (s *VoiceService) List(ctx context.Context, params *VoiceListParams) (map[string]any, error) {
	vals := url.Values{}
	params.apply(vals)
	var out map[string]any
	if err := s.c.doRequest(ctx, "GET", "/voice/voices", vals, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GenerateSpeech — Generate speech from text (operationId: generateSpeech, POST /voice/generate).
func (s *VoiceService) GenerateSpeech(ctx context.Context, body VoiceGenerateRequest) (*VoiceGeneration, error) {
	var out VoiceGeneration
	if err := s.c.doRequest(ctx, "POST", "/voice/generate", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Clone — Clone a voice from audio samples (operationId: cloneVoice, POST /voice/clone).
func (s *VoiceService) Clone(ctx context.Context, body VoiceCloneRequest) (*Voice, error) {
	var out Voice
	if err := s.c.doRequest(ctx, "POST", "/voice/clone", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
