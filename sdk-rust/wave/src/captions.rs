//! Captions — Auto-captioning and multi-language translation
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Captions product.
pub struct Captions<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct CaptionsListParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub video_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CaptionsDownloadParams {
    pub format: Option<String>,
}

impl<'a> Captions<'a> {
    /// List caption jobs (operationId: listCaptions, GET /captions).
    pub fn list(&self, params: &CaptionsListParams) -> Result<Page<models::CaptionJob>, Error> {
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
        self.http
            .request("GET", "/captions", &query, None::<&serde_json::Value>)
    }

    /// Create a caption job (operationId: createCaptionJob, POST /captions).
    pub fn create_job(&self, body: &models::CaptionJobCreate) -> Result<models::CaptionJob, Error> {
        self.http.request("POST", "/captions", &[], Some(body))
    }

    /// Get a caption job (operationId: getCaptionJob, GET /captions/{jobId}).
    pub fn get_job(&self, job_id: &str) -> Result<models::CaptionJob, Error> {
        let path = "/captions/{jobId}".to_string().replace("{jobId}", job_id);
        self.http
            .request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Delete a caption job (operationId: deleteCaptionJob, DELETE /captions/{jobId}).
    pub fn delete_job(&self, job_id: &str) -> Result<(), Error> {
        let path = "/captions/{jobId}".to_string().replace("{jobId}", job_id);
        self.http
            .request_no_content("DELETE", &path, &[], None::<&serde_json::Value>)
    }

    /// Download captions (operationId: downloadCaptions, GET /captions/{jobId}/download).
    pub fn download(
        &self,
        job_id: &str,
        language: &str,
        params: &CaptionsDownloadParams,
    ) -> Result<serde_json::Value, Error> {
        let path = "/captions/{jobId}/download"
            .to_string()
            .replace("{jobId}", job_id);
        let mut query: Vec<(String, String)> = Vec::new();
        query.push(("language".to_string(), language.to_string()));
        if let Some(v) = &params.format {
            query.push(("format".to_string(), v.to_string()));
        }
        self.http
            .request("GET", &path, &query, None::<&serde_json::Value>)
    }
}
