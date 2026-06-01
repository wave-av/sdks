//! Voice — Text-to-speech synthesis and voice cloning
#![allow(clippy::all)]
use wave_core::{models, Client, Error};

/// Service handle for the Voice product.
pub struct Voice<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct VoiceListParams {
    pub category: Option<String>,
    pub language: Option<String>,
}

impl<'a> Voice<'a> {
    /// List available voices (operationId: listVoices, GET /voice/voices).
    pub fn list(&self, params: &VoiceListParams) -> Result<serde_json::Value, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.category {
            query.push(("category".to_string(), v.to_string()));
        }
        if let Some(v) = &params.language {
            query.push(("language".to_string(), v.to_string()));
        }
        self.http.request("GET", "/voice/voices", &query, None::<&serde_json::Value>)
    }

    /// Generate speech from text (operationId: generateSpeech, POST /voice/generate).
    pub fn generate_speech(&self, body: &models::VoiceGenerateRequest) -> Result<models::VoiceGeneration, Error> {
        self.http.request("POST", "/voice/generate", &[], Some(body))
    }

    /// Clone a voice from audio samples (operationId: cloneVoice, POST /voice/clone).
    pub fn clone(&self, body: &models::VoiceCloneRequest) -> Result<models::Voice, Error> {
        self.http.request("POST", "/voice/clone", &[], Some(body))
    }

}