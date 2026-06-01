//! Search — Semantic content search
#![allow(clippy::all)]
use wave_core::{models, Client, Error};

/// Service handle for the Search product.
pub struct Search<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct SearchQuickParams {
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default)]
pub struct SearchSuggestParams {
    pub limit: Option<i64>,
}

impl<'a> Search<'a> {
    /// Search content (operationId: search, POST /search).
    pub fn search(&self, body: &models::SearchRequest) -> Result<serde_json::Value, Error> {
        self.http.request("POST", "/search", &[], Some(body))
    }

    /// Quick search (operationId: quickSearch, GET /search/quick).
    pub fn quick(&self, q: &str, params: &SearchQuickParams) -> Result<serde_json::Value, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        query.push(("q".to_string(), q.to_string()));
        if let Some(v) = &params.limit {
            query.push(("limit".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/search/quick", &query, None::<&serde_json::Value>)
    }

    /// Get search suggestions (operationId: searchSuggest, GET /search/suggest).
    pub fn suggest(
        &self,
        q: &str,
        params: &SearchSuggestParams,
    ) -> Result<serde_json::Value, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        query.push(("q".to_string(), q.to_string()));
        if let Some(v) = &params.limit {
            query.push(("limit".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/search/suggest", &query, None::<&serde_json::Value>)
    }

    /// Semantic search (operationId: semanticSearch, POST /search/semantic).
    pub fn semantic(&self, body: &serde_json::Value) -> Result<serde_json::Value, Error> {
        self.http
            .request("POST", "/search/semantic", &[], Some(body))
    }
}
