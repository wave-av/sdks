# frozen_string_literal: true

require "net/http"
require "json"
require "uri"

module Wave
  # HTTP client for the WAVE gateway. Handles auth, retries, and error parsing.
  class Client
    DEFAULT_BASE_URL = "https://api.wave.online/v1"
    USER_AGENT = "wave-sdk-ruby/0.1.0"

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
      uri = URI("#{@base_url}#{path}")
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
      klass = {
        "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post,
        "PUT" => Net::HTTP::Put, "PATCH" => Net::HTTP::Patch,
        "DELETE" => Net::HTTP::Delete
      }.fetch(method)
      req = klass.new(uri)
      req["Authorization"] = "Bearer #{@api_key}"
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
        {}
      end
      err = body["error"] || {}
      Error.new(
        err["message"] || "HTTP #{status}",
        code: err["code"] || "HTTP_#{status}",
        status_code: status,
        request_id: request_id || body["request_id"],
        details: err["details"]
      )
    end

    def compact(hash)
      (hash || {}).reject { |_, v| v.nil? }
    end

    def backoff(attempt)
      delay = [2.0**attempt, 30.0].min
      delay + (rand * delay * 0.25)
    end
  end
end
