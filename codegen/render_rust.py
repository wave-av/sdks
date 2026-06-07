"""Render the Rust SDK (sdk-rust/) from the IR.

Layout: a Cargo workspace with two crates, mirroring the fleet's layering:
  wave-core  — Error, Page<T>, Pagination, all models, and the HTTP transport
  wave       — umbrella: re-exports core + a module per product + a Client that
               exposes typed product accessors (client.clips().get(...)).
HTTP via ureq (blocking, light dep tree) + serde/serde_json. Publish order:
wave-core then wave (crates.io requires deps published first).
"""

from __future__ import annotations

import os

from render_common import camel_to_snake, model_schemas, pascal

CORE_VER = "0.1.0"


def _model_names(ir: dict) -> set[str]:
    return {s["name"] for s in model_schemas(ir)}


def _rs_scalar(t: str) -> str:
    return {"string": "String", "integer": "i64", "number": "f64", "boolean": "bool"}.get(t, "serde_json::Value")


def _rs_type(desc: dict, required: bool, models: set[str], qual: str = "models::") -> str:
    """qual is the module path prefix for named refs ('models::' from the umbrella,
    '' from inside models.rs where the types are siblings)."""
    t = desc["t"]
    if t == "array":
        inner = _rs_type(desc["item"], True, models, qual)
        base = f"Vec<{inner}>"
    elif t == "map":
        base = "serde_json::Value"
    elif t == "ref":
        ref = desc["ref"]
        base = f"{qual}{ref}" if ref in models else "serde_json::Value"
    else:
        base = _rs_scalar(t)
    return f"Option<{base}>" if not required else base


