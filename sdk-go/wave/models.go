package wave

// JobStatus is a string enum.
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusCancelled  JobStatus = "cancelled"
)

// Clip is a generated model.
type Clip struct {
	ID             *string    `json:"id,omitempty"`
	VideoID        *string    `json:"videoId,omitempty"`
	StartTime      *float64   `json:"startTime,omitempty"`
	EndTime        *float64   `json:"endTime,omitempty"`
	Duration       *float64   `json:"duration,omitempty"`
	Title          *string    `json:"title,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Score          *float64   `json:"score,omitempty"`
	Category       *string    `json:"category,omitempty"`
	ThumbnailURL   *string    `json:"thumbnailUrl,omitempty"`
	PreviewURL     *string    `json:"previewUrl,omitempty"`
	Status         *JobStatus `json:"status,omitempty"`
	OrganizationID *string    `json:"organizationId,omitempty"`
	CreatedAt      *string    `json:"createdAt,omitempty"`
	UpdatedAt      *string    `json:"updatedAt,omitempty"`
}

// ClipCreate is a generated model.
type ClipCreate struct {
	VideoID     string  `json:"videoId"`
	StartTime   float64 `json:"startTime"`
	EndTime     float64 `json:"endTime"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Category    *string `json:"category,omitempty"`
}

// ClipUpdate is a generated model.
type ClipUpdate struct {
	Title       *string  `json:"title,omitempty"`
	Description *string  `json:"description,omitempty"`
	StartTime   *float64 `json:"startTime,omitempty"`
	EndTime     *float64 `json:"endTime,omitempty"`
}

// ClipDetectRequest is a generated model.
type ClipDetectRequest struct {
	VideoID     string   `json:"videoId"`
	MinDuration *float64 `json:"minDuration,omitempty"`
	MaxDuration *float64 `json:"maxDuration,omitempty"`
	Categories  []string `json:"categories,omitempty"`
	Sensitivity *float64 `json:"sensitivity,omitempty"`
	MaxClips    *int64   `json:"maxClips,omitempty"`
}

// DetectionJob is a generated model.
type DetectionJob struct {
	ID        *string    `json:"id,omitempty"`
	Status    *JobStatus `json:"status,omitempty"`
	Progress  *int64     `json:"progress,omitempty"`
	CreatedAt *string    `json:"createdAt,omitempty"`
}

// Voice is a generated model.
type Voice struct {
	ID          *string        `json:"id,omitempty"`
	Name        *string        `json:"name,omitempty"`
	Description *string        `json:"description,omitempty"`
	PreviewURL  *string        `json:"previewUrl,omitempty"`
	Category    *string        `json:"category,omitempty"`
	Labels      map[string]any `json:"labels,omitempty"`
}

// VoiceGeneration is a generated model.
type VoiceGeneration struct {
	ID             *string    `json:"id,omitempty"`
	VoiceID        *string    `json:"voiceId,omitempty"`
	Text           *string    `json:"text,omitempty"`
	Status         *JobStatus `json:"status,omitempty"`
	AudioURL       *string    `json:"audioUrl,omitempty"`
	Duration       *float64   `json:"duration,omitempty"`
	CharacterCount *int64     `json:"characterCount,omitempty"`
	Model          *string    `json:"model,omitempty"`
	CreatedAt      *string    `json:"createdAt,omitempty"`
	UpdatedAt      *string    `json:"updatedAt,omitempty"`
}

// VoiceGenerateRequest is a generated model.
type VoiceGenerateRequest struct {
	VoiceID         string   `json:"voiceId"`
	Text            string   `json:"text"`
	Stability       *float64 `json:"stability,omitempty"`
	SimilarityBoost *float64 `json:"similarityBoost,omitempty"`
	Style           *float64 `json:"style,omitempty"`
	Model           *string  `json:"model,omitempty"`
	OutputFormat    *string  `json:"outputFormat,omitempty"`
}

// VoiceCloneRequest is a generated model.
type VoiceCloneRequest struct {
	Name        string         `json:"name"`
	AudioFiles  []string       `json:"audioFiles"`
	Description *string        `json:"description,omitempty"`
	Labels      map[string]any `json:"labels,omitempty"`
}

