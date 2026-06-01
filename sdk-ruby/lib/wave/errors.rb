# frozen_string_literal: true

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
