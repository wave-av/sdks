//! Podcast — Podcast show and episode management
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Podcast product.
pub struct Podcast<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct PodcastListShowsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Default)]
pub struct PodcastListEpisodesParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl<'a> Podcast<'a> {
    /// List podcast shows (operationId: listPodcastShows, GET /podcast/shows).
    pub fn list_shows(
        &self,
        params: &PodcastListShowsParams,
    ) -> Result<Page<models::PodcastShow>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/podcast/shows", &query, None::<&serde_json::Value>)
    }

    /// Create a podcast show (operationId: createPodcastShow, POST /podcast/shows).
    pub fn create_show(
        &self,
        body: &models::PodcastShowCreate,
    ) -> Result<models::PodcastShow, Error> {
        self.http.request("POST", "/podcast/shows", &[], Some(body))
    }

    /// List episodes for a show (operationId: listPodcastEpisodes, GET /podcast/shows/{showId}/episodes).
    pub fn list_episodes(
        &self,
        show_id: &str,
        params: &PodcastListEpisodesParams,
    ) -> Result<Page<models::PodcastEpisode>, Error> {
        let path = "/podcast/shows/{showId}/episodes"
            .to_string()
            .replace("{showId}", show_id);
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        self.http
            .request("GET", &path, &query, None::<&serde_json::Value>)
    }

    /// Create an episode (operationId: createPodcastEpisode, POST /podcast/shows/{showId}/episodes).
    pub fn create_episode(
        &self,
        show_id: &str,
        body: &models::PodcastEpisodeCreate,
    ) -> Result<models::PodcastEpisode, Error> {
        let path = "/podcast/shows/{showId}/episodes"
            .to_string()
            .replace("{showId}", show_id);
        self.http.request("POST", &path, &[], Some(body))
    }
}
