# frozen_string_literal: true

module Wave
  # Studio AI — Video enhancement and AI processing
  class StudioAi
    def initialize(client)
      @client = client
    end

    # List enhancement jobs (operationId: listEnhancements, GET /studio-ai/enhancements).
    def list_enhancements(page: nil, per_page: nil, type: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "type" => type,
        "status" => status,
      }
      @client.request("GET", "/studio-ai/enhancements", query: query)
    end

    # Create an enhancement job (operationId: createEnhancement, POST /studio-ai/enhancements).
    def create_enhancement(body)
      @client.request("POST", "/studio-ai/enhancements", body: body)
    end

    # Generate enhancement preview (operationId: previewEnhancement, POST /studio-ai/preview).
    def preview_enhancement(body)
      @client.request("POST", "/studio-ai/preview", body: body)
    end

  end
end