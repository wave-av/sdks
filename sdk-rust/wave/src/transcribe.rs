//! Transcribe — Speech-to-text transcription
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Transcribe product.
pub struct Transcribe<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct TranscribeListTranscriptionsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

impl<'a> Transcribe<'a> {
    /// List transcriptions (operationId: listTranscriptions, GET /transcribe).
    pub fn list_transcriptions(&self, params: &TranscribeListTranscriptionsParams) -> Result<Page<models::Transcription>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        if let Some(v) = &params.status {
            query.push(("status".to_string(), v.to_string()));
        }
        self.http.request("GET", "/transcribe", &query, None::<&serde_json::Value>)
    }

    /// Create a transcription (operationId: createTranscription, POST /transcribe).
    pub fn create_transcription(&self, body: &models::TranscriptionCreate) -> Result<models::Transcription, Error> {
        self.http.request("POST", "/transcribe", &[], Some(body))
    }

    /// Get a transcription (operationId: getTranscription, GET /transcribe/{transcriptionId}).
    pub fn get_transcription(&self, transcription_id: &str) -> Result<models::Transcription, Error> {
        let path = "/transcribe/{transcriptionId}".to_string().replace("{transcriptionId}", transcription_id);
        self.http.request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Delete a transcription (operationId: deleteTranscription, DELETE /transcribe/{transcriptionId}).
    pub fn delete_transcription(&self, transcription_id: &str) -> Result<(), Error> {
        let path = "/transcribe/{transcriptionId}".to_string().replace("{transcriptionId}", transcription_id);
        self.http.request_no_content("DELETE", &path, &[], None::<&serde_json::Value>)
    }

}