// CaptionJob is a generated model.
type CaptionJob struct {
	ID              *string        `json:"id,omitempty"`
	VideoID         *string        `json:"videoId,omitempty"`
	SourceLanguage  *string        `json:"sourceLanguage,omitempty"`
	TargetLanguages []string       `json:"targetLanguages,omitempty"`
	Status          *JobStatus     `json:"status,omitempty"`
	Progress        *int64         `json:"progress,omitempty"`
	Outputs         map[string]any `json:"outputs,omitempty"`
	ErrorMessage    *string        `json:"errorMessage,omitempty"`
	OrganizationID  *string        `json:"organizationId,omitempty"`
	CreatedAt       *string        `json:"createdAt,omitempty"`
	UpdatedAt       *string        `json:"updatedAt,omitempty"`
}

// CaptionJobCreate is a generated model.
type CaptionJobCreate struct {
	VideoID         string   `json:"videoId"`
	SourceLanguage  *string  `json:"sourceLanguage,omitempty"`
	TargetLanguages []string `json:"targetLanguages,omitempty"`
	Style           *string  `json:"style,omitempty"`
	SpeakerLabels   *bool    `json:"speakerLabels,omitempty"`
}

// Chapter is a generated model.
type Chapter struct {
	ID           *string  `json:"id,omitempty"`
	VideoID      *string  `json:"videoId,omitempty"`
	Title        *string  `json:"title,omitempty"`
	Description  *string  `json:"description,omitempty"`
	StartTime    *float64 `json:"startTime,omitempty"`
	EndTime      *float64 `json:"endTime,omitempty"`
	ThumbnailURL *string  `json:"thumbnailUrl,omitempty"`
}

// ChapterCreate is a generated model.
type ChapterCreate struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	StartTime   float64 `json:"startTime"`
	EndTime     float64 `json:"endTime"`
}

// ChapterDetectRequest is a generated model.
type ChapterDetectRequest struct {
	MinDuration         *float64 `json:"minDuration,omitempty"`
	MaxChapters         *int64   `json:"maxChapters,omitempty"`
	IncludeDescriptions *bool    `json:"includeDescriptions,omitempty"`
	IncludeThumbnails   *bool    `json:"includeThumbnails,omitempty"`
}

// EditorProject is a generated model.
type EditorProject struct {
	ID             *string  `json:"id,omitempty"`
	Name           *string  `json:"name,omitempty"`
	Description    *string  `json:"description,omitempty"`
	Status         *string  `json:"status,omitempty"`
	Duration       *float64 `json:"duration,omitempty"`
	Resolution     *string  `json:"resolution,omitempty"`
	FrameRate      *float64 `json:"frameRate,omitempty"`
	ThumbnailURL   *string  `json:"thumbnailUrl,omitempty"`
	ExportURL      *string  `json:"exportUrl,omitempty"`
	OrganizationID *string  `json:"organizationId,omitempty"`
	CreatedAt      *string  `json:"createdAt,omitempty"`
	UpdatedAt      *string  `json:"updatedAt,omitempty"`
}

// EditorProjectCreate is a generated model.
type EditorProjectCreate struct {
	Name        string   `json:"name"`
	Description *string  `json:"description,omitempty"`
	Resolution  *string  `json:"resolution,omitempty"`
	FrameRate   *float64 `json:"frameRate,omitempty"`
	AspectRatio *string  `json:"aspectRatio,omitempty"`
}

// EditorProjectUpdate is a generated model.
type EditorProjectUpdate struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// ExportRequest is a generated model.
type ExportRequest struct {
	Format     *string `json:"format,omitempty"`
	Resolution *string `json:"resolution,omitempty"`
	Quality    *string `json:"quality,omitempty"`
}

// ExportJob is a generated model.
type ExportJob struct {
	ID        *string    `json:"id,omitempty"`
	Status    *JobStatus `json:"status,omitempty"`
	Progress  *int64     `json:"progress,omitempty"`
	OutputURL *string    `json:"outputUrl,omitempty"`
}