def render(ir: dict, root: str) -> list[str]:
    models = _model_names(ir)
    written = []
    os.makedirs(os.path.join(root, "wave-core", "src"), exist_ok=True)
    os.makedirs(os.path.join(root, "wave", "src"), exist_ok=True)

    def w(path: str, content: str):
        full = os.path.join(root, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write(content)
        written.append(full)

    w("Cargo.toml", _workspace_toml())
    w("wave-core/Cargo.toml", _core_toml())
    w("wave-core/src/lib.rs", _core_lib(ir))
    w("wave-core/src/error.rs", _core_error())
    w("wave-core/src/pagination.rs", _core_pagination())
    w("wave-core/src/client.rs", _core_client(ir))
    w("wave-core/src/models.rs", _core_models(ir, models))

    w("wave/Cargo.toml", _umbrella_toml())
    w("wave/src/lib.rs", _umbrella_lib(ir))
    for prod in ir["products"]:
        w(f"wave/src/{prod['snake']}.rs", _umbrella_product(prod, models))
    return written


def _workspace_toml() -> str:
    # wave-x402 is a hand-written crate (EIP-3009 "exact" signing via alloy) — NOT codegen output — so
    # it is listed here to keep it in the workspace across a regen; its Cargo.toml/src are never rewritten.
    return (
        "[workspace]\n"
        'members = ["wave-core", "wave", "wave-x402"]\n'
        'resolver = "2"\n'
    )


def _core_toml() -> str:
    return f'''[package]
name = "wave-core"
version = "{CORE_VER}"
edition = "2021"
description = "Core HTTP client, error types, and models for the WAVE API SDK."
license = "MIT"
repository = "https://github.com/wave-av/sdks"
homepage = "https://wave.online"
rust-version = "1.74"

[dependencies]
serde = {{ version = "1", features = ["derive"] }}
serde_json = "1"
ureq = {{ version = "2", features = ["json"] }}
'''


def _umbrella_toml() -> str:
    return f'''[package]
name = "wave-sdk"
version = "{CORE_VER}"
edition = "2021"
description = "Official WAVE API SDK for Rust (generated from the gateway OpenAPI contract)."
license = "MIT"
repository = "https://github.com/wave-av/sdks"
homepage = "https://wave.online"
rust-version = "1.74"

[dependencies]
wave-core = {{ version = "{CORE_VER}", path = "../wave-core" }}
serde = {{ version = "1", features = ["derive"] }}
serde_json = "1"
'''


def _core_lib(ir: dict) -> str:
    return f'''//! Core types + HTTP transport for the WAVE API SDK.
//!
//! Generated from codegen/openapi.yaml; gateway base URL {ir["base_url"]}.
//! Most users depend on the umbrella `wave` crate, not this one directly.

mod client;
mod error;
mod pagination;
pub mod models;

pub use client::{{Client, ClientBuilder}};
pub use error::Error;
pub use pagination::{{Page, Pagination}};

/// Gateway base URL.
pub const DEFAULT_BASE_URL: &str = "{ir["base_url"]}";
/// SDK version (also sent as the User-Agent).
pub const VERSION: &str = "{ir["version"]}";
'''


def _core_error() -> str:
    return '''use std::fmt;

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
'''


def _core_pagination() -> str:
    return '''use serde::{Deserialize, Serialize};

/// Pagination block returned alongside list responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    #[serde(default)]
    pub page: i64,
    #[serde(rename = "perPage", default)]
    pub per_page: i64,
    #[serde(default)]
    pub total: i64,
    #[serde(rename = "totalPages", default)]
    pub total_pages: i64,
}

/// Standard paginated envelope: `{ "data": [...], "pagination": {...} }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page<T> {
    pub data: Vec<T>,
    #[serde(default = "default_pagination")]
    pub pagination: Pagination,
}

fn default_pagination() -> Pagination {
    Pagination { page: 0, per_page: 0, total: 0, total_pages: 0 }
}
'''


def _core_client(ir: dict) -> str:
    return f'''use std::thread::sleep;
use std::time::{{Duration, SystemTime, UNIX_EPOCH}};

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::{{is_retryable, Error}};
use crate::{{DEFAULT_BASE_URL, VERSION}};

/// HTTP transport for the WAVE gateway. The umbrella `wave` crate wraps this
/// with typed product accessors; you normally do not call it directly.
#[derive(Clone)]
pub struct Client {{
    base_url: String,
    api_key: String,
    max_retries: u32,
    agent: ureq::Agent,
}}

/// Builder for [`Client`].
pub struct ClientBuilder {{
    base_url: String,
    api_key: String,
    max_retries: u32,
    timeout: Duration,
}}

impl ClientBuilder {{
    pub fn base_url(mut self, url: impl Into<String>) -> Self {{
        self.base_url = url.into().trim_end_matches('/').to_string();
        self
    }}
    pub fn max_retries(mut self, n: u32) -> Self {{
        self.max_retries = n;
        self
    }}
    pub fn timeout(mut self, d: Duration) -> Self {{
        self.timeout = d;
        self
    }}
    pub fn build(self) -> Result<Client, Error> {{
        if self.api_key.is_empty() {{
            return Err(Error::Api {{
                message: "api_key is required".into(),
                code: "CONFIG_ERROR".into(),
                status_code: 0,
                request_id: None,
                details: None,
                retryable: false,
            }});
        }}
        let agent = ureq::AgentBuilder::new().timeout(self.timeout).build();
        Ok(Client {{
            base_url: self.base_url,
            api_key: self.api_key,
            max_retries: self.max_retries,
            agent,
        }})
    }}
}}

impl Client {{
    /// Create a client with the given API key (panics never; validates in build()).
    pub fn new(api_key: impl Into<String>) -> Result<Self, Error> {{
        Self::builder(api_key).build()
    }}

    pub fn builder(api_key: impl Into<String>) -> ClientBuilder {{
        ClientBuilder {{
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key: api_key.into(),
            max_retries: 3,
            timeout: Duration::from_secs(30),
        }}
    }}

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
    {{
        let value = self.request_value(method, path, query, body)?;
        serde_json::from_value(value).map_err(|e| Error::Serialization(e.to_string()))
    }}

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
    {{
        self.request_value(method, path, query, body).map(|_| ())
    }}

    fn request_value<B: Serialize>(
        &self,
        method: &str,
        path: &str,
        query: &[(String, String)],
        body: Option<&B>,
    ) -> Result<serde_json::Value, Error> {{
        let url = format!("{{}}{{}}", self.base_url, path);
        let ua = format!("wave-sdk-rust/{{VERSION}}");
        let mut attempt: u32 = 0;
        loop {{
            let mut req = self
                .agent
                .request(method, &url)
                .set("Authorization", &format!("Bearer {{}}", self.api_key))
                .set("Accept", "application/json")
                .set("User-Agent", &ua);
            for (k, v) in query {{
                req = req.query(k, v);
            }}

            let result = match body {{
                Some(b) => {{
                    let json = serde_json::to_value(b)
                        .map_err(|e| Error::Serialization(e.to_string()))?;
                    req.send_json(json)
                }}
                None => req.call(),
            }};

            match result {{
                Ok(resp) => {{
                    if resp.status() == 204 {{
                        return Ok(serde_json::Value::Null);
                    }}
                    return resp
                        .into_json::<serde_json::Value>()
                        .or(Ok(serde_json::Value::Null));
                }}
                Err(ureq::Error::Status(code, resp)) => {{
                    let request_id = resp.header("x-request-id").map(|s| s.to_string());
                    if code == 429 {{
                        let retry_after = resp
                            .header("Retry-After")
                            .and_then(|s| s.parse::<f64>().ok())
                            .unwrap_or(1.0);
                        if attempt < self.max_retries {{
                            sleep(Duration::from_secs_f64(retry_after));
                            attempt += 1;
                            continue;
                        }}
                        return Err(Error::RateLimit {{
                            message: "rate limit exceeded".into(),
                            code: "RATE_LIMITED".into(),
                            status_code: 429,
                            request_id,
                            retry_after,
                        }});
                    }}
                    let err = parse_api_error(code, resp, request_id);
                    if err.is_retryable() && attempt < self.max_retries {{
                        sleep(backoff(attempt));
                        attempt += 1;
                        continue;
                    }}
                    return Err(err);
                }}
                Err(ureq::Error::Transport(t)) => {{
                    if attempt < self.max_retries {{
                        sleep(backoff(attempt));
                        attempt += 1;
                        continue;
                    }}
                    return Err(Error::Network(t.to_string()));
                }}
            }}
        }}
    }}
}}

fn parse_api_error(code: u16, resp: ureq::Response, request_id: Option<String>) -> Error {{
    let body: serde_json::Value = resp.into_json().unwrap_or(serde_json::Value::Null);
    let err = body.get("error");
    let message = err
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("HTTP {{code}}"));
    let ecode = err
        .and_then(|e| e.get("code"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("HTTP_{{code}}"));
    let details = err.and_then(|e| e.get("details")).cloned();
    Error::Api {{
        message,
        retryable: is_retryable(code, &ecode),
        code: ecode,
        status_code: code,
        request_id,
        details,
    }}
}}

fn backoff(attempt: u32) -> Duration {{
    let base = 2f64.powi(attempt as i32).min(30.0);
    // jitter without a `rand` dependency: derive from the wall clock.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let jitter = (nanos as f64 / 1_000_000_000.0) * base * 0.25;
    Duration::from_secs_f64(base + jitter)
}}
'''


def _core_models(ir: dict, models: set[str]) -> str:
    out = [
        "//! Generated request/response models. Do not edit by hand.",
        "#![allow(clippy::all)]",
        "use serde::{Deserialize, Serialize};",
        "",
    ]
    for s in ir["schemas"]:
        if s["name"] not in models:
            continue
        if s["kind"] == "enum":
            out.append("/// String enum.")
            out.append("#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]")
            out.append(f"pub enum {s['name']} {{")
            for v in s["values"]:
                out.append(f'    #[serde(rename = "{v}")]')
                out.append(f"    {pascal(v)},")
            out.append("    /// Forward-compatible catch-all for values added after this SDK build.")
            out.append("    #[serde(other)]")
            out.append("    Unknown,")
            out.append("}")
            out.append("")
        elif s["kind"] == "object":
            out.append("#[derive(Debug, Clone, Serialize, Deserialize)]")
            out.append(f"pub struct {s['name']} {{")
            for fld in s["fields"]:
                snake = camel_to_snake(fld["name"])
                rt = _rs_type(fld, fld["required"], models, qual="")  # sibling types in models.rs
                attrs = []
                # `r#type` (de)serializes as "type", so only rename when the wire
                # name differs from the bare snake_case identifier.
                if snake != fld["name"]:
                    attrs.append(f'rename = "{fld["name"]}"')
                if not fld["required"]:
                    attrs.append('skip_serializing_if = "Option::is_none"')
                    attrs.append("default")
                if attrs:
                    out.append(f"    #[serde({', '.join(attrs)})]")
                out.append(f"    pub {_rs_ident(snake)}: {rt},")
            out.append("}")
            out.append("")
        else:
            out.append(f"/// Free-form object.")
            out.append(f"pub type {s['name']} = serde_json::Value;")
            out.append("")
    return "\n".join(out)


_RUST_KEYWORDS = {
    "type", "ref", "match", "move", "self", "fn", "mod", "use", "as", "in", "where",
    "async", "await", "dyn", "impl", "trait", "struct", "enum", "let", "loop", "if",
    "else", "for", "while", "return", "break", "continue", "pub", "crate", "super",
    "box", "const", "static", "true", "false", "fn",
}


def _rs_ident(snake: str) -> str:
    """Rust raw-identifier escape. serde (de)serializes `r#type` as `type`, so no
    rename attribute is needed for keyword fields."""
    return f"r#{snake}" if snake in _RUST_KEYWORDS else snake


def _umbrella_lib(ir: dict) -> str:
    mods = "\n".join(f"pub mod {p['snake']};" for p in ir["products"])
    accessors = "\n".join(
        f"    /// Access the {p['tag']} product.\n"
        f"    pub fn {p['snake']}(&self) -> {p['snake']}::{p['ident']}<'_> {{ {p['snake']}::{p['ident']} {{ http: &self.http }} }}"
        for p in ir["products"]
    )
    return f'''//! Official WAVE API SDK for Rust.
//!
//! Generated from the gateway OpenAPI contract. Construct a [`Client`] and reach
//! products through typed accessors:
//!
//! ```no_run
//! let client = wave_sdk::Client::new("wave_live_...")?;
//! let clip = client.clips().get("clip_123")?;
//! # Ok::<(), wave_sdk::Error>(())
//! ```

pub use wave_core::{{models, Error, Page, Pagination, DEFAULT_BASE_URL, VERSION}};
use wave_core::Client as Http;

{mods}

/// The WAVE client. Cheap to clone (shares the underlying HTTP agent).
#[derive(Clone)]
pub struct Client {{
    http: Http,
}}

impl Client {{
    /// Create a client with the given API key.
    pub fn new(api_key: impl Into<String>) -> Result<Self, Error> {{
        Ok(Self {{ http: Http::new(api_key)? }})
    }}

    /// Builder for advanced configuration (base URL, retries, timeout).
    pub fn builder(api_key: impl Into<String>) -> wave_core::ClientBuilder {{
        Http::builder(api_key)
    }}

    /// Build from a pre-configured core client.
    pub fn from_http(http: Http) -> Self {{
        Self {{ http }}
    }}

{accessors}
}}
'''


def _umbrella_product(prod: dict, models: set[str]) -> str:
    ident = prod["ident"]
    has_paginated = any(o["response_kind"] == "paginated" for o in prod["operations"])
    uses_models = any(
        (o["body_type"] and o["body_type"] in models)
        or o["response_kind"] in ("single", "paginated")
        for o in prod["operations"]
    )
    imports = ["Client", "Error"]
    if uses_models:
        imports.insert(0, "models")
    if has_paginated:
        imports.append("Page")
    lines = [
        f"//! {prod['tag']} — {prod['description']}",
        "#![allow(clippy::all)]",
        "use wave_core::{" + ", ".join(imports) + "};",
        "",
        f"/// Service handle for the {prod['tag']} product.",
        f"pub struct {ident}<'a> {{",
        "    pub(crate) http: &'a Client,",
        "}",
        "",
    ]
    # param structs — OPTIONAL query params only (required ones are positional
    # method args, enforced at compile time).
    for op in prod["operations"]:
        opt = [q for q in op["query_params"] if not q["required"]]
        if opt:
            pname = f"{ident}{pascal(op['verb'])}Params"
            lines.append("#[derive(Debug, Clone, Default)]")
            lines.append(f"pub struct {pname} {{")
            for q in opt:
                snake = camel_to_snake(q["name"])
                ty = {"integer": "i64", "number": "f64", "boolean": "bool"}.get(q["type"], "String")
                lines.append(f"    pub {_rs_ident(snake)}: Option<{ty}>,")
            lines.append("}")
            lines.append("")

    lines.append(f"impl<'a> {ident}<'a> {{")
    for op in prod["operations"]:
        method = _rs_ident(camel_to_snake(op["verb"]))
        req_q = [q for q in op["query_params"] if q["required"]]
        opt_q = [q for q in op["query_params"] if not q["required"]]
        # args: &self, path params, required query (positional), body, optional params
        args = ["&self"]
        for pp in op["path_params"]:
            args.append(f"{_rs_ident(camel_to_snake(pp['name']))}: &str")
        req_arg_types = {"integer": "i64", "number": "f64", "boolean": "bool"}
        for q in req_q:
            ty = req_arg_types.get(q["type"], "&str")
            args.append(f"{_rs_ident(camel_to_snake(q['name']))}: {ty}")
        if op["has_body"]:
            bt = op["body_type"]
            btype = f"&models::{bt}" if bt and bt in models else "&serde_json::Value"
            args.append(f"body: {btype}")
        pname = ""
        if opt_q:
            pname = f"{ident}{pascal(op['verb'])}Params"
            args.append(f"params: &{pname}")
        argstr = ", ".join(args)

        rk = op["response_kind"]
        if rk == "single":
            ret = f"models::{op['response_type']}"
        elif rk == "paginated":
            ret = f"Page<models::{op['response_type']}>"
        elif rk == "raw":
            ret = "serde_json::Value"
        else:
            ret = "()"

        lines.append(f"    /// {op['summary']} (operationId: {op['operation_id']}, {op['http_method']} {op['path']}).")
        lines.append(f"    pub fn {method}({argstr}) -> Result<{ret}, Error> {{")
        # path
        path = op["path"]
        if op["path_params"]:
            expr = f'"{path}".to_string()'
            for pp in op["path_params"]:
                an = camel_to_snake(pp["name"])
                expr = f'{expr}.replace("{{{pp["name"]}}}", {an})'
            lines.append(f"        let path = {expr};")
            pvar = "&path"
        else:
            pvar = f'"{path}"'
        # query: required positional args + optional params struct
        if op["query_params"]:
            lines.append("        let mut query: Vec<(String, String)> = Vec::new();")
            for q in req_q:
                fid = _rs_ident(camel_to_snake(q["name"]))
                lines.append(f'        query.push(("{q["name"]}".to_string(), {fid}.to_string()));')
            for q in opt_q:
                fid = _rs_ident(camel_to_snake(q["name"]))
                lines.append(f"        if let Some(v) = &params.{fid} {{")
                lines.append(f'            query.push(("{q["name"]}".to_string(), v.to_string()));')
                lines.append("        }")
            qvar = "&query"
        else:
            qvar = "&[]"
        bexpr = "Some(body)" if op["has_body"] else "None::<&serde_json::Value>"
        if rk == "none":
            lines.append(f'        self.http.request_no_content("{op["http_method"]}", {pvar}, {qvar}, {bexpr})')
        else:
            lines.append(f'        self.http.request("{op["http_method"]}", {pvar}, {qvar}, {bexpr})')
        lines.append("    }")
        lines.append("")
    lines.append("}")
    return "\n".join(lines)
