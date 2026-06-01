//! Generated request/response models. Do not edit by hand.
#![allow(clippy::all)]
use serde::{Deserialize, Serialize};

/// String enum.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum JobStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "processing")]
    Processing,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "cancelled")]
    Cancelled,
    /// Forward-compatible catch-all for values added after this SDK build.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clip {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "videoId", skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
    #[serde(rename = "startTime", skip_serializing_if = "Option::is_none", default)]
    pub start_time: Option<f64>,
    #[serde(rename = "endTime", skip_serializing_if = "Option::is_none", default)]
    pub end_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
    #[serde(
        rename = "thumbnailUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub thumbnail_url: Option<String>,
    #[serde(
        rename = "previewUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub preview_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipCreate {
    #[serde(rename = "videoId")]
    pub video_id: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipUpdate {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "startTime", skip_serializing_if = "Option::is_none", default)]
    pub start_time: Option<f64>,
    #[serde(rename = "endTime", skip_serializing_if = "Option::is_none", default)]
    pub end_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipDetectRequest {
    #[serde(rename = "videoId")]
    pub video_id: String,
    #[serde(
        rename = "minDuration",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub min_duration: Option<f64>,
    #[serde(
        rename = "maxDuration",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub max_duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub categories: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sensitivity: Option<f64>,
    #[serde(rename = "maxClips", skip_serializing_if = "Option::is_none", default)]
    pub max_clips: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionJob {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub progress: Option<i64>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voice {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(
        rename = "previewUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub preview_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub labels: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceGeneration {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "voiceId", skip_serializing_if = "Option::is_none", default)]
    pub voice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(rename = "audioUrl", skip_serializing_if = "Option::is_none", default)]
    pub audio_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(
        rename = "characterCount",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub character_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub model: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceGenerateRequest {
    #[serde(rename = "voiceId")]
    pub voice_id: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub stability: Option<f64>,
    #[serde(
        rename = "similarityBoost",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub similarity_boost: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub style: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub model: Option<String>,
    #[serde(
        rename = "outputFormat",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub output_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceCloneRequest {
    pub name: String,
    #[serde(rename = "audioFiles")]
    pub audio_files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub labels: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionJob {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "videoId", skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
    #[serde(
        rename = "sourceLanguage",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub source_language: Option<String>,
    #[serde(
        rename = "targetLanguages",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub target_languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub progress: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub outputs: Option<serde_json::Value>,
    #[serde(
        rename = "errorMessage",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub error_message: Option<String>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionJobCreate {
    #[serde(rename = "videoId")]
    pub video_id: String,
    #[serde(
        rename = "sourceLanguage",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub source_language: Option<String>,
    #[serde(
        rename = "targetLanguages",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub target_languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub style: Option<String>,
    #[serde(
        rename = "speakerLabels",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub speaker_labels: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "videoId", skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "startTime", skip_serializing_if = "Option::is_none", default)]
    pub start_time: Option<f64>,
    #[serde(rename = "endTime", skip_serializing_if = "Option::is_none", default)]
    pub end_time: Option<f64>,
    #[serde(
        rename = "thumbnailUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterCreate {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterDetectRequest {
    #[serde(
        rename = "minDuration",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub min_duration: Option<f64>,
    #[serde(
        rename = "maxChapters",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub max_chapters: Option<i64>,
    #[serde(
        rename = "includeDescriptions",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub include_descriptions: Option<bool>,
    #[serde(
        rename = "includeThumbnails",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub include_thumbnails: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorProject {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub resolution: Option<String>,
    #[serde(rename = "frameRate", skip_serializing_if = "Option::is_none", default)]
    pub frame_rate: Option<f64>,
    #[serde(
        rename = "thumbnailUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub thumbnail_url: Option<String>,
    #[serde(rename = "exportUrl", skip_serializing_if = "Option::is_none", default)]
    pub export_url: Option<String>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorProjectCreate {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub resolution: Option<String>,
    #[serde(rename = "frameRate", skip_serializing_if = "Option::is_none", default)]
    pub frame_rate: Option<f64>,
    #[serde(
        rename = "aspectRatio",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub aspect_ratio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorProjectUpdate {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub quality: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportJob {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub progress: Option<i64>,
    #[serde(rename = "outputUrl", skip_serializing_if = "Option::is_none", default)]
    pub output_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneLine {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(
        rename = "monthlyCost",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub monthly_cost: Option<f64>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneLineProvision {
    #[serde(rename = "areaCode", skip_serializing_if = "Option::is_none", default)]
    pub area_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Call {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "lineId", skip_serializing_if = "Option::is_none", default)]
    pub line_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub direction: Option<String>,
    #[serde(
        rename = "fromNumber",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub from_number: Option<String>,
    #[serde(rename = "toNumber", skip_serializing_if = "Option::is_none", default)]
    pub to_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<i64>,
    #[serde(
        rename = "recordingUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub recording_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub transcript: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallCreate {
    #[serde(rename = "fromLineId")]
    pub from_line_id: String,
    #[serde(rename = "toNumber")]
    pub to_number: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub record: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub transcribe: Option<bool>,
    #[serde(
        rename = "webhookUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub webhook_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabRoom {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<String>,
    #[serde(
        rename = "maxParticipants",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub max_participants: Option<i64>,
    #[serde(
        rename = "currentParticipants",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub current_participants: Option<i64>,
    #[serde(
        rename = "scheduledStart",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub scheduled_start: Option<String>,
    #[serde(rename = "joinUrl", skip_serializing_if = "Option::is_none", default)]
    pub join_url: Option<String>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabRoomCreate {
    pub name: String,
    pub r#type: String,
    #[serde(
        rename = "maxParticipants",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub max_participants: Option<i64>,
    #[serde(
        rename = "scheduledStart",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub scheduled_start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastShow {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "coverUrl", skip_serializing_if = "Option::is_none", default)]
    pub cover_url: Option<String>,
    #[serde(rename = "rssUrl", skip_serializing_if = "Option::is_none", default)]
    pub rss_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub explicit: Option<bool>,
    #[serde(
        rename = "episodeCount",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub episode_count: Option<i64>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastShowCreate {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub explicit: Option<bool>,
    #[serde(rename = "coverUrl", skip_serializing_if = "Option::is_none", default)]
    pub cover_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastEpisode {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "showId", skip_serializing_if = "Option::is_none", default)]
    pub show_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "audioUrl", skip_serializing_if = "Option::is_none", default)]
    pub audio_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(
        rename = "episodeNumber",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub episode_number: Option<i64>,
    #[serde(
        rename = "seasonNumber",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub season_number: Option<i64>,
    #[serde(
        rename = "publishedAt",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub published_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodcastEpisodeCreate {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "audioUrl")]
    pub audio_url: String,
    #[serde(
        rename = "episodeNumber",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub episode_number: Option<i64>,
    #[serde(
        rename = "seasonNumber",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub season_number: Option<i64>,
    #[serde(
        rename = "publishedAt",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Enhancement {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "videoId", skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub progress: Option<i64>,
    #[serde(rename = "inputUrl", skip_serializing_if = "Option::is_none", default)]
    pub input_url: Option<String>,
    #[serde(rename = "outputUrl", skip_serializing_if = "Option::is_none", default)]
    pub output_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub settings: Option<serde_json::Value>,
    #[serde(
        rename = "creditsUsed",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub credits_used: Option<i64>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementCreate {
    #[serde(rename = "videoId")]
    pub video_id: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub settings: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementPreviewRequest {
    #[serde(rename = "videoId")]
    pub video_id: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub timestamp: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcription {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "sourceId", skip_serializing_if = "Option::is_none", default)]
    pub source_id: Option<String>,
    #[serde(
        rename = "sourceType",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub source_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(rename = "wordCount", skip_serializing_if = "Option::is_none", default)]
    pub word_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub confidence: Option<f64>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionCreate {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "sourceType")]
    pub source_type: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub language: Option<String>,
    #[serde(
        rename = "speakerLabels",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub speaker_labels: Option<bool>,
    #[serde(
        rename = "wordTimestamps",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub word_timestamps: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub punctuation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "sourceId", skip_serializing_if = "Option::is_none", default)]
    pub source_id: Option<String>,
    #[serde(
        rename = "sourceType",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub source_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub status: Option<JobStatus>,
    #[serde(
        rename = "overallSentiment",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub overall_sentiment: Option<String>,
    #[serde(
        rename = "overallScore",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub overall_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub summary: Option<String>,
    #[serde(
        rename = "organizationId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub organization_id: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none", default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysisCreate {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "sourceType")]
    pub source_type: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text: Option<String>,
    #[serde(
        rename = "includeEmotions",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub include_emotions: Option<bool>,
    #[serde(
        rename = "includeTopics",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub include_topics: Option<bool>,
    #[serde(
        rename = "includeSummary",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub include_summary: Option<bool>,
    #[serde(
        rename = "segmentAnalysis",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub segment_analysis: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionBreakdown {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub joy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sadness: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub anger: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fear: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub surprise: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub disgust: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub trust: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub anticipation: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicSentiment {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub topic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sentiment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub mentions: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub keywords: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(
        rename = "thumbnailUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub highlights: Option<Vec<SearchHighlight>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHighlight {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub snippet: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub positions: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub filters: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sort: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub highlight: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fuzzy: Option<bool>,
    #[serde(
        rename = "semanticSearch",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub semantic_search: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub page: Option<i64>,
    #[serde(rename = "perPage", skip_serializing_if = "Option::is_none", default)]
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSuggestion {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacet {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub values: Option<Vec<serde_json::Value>>,
}
