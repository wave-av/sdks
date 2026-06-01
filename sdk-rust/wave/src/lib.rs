//! Official WAVE API SDK for Rust.
//!
//! Generated from the gateway OpenAPI contract. Construct a [`Client`] and reach
//! products through typed accessors:
//!
//! ```no_run
//! let client = wave::Client::new("wave_live_...")?;
//! let clip = client.clips().get("clip_123")?;
//! # Ok::<(), wave::Error>(())
//! ```

use wave_core::Client as Http;
pub use wave_core::{models, Error, Page, Pagination, DEFAULT_BASE_URL, VERSION};

pub mod captions;
pub mod chapters;
pub mod clips;
pub mod collab;
pub mod editor;
pub mod phone;
pub mod podcast;
pub mod search;
pub mod sentiment;
pub mod studio_ai;
pub mod transcribe;
pub mod voice;

/// The WAVE client. Cheap to clone (shares the underlying HTTP agent).
#[derive(Clone)]
pub struct Client {
    http: Http,
}

impl Client {
    /// Create a client with the given API key.
    pub fn new(api_key: impl Into<String>) -> Result<Self, Error> {
        Ok(Self {
            http: Http::new(api_key)?,
        })
    }

    /// Builder for advanced configuration (base URL, retries, timeout).
    pub fn builder(api_key: impl Into<String>) -> wave_core::ClientBuilder {
        Http::builder(api_key)
    }

    /// Build from a pre-configured core client.
    pub fn from_http(http: Http) -> Self {
        Self { http }
    }

    /// Access the Clips product.
    pub fn clips(&self) -> clips::Clips<'_> {
        clips::Clips { http: &self.http }
    }
    /// Access the Voice product.
    pub fn voice(&self) -> voice::Voice<'_> {
        voice::Voice { http: &self.http }
    }
    /// Access the Captions product.
    pub fn captions(&self) -> captions::Captions<'_> {
        captions::Captions { http: &self.http }
    }
    /// Access the Chapters product.
    pub fn chapters(&self) -> chapters::Chapters<'_> {
        chapters::Chapters { http: &self.http }
    }
    /// Access the Editor product.
    pub fn editor(&self) -> editor::Editor<'_> {
        editor::Editor { http: &self.http }
    }
    /// Access the Phone product.
    pub fn phone(&self) -> phone::Phone<'_> {
        phone::Phone { http: &self.http }
    }
    /// Access the Collab product.
    pub fn collab(&self) -> collab::Collab<'_> {
        collab::Collab { http: &self.http }
    }
    /// Access the Podcast product.
    pub fn podcast(&self) -> podcast::Podcast<'_> {
        podcast::Podcast { http: &self.http }
    }
    /// Access the Studio AI product.
    pub fn studio_ai(&self) -> studio_ai::StudioAi<'_> {
        studio_ai::StudioAi { http: &self.http }
    }
    /// Access the Transcribe product.
    pub fn transcribe(&self) -> transcribe::Transcribe<'_> {
        transcribe::Transcribe { http: &self.http }
    }
    /// Access the Sentiment product.
    pub fn sentiment(&self) -> sentiment::Sentiment<'_> {
        sentiment::Sentiment { http: &self.http }
    }
    /// Access the Search product.
    pub fn search(&self) -> search::Search<'_> {
        search::Search { http: &self.http }
    }
}
