use std::fmt;

/// All failures surfaced by the SDK. The gateway emits a nested error envelope
/// `{"error":{"code","message"}}`; `Api`/`RateLimit` are lifted from it.
#[derive(Debug, Clone)]
pub enum Error {
    /// A non-2xx, non-429 API response.
    Api {
        message: String,
        code: String,
        status_code: u16,
        request_id: Option<String>,
        details: Option<serde_json::Value>,
        retryable: bool,
    },
    /// HTTP 429 after the retry budget is exhausted.
    RateLimit {
        message: String,
        code: String,
        status_code: u16,
        request_id: Option<String>,
        retry_after: f64,
    },
    /// Transport-level failure (DNS, connection, timeout).
    Network(String),
    /// (De)serialization failure.
    Serialization(String),
}

impl Error {
    pub fn is_retryable(&self) -> bool {
        match self {
            Error::Api { retryable, .. } => *retryable,
            Error::RateLimit { .. } | Error::Network(_) => true,
            Error::Serialization(_) => false,
        }
    }
}

/// Mirrors the gateway/python retryability rule.
pub(crate) fn is_retryable(status: u16, code: &str) -> bool {
    if status == 429 || (500..600).contains(&status) {
        return true;
    }
    matches!(code, "TIMEOUT" | "NETWORK_ERROR" | "SERVICE_UNAVAILABLE")
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Api { code, message, .. } => write!(f, "wave: [{code}] {message}"),
            Error::RateLimit { code, message, retry_after, .. } => {
                write!(f, "wave: [{code}] {message} (retry after {retry_after:.0}s)")
            }
            Error::Network(m) => write!(f, "wave: network error: {m}"),
            Error::Serialization(m) => write!(f, "wave: serialization error: {m}"),
        }
    }
}

impl std::error::Error for Error {}
