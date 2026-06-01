//! Core types + HTTP transport for the WAVE API SDK.
//!
//! Generated from codegen/openapi.yaml; gateway base URL https://api.wave.online/v1.
//! Most users depend on the umbrella `wave` crate, not this one directly.

mod client;
mod error;
mod pagination;
pub mod models;

pub use client::{Client, ClientBuilder};
pub use error::Error;
pub use pagination::{Page, Pagination};

/// Gateway base URL.
pub const DEFAULT_BASE_URL: &str = "https://api.wave.online/v1";
/// SDK version (also sent as the User-Agent).
pub const VERSION: &str = "0.1.0";
