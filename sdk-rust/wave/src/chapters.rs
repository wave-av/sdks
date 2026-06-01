//! Chapters — AI chapter detection and video segmentation
#![allow(clippy::all)]
use wave_core::{models, Client, Error};

/// Service handle for the Chapters product.
pub struct Chapters<'a> {
    pub(crate) http: &'a Client,
}

impl<'a> Chapters<'a> {
    /// List chapters for a video (operationId: listChapters, GET /videos/{videoId}/chapters).
    pub fn list(&self, video_id: &str) -> Result<serde_json::Value, Error> {
        let path = "/videos/{videoId}/chapters".to_string().replace("{videoId}", video_id);
        self.http.request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Create a chapter (operationId: createChapter, POST /videos/{videoId}/chapters).
    pub fn create(&self, video_id: &str, body: &models::ChapterCreate) -> Result<models::Chapter, Error> {
        let path = "/videos/{videoId}/chapters".to_string().replace("{videoId}", video_id);
        self.http.request("POST", &path, &[], Some(body))
    }

    /// Start AI chapter detection (operationId: detectChapters, POST /videos/{videoId}/chapters/detect).
    pub fn detect(&self, video_id: &str, body: &models::ChapterDetectRequest) -> Result<models::DetectionJob, Error> {
        let path = "/videos/{videoId}/chapters/detect".to_string().replace("{videoId}", video_id);
        self.http.request("POST", &path, &[], Some(body))
    }

}