//! Sentiment — Sentiment and emotion analysis
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Sentiment product.
pub struct Sentiment<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct SentimentListAnalysesParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

impl<'a> Sentiment<'a> {
    /// List sentiment analyses (operationId: listSentimentAnalyses, GET /sentiment).
    pub fn list_analyses(&self, params: &SentimentListAnalysesParams) -> Result<Page<models::SentimentAnalysis>, Error> {
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
        self.http.request("GET", "/sentiment", &query, None::<&serde_json::Value>)
    }

    /// Create a sentiment analysis (operationId: createSentimentAnalysis, POST /sentiment).
    pub fn create_analysis(&self, body: &models::SentimentAnalysisCreate) -> Result<models::SentimentAnalysis, Error> {
        self.http.request("POST", "/sentiment", &[], Some(body))
    }

    /// Analyze text directly (operationId: analyzeText, POST /sentiment/analyze).
    pub fn analyze_text(&self, body: &serde_json::Value) -> Result<serde_json::Value, Error> {
        self.http.request("POST", "/sentiment/analyze", &[], Some(body))
    }

}