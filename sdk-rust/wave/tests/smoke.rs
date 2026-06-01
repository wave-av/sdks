//! Offline smoke tests for the generated Rust SDK. A tiny single-shot TCP mock
//! stands in for the gateway (no network, no extra dev-deps).

use std::io::{Read, Write};
use std::net::TcpListener;
use std::thread;

/// Serve exactly one HTTP/1.1 response on an ephemeral port; return the port.
fn serve_once(status_line: &'static str, headers: &'static str, body: &'static str) -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 8192];
            let _ = stream.read(&mut buf);
            let resp = format!(
                "HTTP/1.1 {}\r\n{}Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                status_line,
                headers,
                body.len(),
                body
            );
            let _ = stream.write_all(resp.as_bytes());
        }
    });
    port
}

fn client(port: u16) -> wave::Client {
    let http = wave::Client::builder("wave_test_abc")
        .base_url(format!("http://127.0.0.1:{port}"))
        .max_retries(0)
        .build()
        .unwrap();
    wave::Client::from_http(http)
}

#[test]
fn client_requires_api_key() {
    assert!(wave::Client::new("").is_err());
    assert!(wave::Client::new("wave_test_abc").is_ok());
}

#[test]
fn get_parses_single() {
    let port = serve_once(
        "200 OK",
        "Content-Type: application/json\r\n",
        r#"{"id":"clip_x","title":"demo"}"#,
    );
    let clip = client(port).clips().get("clip_x").unwrap();
    assert_eq!(clip.id.as_deref(), Some("clip_x"));
    assert_eq!(clip.title.as_deref(), Some("demo"));
}

#[test]
fn list_parses_pagination() {
    let port = serve_once(
        "200 OK",
        "Content-Type: application/json\r\n",
        r#"{"data":[{"id":"a"},{"id":"b"}],"pagination":{"page":2,"perPage":20,"total":2,"totalPages":1}}"#,
    );
    let params = wave::clips::ClipsListParams {
        page: Some(2),
        ..Default::default()
    };
    let page = client(port).clips().list(&params).unwrap();
    assert_eq!(page.data.len(), 2);
    assert_eq!(page.pagination.page, 2);
}

#[test]
fn nested_error_envelope() {
    let port = serve_once(
        "403 Forbidden",
        "Content-Type: application/json\r\nx-request-id: req_42\r\n",
        r#"{"error":{"code":"ENTITLEMENT_SCOPE","message":"scope clips not entitled"}}"#,
    );
    let err = client(port).clips().get("x").unwrap_err();
    match err {
        wave::Error::Api {
            code,
            status_code,
            request_id,
            retryable,
            ..
        } => {
            assert_eq!(code, "ENTITLEMENT_SCOPE");
            assert_eq!(status_code, 403);
            assert_eq!(request_id.as_deref(), Some("req_42"));
            assert!(!retryable);
        }
        other => panic!("expected Error::Api, got {other:?}"),
    }
}

#[test]
fn delete_returns_unit() {
    let port = serve_once("204 No Content", "", "");
    client(port).clips().delete("x").unwrap();
}
