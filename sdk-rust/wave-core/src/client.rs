use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::{is_retryable, Error};
use crate::{DEFAULT_BASE_URL, VERSION};

/// HTTP transport for the WAVE gateway. The umbrella `wave` crate wraps this
/// with typed product accessors; you normally do not call it directly.
#[derive(Clone)]
pub struct Client {
    base_url: String,
    api_key: String,
    max_retries: u32,
    agent: ureq::Agent,
}

/// Builder for [`Client`].
pub struct ClientBuilder {
    base_url: String,
    api_key: String,
    max_retries: u32,
    timeout: Duration,
}

impl ClientBuilder {
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into().trim_end_matches('/').to_string();
        self
    }
    pub fn max_retries(mut self, n: u32) -> Self {
        self.max_retries = n;
        self
    }
    pub fn timeout(mut self, d: Duration) -> Self {
        self.timeout = d;
        self
    }
    pub fn build(self) -> Result<Client, Error> {
        if self.api_key.is_empty() {
            return Err(Error::Api {
                message: "api_key is required".into(),
                code: "CONFIG_ERROR".into(),
                status_code: 0,
                request_id: None,
                details: None,
                retryable: false,
            });
        }
        let agent = ureq::AgentBuilder::new().timeout(self.timeout).build();
        Ok(Client {
            base_url: self.base_url,
            api_key: self.api_key,
            max_retries: self.max_retries,
            agent,
        })
    }
}

impl Client {
    /// Create a client with the given API key (panics never; validates in build()).
    pub fn new(api_key: impl Into<String>) -> Result<Self, Error> {
        Self::builder(api_key).build()
    }

    pub fn builder(api_key: impl Into<String>) -> ClientBuilder {
        ClientBuilder {
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key: api_key.into(),
            max_retries: 3,
            timeout: Duration::from_secs(30),
        }
    }

    /// Perform a request and deserialize a JSON response.
    pub fn request<B, R>(
        &self,
        method: &str,
        path: &str,
        query: &[(String, String)],
        body: Option<&B>,
    ) -> Result<R, Error>
    where
        B: Serialize,
        R: DeserializeOwned,
    {
        let value = self.request_value(method, path, query, body)?;
        serde_json::from_value(value).map_err(|e| Error::Serialization(e.to_string()))
    }

    /// Perform a request that returns no body (204) — only surfaces errors.
    pub fn request_no_content<B>(
        &self,
        method: &str,
        path: &str,
        query: &[(String, String)],
        body: Option<&B>,
    ) -> Result<(), Error>
    where
        B: Serialize,
    {
        self.request_value(method, path, query, body).map(|_| ())
    }

    fn request_value<B: Serialize>(
        &self,
        method: &str,
        path: &str,
        query: &[(String, String)],
        body: Option<&B>,
    ) -> Result<serde_json::Value, Error> {
        let url = format!("{}{}", self.base_url, path);
        let ua = format!("wave-sdk-rust/{VERSION}");
        let mut attempt: u32 = 0;
        loop {
            let mut req = self
                .agent
                .request(method, &url)
                .set("Authorization", &format!("Bearer {}", self.api_key))
                .set("Accept", "application/json")
                .set("User-Agent", &ua);
            for (k, v) in query {
                req = req.query(k, v);
            }

            let result = match body {
                Some(b) => {
                    let json = serde_json::to_value(b)
                        .map_err(|e| Error::Serialization(e.to_string()))?;
                    req.send_json(json)
                }
                None => req.call(),
            };

            match result {
                Ok(resp) => {
                    if resp.status() == 204 {
                        return Ok(serde_json::Value::Null);
                    }
                    return resp
                        .into_json::<serde_json::Value>()
                        .or(Ok(serde_json::Value::Null));
                }
                Err(ureq::Error::Status(code, resp)) => {
                    let request_id = resp.header("x-request-id").map(|s| s.to_string());
                    if code == 429 {
                        let retry_after = resp
                            .header("Retry-After")
                            .and_then(|s| s.parse::<f64>().ok())
                            .unwrap_or(1.0);
                        if attempt < self.max_retries {
                            sleep(Duration::from_secs_f64(retry_after));
                            attempt += 1;
                            continue;
                        }
                        return Err(Error::RateLimit {
                            message: "rate limit exceeded".into(),
                            code: "RATE_LIMITED".into(),
                            status_code: 429,
                            request_id,
                            retry_after,
                        });
                    }
                    let err = parse_api_error(code, resp, request_id);
                    if err.is_retryable() && attempt < self.max_retries {
                        sleep(backoff(attempt));
                        attempt += 1;
                        continue;
                    }
                    return Err(err);
                }
                Err(ureq::Error::Transport(t)) => {
                    if attempt < self.max_retries {
                        sleep(backoff(attempt));
                        attempt += 1;
                        continue;
                    }
                    return Err(Error::Network(t.to_string()));
                }
            }
        }
    }
}

fn parse_api_error(code: u16, resp: ureq::Response, request_id: Option<String>) -> Error {
    let body: serde_json::Value = resp.into_json().unwrap_or(serde_json::Value::Null);
    let err = body.get("error");
    let message = err
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("HTTP {code}"));
    let ecode = err
        .and_then(|e| e.get("code"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("HTTP_{code}"));
    let details = err.and_then(|e| e.get("details")).cloned();
    Error::Api {
        message,
        retryable: is_retryable(code, &ecode),
        code: ecode,
        status_code: code,
        request_id,
        details,
    }
}

fn backoff(attempt: u32) -> Duration {
    let base = 2f64.powi(attempt as i32).min(30.0);
    // jitter without a `rand` dependency: derive from the wall clock.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let jitter = (nanos as f64 / 1_000_000_000.0) * base * 0.25;
    Duration::from_secs_f64(base + jitter)
}
