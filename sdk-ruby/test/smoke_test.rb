# frozen_string_literal: true

# Offline smoke tests. A single-shot TCPServer mock stands in for the gateway
# (no network, stdlib only).

require "minitest/autorun"
require "socket"
require_relative "../lib/wave"

def serve_once(status, headers, body)
  server = TCPServer.new("127.0.0.1", 0)
  port = server.addr[1]
  Thread.new do
    client = server.accept
    begin
      client.readpartial(8192)
    rescue StandardError
      nil
    end
    resp = "HTTP/1.1 #{status}\r\n#{headers}Content-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}"
    client.write(resp)
    client.close
    server.close
  end
  port
end

class SmokeTest < Minitest::Test
  def client(port)
    Wave::Client.new("wave_test_abc", base_url: "http://127.0.0.1:#{port}", max_retries: 0)
  end

  def test_requires_api_key
    assert_raises(ArgumentError) { Wave::Client.new("") }
    assert_raises(ArgumentError) { Wave::Client.new(nil) }
  end

  def test_get_parses
    port = serve_once("200 OK", "Content-Type: application/json\r\n", '{"id":"clip_x","title":"demo"}')
    clip = client(port).clips.get("clip_x")
    assert_equal "clip_x", clip["id"]
    assert_equal "demo", clip["title"]
  end

  def test_list_pagination_and_query
    port = serve_once("200 OK", "Content-Type: application/json\r\n",
                      '{"data":[{"id":"a"},{"id":"b"}],"pagination":{"page":2,"perPage":20,"total":2,"totalPages":1}}')
    page = client(port).clips.list(page: 2)
    assert_equal 2, page["data"].length
    assert_equal 2, page["pagination"]["page"]
  end

  def test_nested_error_envelope
    port = serve_once("403 Forbidden",
                      "Content-Type: application/json\r\nx-request-id: req_42\r\n",
                      '{"error":{"code":"ENTITLEMENT_SCOPE","message":"scope clips not entitled"}}')
    err = assert_raises(Wave::Error) { client(port).clips.get("x") }
    assert_equal "ENTITLEMENT_SCOPE", err.code
    assert_equal 403, err.status_code
    assert_equal "req_42", err.request_id
    refute err.retryable
  end

  def test_delete_no_body
    port = serve_once("204 No Content", "", "")
    assert_nil client(port).clips.delete("x")
  end
end
