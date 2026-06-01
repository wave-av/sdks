"""Render the Ruby SDK (sdk-ruby/) from the IR.

One gem `wave-sdk` (stdlib net/http only — no runtime deps). Idiomatic for a
generated Ruby client: query params are keyword args, path params positional,
request bodies a Hash, and responses are parsed JSON (Hash with string keys).
Errors raise Wave::Error / Wave::RateLimitError, matching the gateway's nested
envelope and the Python/Go/Rust cores.
"""

from __future__ import annotations

import os

from render_common import camel_to_snake

GEM_VERSION = "0.1.0"
_RUBY_RESERVED = {"end", "class", "module", "def", "do", "if", "else", "begin", "next", "return", "self", "then", "when", "case", "while", "until"}


def _rb_ident(snake: str) -> str:
    return snake + "_" if snake in _RUBY_RESERVED else snake


def render(ir: dict, root: str) -> list[str]:
    written = []

    def w(path: str, content: str):
        full = os.path.join(root, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write(content)
        written.append(full)

    w("lib/wave/version.rb", f'# frozen_string_literal: true\n\nmodule Wave\n  VERSION = "{ir["version"]}"\nend\n')
    w("lib/wave/errors.rb", _errors())
    w("lib/wave/client.rb", _client(ir))
    products_require = "\n".join(f'require_relative "wave/{p["snake"]}"' for p in ir["products"])
    w("lib/wave.rb", _entrypoint(ir, products_require))
    for prod in ir["products"]:
        w(f"lib/wave/{prod['snake']}.rb", _service(prod))
    w("wave-sdk.gemspec", _gemspec())
    w("Gemfile", "# frozen_string_literal: true\n\nsource \"https://rubygems.org\"\ngemspec\n")
    return written


def _entrypoint(ir: dict, products_require: str) -> str:
    accessors = "\n".join(
        f"    # Access the {p['tag']} product.\n"
        f"    def {p['snake']}\n      Wave::{p['ident']}.new(self)\n    end\n"
        for p in ir["products"]
    )
    return f'''# frozen_string_literal: true

require_relative "wave/version"
require_relative "wave/errors"
require_relative "wave/client"
{products_require}

# Official WAVE API SDK for Ruby. Generated from the gateway OpenAPI contract.
#
#   client = Wave::Client.new("wave_live_...")
#   clip = client.clips.get("clip_123")
module Wave
  class Client
{accessors}  end
end
'''


def _errors() -> str:
    return '''# frozen_string_literal: true

module Wave
  # Canonical WAVE API error. The gateway emits a nested envelope
  # {"error":{"code","message"}}; code/message are lifted from it.
  class Error < StandardError
    attr_reader :code, :status_code, :request_id, :details, :retryable

    def initialize(message, code:, status_code:, request_id: nil, details: nil)
      super(message)
      @code = code
      @status_code = status_code
      @request_id = request_id
      @details = details
      @retryable = self.class.retryable?(status_code, code)
    end

    def self.retryable?(status_code, code)
      return true if status_code == 429
      return true if status_code >= 500 && status_code < 600

      %w[TIMEOUT NETWORK_ERROR SERVICE_UNAVAILABLE].include?(code)
    end
  end

  # Raised on HTTP 429 once the retry budget is exhausted.
  class RateLimitError < Error
    attr_reader :retry_after

    def initialize(message, retry_after:, request_id: nil)
      super(message, code: "RATE_LIMITED", status_code: 429, request_id: request_id)
      @retry_after = retry_after
    end
  end
end
'''


def _client(ir: dict) -> str:
    return f'''# frozen_string_literal: true

require "net/http"
require "json"
require "uri"

module Wave
  # HTTP client for the WAVE gateway. Handles auth, retries, and error parsing.
  class Client
    DEFAULT_BASE_URL = "{ir["base_url"]}"
    USER_AGENT = "wave-sdk-ruby/{ir["version"]}"

    def initialize(api_key, base_url: DEFAULT_BASE_URL, max_retries: 3, timeout: 30)
      raise ArgumentError, "api_key is required" if api_key.nil? || api_key.to_s.empty?

      @api_key = api_key
      @base_url = base_url.to_s.chomp("/")
      @max_retries = max_retries
      @timeout = timeout
    end

    # Perform a request. Returns parsed JSON (Hash) or nil for 204/no body.
    # Raises Wave::Error / Wave::RateLimitError on failure.
    def request(method, path, query: nil, body: nil)
      uri = URI("#{{@base_url}}#{{path}}")
      uri.query = URI.encode_www_form(compact(query)) if query && !compact(query).empty?

      attempt = 0
      loop do
        response = perform(method, uri, body)
        status = response.code.to_i
        request_id = response["x-request-id"]

        if status == 429
          retry_after = (response["Retry-After"] || "1").to_f
          if attempt < @max_retries
            sleep(retry_after)
            attempt += 1
            next
          end
          raise RateLimitError.new("rate limit exceeded", retry_after: retry_after, request_id: request_id)
        end

        if status >= 400
          err = parse_error(response, status, request_id)
          if err.retryable && attempt < @max_retries
            sleep(backoff(attempt))
            attempt += 1
            next
          end
          raise err
        end

        return nil if status == 204 || response.body.nil? || response.body.empty?

        content_type = response["Content-Type"].to_s
        return JSON.parse(response.body) if content_type.start_with?("application/json")

        return nil
      rescue Errno::ECONNREFUSED, Errno::ETIMEDOUT, Net::OpenTimeout, Net::ReadTimeout, SocketError => e
        if attempt < @max_retries
          sleep(backoff(attempt))
          attempt += 1
          retry
        end
        raise Error.new(e.message, code: "NETWORK_ERROR", status_code: 0)
      end
    end

    private

    def perform(method, uri, body)
      klass = {{
        "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post,
        "PUT" => Net::HTTP::Put, "PATCH" => Net::HTTP::Patch,
        "DELETE" => Net::HTTP::Delete
      }}.fetch(method)
      req = klass.new(uri)
      req["Authorization"] = "Bearer #{{@api_key}}"
      req["Accept"] = "application/json"
      req["User-Agent"] = USER_AGENT
      unless body.nil?
        req["Content-Type"] = "application/json"
        req.body = JSON.generate(body)
      end
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = @timeout
      http.read_timeout = @timeout
      http.request(req)
    end

    def parse_error(response, status, request_id)
      body = begin
        JSON.parse(response.body.to_s)
      rescue JSON::ParserError
        {{}}
      end
      err = body["error"] || {{}}
      Error.new(
        err["message"] || "HTTP #{{status}}",
        code: err["code"] || "HTTP_#{{status}}",
        status_code: status,
        request_id: request_id || body["request_id"],
        details: err["details"]
      )
    end

    def compact(hash)
      (hash || {{}}).reject {{ |_, v| v.nil? }}
    end

    def backoff(attempt)
      delay = [2.0**attempt, 30.0].min
      delay + (rand * delay * 0.25)
    end
  end
end
'''


def _service(prod: dict) -> str:
    ident = prod["ident"]
    lines = [
        "# frozen_string_literal: true",
        "",
        "module Wave",
        f"  # {prod['tag']} — {prod['description']}",
        f"  class {ident}",
        "    def initialize(client)",
        "      @client = client",
        "    end",
        "",
    ]
    for op in prod["operations"]:
        method = _rb_ident(camel_to_snake(op["verb"]))
        req_q = [q for q in op["query_params"] if q["required"]]
        opt_q = [q for q in op["query_params"] if not q["required"]]
        # signature: path params + required query (positional) + body, then
        # optional query as keyword args. Required query params are mandatory.
        pos = [camel_to_snake(pp["name"]) for pp in op["path_params"]]
        pos += [_rb_ident(camel_to_snake(q["name"])) for q in req_q]
        if op["has_body"]:
            pos.append("body")
        kw = [f"{_rb_ident(camel_to_snake(q['name']))}: nil" for q in opt_q]
        sig = ", ".join(pos + kw)
        siglabel = f"({sig})" if sig else ""

        lines.append(f"    # {op['summary']} (operationId: {op['operation_id']}, {op['http_method']} {op['path']}).")
        lines.append(f"    def {method}{siglabel}")
        # path
        path = op["path"]
        for pp in op["path_params"]:
            path = path.replace("{" + pp["name"] + "}", "#{" + camel_to_snake(pp["name"]) + "}")
        path_expr = f'"{path}"'
        # query
        if op["query_params"]:
            lines.append("      query = {")
            for q in op["query_params"]:
                lines.append(f'        "{q["name"]}" => {_rb_ident(camel_to_snake(q["name"]))},')
            lines.append("      }")
            qarg = ", query: query"
        else:
            qarg = ""
        barg = ", body: body" if op["has_body"] else ""
        lines.append(f'      @client.request("{op["http_method"]}", {path_expr}{qarg}{barg})')
        lines.append("    end")
        lines.append("")
    lines.append("  end")
    lines.append("end")
    return "\n".join(lines)


def _gemspec() -> str:
    return f'''# frozen_string_literal: true

require_relative "lib/wave/version"

Gem::Specification.new do |spec|
  spec.name = "wave-sdk"
  spec.version = Wave::VERSION
  spec.summary = "Official WAVE API SDK for Ruby"
  spec.description = "Typed-ergonomic Ruby client for the WAVE API, generated from the gateway OpenAPI contract."
  spec.authors = ["WAVE Inc."]
  spec.email = ["sdk@wave.online"]
  spec.homepage = "https://wave.online"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.0"

  spec.files = Dir["lib/**/*.rb", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  spec.metadata = {{
    "source_code_uri" => "https://github.com/wave-av/sdks",
    "homepage_uri" => "https://wave.online",
    "rubygems_mfa_required" => "true"
  }}
end
'''
