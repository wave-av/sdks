//! Studio AI — Video enhancement and AI processing
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Studio AI product.
pub struct StudioAi<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct StudioAiListEnhancementsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub r#type: Option<String>,
    pub status: Option<String>,
}

impl<'a> StudioAi<'a> {
    /// List enhancement jobs (operationId: listEnhancements, GET /studio-ai/enhancements).
    pub fn list_enhancements(&self, params: &StudioAiListEnhancementsParams) -> Result<Page<models::Enhancement>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        if let Some(v) = &params.r#type {
            query.push(("type".to_string(), v.to_string()));
        }
        if let Some(v) = &params.status {
            query.push(("status".to_string(), v.to_string()));
        }
        self.http.request("GET", "/studio-ai/enhancements", &query, None::<&serde_json::Value>)
    }

    /// Create an enhancement job (operationId: createEnhancement, POST /studio-ai/enhancements).
    pub fn create_enhancement(&self, body: &models::EnhancementCreate) -> Result<models::Enhancement, Error> {
        self.http.request("POST", "/studio-ai/enhancements", &[], Some(body))
    }

    /// Generate enhancement preview (operationId: previewEnhancement, POST /studio-ai/preview).
    pub fn preview_enhancement(&self, body: &models::EnhancementPreviewRequest) -> Result<serde_json::Value, Error> {
        self.http.request("POST", "/studio-ai/preview", &[], Some(body))
    }

}