// PhoneLine is a generated model.
type PhoneLine struct {
	ID             *string  `json:"id,omitempty"`
	Number         *string  `json:"number,omitempty"`
	Name           *string  `json:"name,omitempty"`
	Status         *string  `json:"status,omitempty"`
	Capabilities   []string `json:"capabilities,omitempty"`
	MonthlyCost    *float64 `json:"monthlyCost,omitempty"`
	OrganizationID *string  `json:"organizationId,omitempty"`
	CreatedAt      *string  `json:"createdAt,omitempty"`
	UpdatedAt      *string  `json:"updatedAt,omitempty"`
}

// PhoneLineProvision is a generated model.
type PhoneLineProvision struct {
	AreaCode     *string  `json:"areaCode,omitempty"`
	Country      *string  `json:"country,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
	Name         *string  `json:"name,omitempty"`
}

// Call is a generated model.
type Call struct {
	ID           *string `json:"id,omitempty"`
	LineID       *string `json:"lineId,omitempty"`
	Direction    *string `json:"direction,omitempty"`
	FromNumber   *string `json:"fromNumber,omitempty"`
	ToNumber     *string `json:"toNumber,omitempty"`
	Status       *string `json:"status,omitempty"`
	Duration     *int64  `json:"duration,omitempty"`
	RecordingURL *string `json:"recordingUrl,omitempty"`
	Transcript   *string `json:"transcript,omitempty"`
	CreatedAt    *string `json:"createdAt,omitempty"`
	UpdatedAt    *string `json:"updatedAt,omitempty"`
}

// CallCreate is a generated model.
type CallCreate struct {
	FromLineID string  `json:"fromLineId"`
	ToNumber   string  `json:"toNumber"`
	Record     *bool   `json:"record,omitempty"`
	Transcribe *bool   `json:"transcribe,omitempty"`
	WebhookURL *string `json:"webhookUrl,omitempty"`
}

// CollabRoom is a generated model.
type CollabRoom struct {
	ID                  *string `json:"id,omitempty"`
	Name                *string `json:"name,omitempty"`
	Type                *string `json:"type,omitempty"`
	Status              *string `json:"status,omitempty"`
	MaxParticipants     *int64  `json:"maxParticipants,omitempty"`
	CurrentParticipants *int64  `json:"currentParticipants,omitempty"`
	ScheduledStart      *string `json:"scheduledStart,omitempty"`
	JoinURL             *string `json:"joinUrl,omitempty"`
	OrganizationID      *string `json:"organizationId,omitempty"`
	CreatedAt           *string `json:"createdAt,omitempty"`
	UpdatedAt           *string `json:"updatedAt,omitempty"`
}

// CollabRoomCreate is a generated model.
type CollabRoomCreate struct {
	Name            string         `json:"name"`
	Type            string         `json:"type"`
	MaxParticipants *int64         `json:"maxParticipants,omitempty"`
	ScheduledStart  *string        `json:"scheduledStart,omitempty"`
	Settings        map[string]any `json:"settings,omitempty"`
}

// PodcastShow is a generated model.
type PodcastShow struct {
	ID             *string `json:"id,omitempty"`
	Name           *string `json:"name,omitempty"`
	Description    *string `json:"description,omitempty"`
	CoverURL       *string `json:"coverUrl,omitempty"`
	RssURL         *string `json:"rssUrl,omitempty"`
	Category       *string `json:"category,omitempty"`
	Language       *string `json:"language,omitempty"`
	Explicit       *bool   `json:"explicit,omitempty"`
	EpisodeCount   *int64  `json:"episodeCount,omitempty"`
	OrganizationID *string `json:"organizationId,omitempty"`
	CreatedAt      *string `json:"createdAt,omitempty"`
	UpdatedAt      *string `json:"updatedAt,omitempty"`
}

// PodcastShowCreate is a generated model.
type PodcastShowCreate struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Category    *string `json:"category,omitempty"`
	Language    *string `json:"language,omitempty"`
	Explicit    *bool   `json:"explicit,omitempty"`
	CoverURL    *string `json:"coverUrl,omitempty"`
}

// PodcastEpisode is a generated model.
type PodcastEpisode struct {
	ID            *string  `json:"id,omitempty"`
	ShowID        *string  `json:"showId,omitempty"`
	Title         *string  `json:"title,omitempty"`
	Description   *string  `json:"description,omitempty"`
	AudioURL      *string  `json:"audioUrl,omitempty"`
	Duration      *float64 `json:"duration,omitempty"`
	EpisodeNumber *int64   `json:"episodeNumber,omitempty"`
	SeasonNumber  *int64   `json:"seasonNumber,omitempty"`
	PublishedAt   *string  `json:"publishedAt,omitempty"`
	Status        *string  `json:"status,omitempty"`
	CreatedAt     *string  `json:"createdAt,omitempty"`
	UpdatedAt     *string  `json:"updatedAt,omitempty"`
}

// PodcastEpisodeCreate is a generated model.
type PodcastEpisodeCreate struct {
	Title         string  `json:"title"`
	Description   *string `json:"description,omitempty"`
	AudioURL      string  `json:"audioUrl"`
	EpisodeNumber *int64  `json:"episodeNumber,omitempty"`
	SeasonNumber  *int64  `json:"seasonNumber,omitempty"`
	PublishedAt   *string `json:"publishedAt,omitempty"`
}

// Enhancement is a generated model.
type Enhancement struct {
	ID             *string        `json:"id,omitempty"`
	VideoID        *string        `json:"videoId,omitempty"`
	Type           *string        `json:"type,omitempty"`
	Status         *JobStatus     `json:"status,omitempty"`
	Progress       *int64         `json:"progress,omitempty"`
	InputURL       *string        `json:"inputUrl,omitempty"`
	OutputURL      *string        `json:"outputUrl,omitempty"`
	Settings       map[string]any `json:"settings,omitempty"`
	CreditsUsed    *int64         `json:"creditsUsed,omitempty"`
	OrganizationID *string        `json:"organizationId,omitempty"`
	CreatedAt      *string        `json:"createdAt,omitempty"`
	UpdatedAt      *string        `json:"updatedAt,omitempty"`
}

// EnhancementCreate is a generated model.
type EnhancementCreate struct {
	VideoID  string         `json:"videoId"`
	Type     string         `json:"type"`
	Settings map[string]any `json:"settings,omitempty"`
	Priority *string        `json:"priority,omitempty"`
}

// EnhancementPreviewRequest is a generated model.
type EnhancementPreviewRequest struct {
	VideoID   string         `json:"videoId"`
	Type      string         `json:"type"`
	Timestamp *float64       `json:"timestamp,omitempty"`
	Settings  map[string]any `json:"settings,omitempty"`
}

// Transcription is a generated model.
type Transcription struct {
	ID             *string    `json:"id,omitempty"`
	SourceID       *string    `json:"sourceId,omitempty"`
	SourceType     *string    `json:"sourceType,omitempty"`
	Status         *JobStatus `json:"status,omitempty"`
	Language       *string    `json:"language,omitempty"`
	Text           *string    `json:"text,omitempty"`
	Duration       *float64   `json:"duration,omitempty"`
	WordCount      *int64     `json:"wordCount,omitempty"`
	Confidence     *float64   `json:"confidence,omitempty"`
	OrganizationID *string    `json:"organizationId,omitempty"`
	CreatedAt      *string    `json:"createdAt,omitempty"`
	UpdatedAt      *string    `json:"updatedAt,omitempty"`
}

// TranscriptionCreate is a generated model.
type TranscriptionCreate struct {
	SourceID       string  `json:"sourceId"`
	SourceType     string  `json:"sourceType"`
	Language       *string `json:"language,omitempty"`
	SpeakerLabels  *bool   `json:"speakerLabels,omitempty"`
	WordTimestamps *bool   `json:"wordTimestamps,omitempty"`
	Punctuation    *bool   `json:"punctuation,omitempty"`
	Model          *string `json:"model,omitempty"`
}

// SentimentAnalysis is a generated model.
type SentimentAnalysis struct {
	ID               *string    `json:"id,omitempty"`
	SourceID         *string    `json:"sourceId,omitempty"`
	SourceType       *string    `json:"sourceType,omitempty"`
	Status           *JobStatus `json:"status,omitempty"`
	OverallSentiment *string    `json:"overallSentiment,omitempty"`
	OverallScore     *float64   `json:"overallScore,omitempty"`
	Confidence       *float64   `json:"confidence,omitempty"`
	Summary          *string    `json:"summary,omitempty"`
	OrganizationID   *string    `json:"organizationId,omitempty"`
	CreatedAt        *string    `json:"createdAt,omitempty"`
	UpdatedAt        *string    `json:"updatedAt,omitempty"`
}

// SentimentAnalysisCreate is a generated model.
type SentimentAnalysisCreate struct {
	SourceID        string  `json:"sourceId"`
	SourceType      string  `json:"sourceType"`
	Text            *string `json:"text,omitempty"`
	IncludeEmotions *bool   `json:"includeEmotions,omitempty"`
	IncludeTopics   *bool   `json:"includeTopics,omitempty"`
	IncludeSummary  *bool   `json:"includeSummary,omitempty"`
	SegmentAnalysis *bool   `json:"segmentAnalysis,omitempty"`
}

// EmotionBreakdown is a generated model.
type EmotionBreakdown struct {
	Joy          *float64 `json:"joy,omitempty"`
	Sadness      *float64 `json:"sadness,omitempty"`
	Anger        *float64 `json:"anger,omitempty"`
	Fear         *float64 `json:"fear,omitempty"`
	Surprise     *float64 `json:"surprise,omitempty"`
	Disgust      *float64 `json:"disgust,omitempty"`
	Trust        *float64 `json:"trust,omitempty"`
	Anticipation *float64 `json:"anticipation,omitempty"`
}

// TopicSentiment is a generated model.
type TopicSentiment struct {
	Topic     *string  `json:"topic,omitempty"`
	Sentiment *string  `json:"sentiment,omitempty"`
	Score     *float64 `json:"score,omitempty"`
	Mentions  *int64   `json:"mentions,omitempty"`
	Keywords  []string `json:"keywords,omitempty"`
}

// SearchResult is a generated model.
type SearchResult struct {
	ID           *string           `json:"id,omitempty"`
	Type         *string           `json:"type,omitempty"`
	Title        *string           `json:"title,omitempty"`
	Description  *string           `json:"description,omitempty"`
	ThumbnailURL *string           `json:"thumbnailUrl,omitempty"`
	URL          *string           `json:"url,omitempty"`
	Score        *float64          `json:"score,omitempty"`
	Highlights   []SearchHighlight `json:"highlights,omitempty"`
	Metadata     map[string]any    `json:"metadata,omitempty"`
	CreatedAt    *string           `json:"createdAt,omitempty"`
}

// SearchHighlight is a generated model.
type SearchHighlight struct {
	Field     *string `json:"field,omitempty"`
	Snippet   *string `json:"snippet,omitempty"`
	Positions []any   `json:"positions,omitempty"`
}

// SearchRequest is a generated model.
type SearchRequest struct {
	Query          string         `json:"query"`
	Types          []string       `json:"types,omitempty"`
	Filters        map[string]any `json:"filters,omitempty"`
	Sort           map[string]any `json:"sort,omitempty"`
	Highlight      *bool          `json:"highlight,omitempty"`
	Fuzzy          *bool          `json:"fuzzy,omitempty"`
	SemanticSearch *bool          `json:"semanticSearch,omitempty"`
	Page           *int64         `json:"page,omitempty"`
	PerPage        *int64         `json:"perPage,omitempty"`
}

// SearchSuggestion is a generated model.
type SearchSuggestion struct {
	Text  *string  `json:"text,omitempty"`
	Type  *string  `json:"type,omitempty"`
	Score *float64 `json:"score,omitempty"`
}

// SearchFacet is a generated model.
type SearchFacet struct {
	Field  *string `json:"field,omitempty"`
	Values []any   `json:"values,omitempty"`
}
