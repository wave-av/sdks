//! Clips — AI-powered highlight detection and clip management
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Clips product.
pub struct Clips<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct ClipsListParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub video_id: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
}

impl<'a> Clips<'a> {
    /// List clips (operationId: listClips, GET /clips).
    pub fn list(&self, params: &ClipsListParams) -> Result<Page<models::Clip>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        if let Some(v) = &params.video_id {
            query.push(("videoId".to_string(), v.to_string()));
        }
        if let Some(v) = &params.status {
            query.push(("status".to_string(), v.to_string()));
        }
        if let Some(v) = &params.category {
            query.push(("category".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/clips", &query, None::<&serde_json::Value>)
    }

    /// Create a clip (operationId: createClip, POST /clips).
    pub fn create(&self, body: &models::ClipCreate) -> Result<models::Clip, Error> {
        self.http.request("POST", "/clips", &[], Some(body))
    }

    /// Get a clip (operationId: getClip, GET /clips/{clipId}).
    pub fn get(&self, clip_id: &str) -> Result<models::Clip, Error> {
        let path = "/clips/{clipId}".to_string().replace("{clipId}", clip_id);
        self.http
            .request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Update a clip (operationId: updateClip, PATCH /clips/{clipId}).
    pub fn update(&self, clip_id: &str, body: &models::ClipUpdate) -> Result<models::Clip, Error> {
        let path = "/clips/{clipId}".to_string().replace("{clipId}", clip_id);
        self.http.request("PATCH", &path, &[], Some(body))
    }

    /// Delete a clip (operationId: deleteClip, DELETE /clips/{clipId}).
    pub fn delete(&self, clip_id: &str) -> Result<(), Error> {
        let path = "/clips/{clipId}".to_string().replace("{clipId}", clip_id);
        self.http
            .request_no_content("DELETE", &path, &[], None::<&serde_json::Value>)
    }

    /// Start AI clip detection (operationId: detectClips, POST /clips/detect).
    pub fn detect(&self, body: &models::ClipDetectRequest) -> Result<models::DetectionJob, Error> {
        self.http.request("POST", "/clips/detect", &[], Some(body))
    }
}
