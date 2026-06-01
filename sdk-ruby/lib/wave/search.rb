# frozen_string_literal: true

module Wave
  # Search — Semantic content search
  class Search
    def initialize(client)
      @client = client
    end

    # Search content (operationId: search, POST /search).
    def search(body)
      @client.request("POST", "/search", body: body)
    end

    # Quick search (operationId: quickSearch, GET /search/quick).
    def quick(q, limit: nil)
      query = {
        "q" => q,
        "limit" => limit,
      }
      @client.request("GET", "/search/quick", query: query)
    end

    # Get search suggestions (operationId: searchSuggest, GET /search/suggest).
    def suggest(q, limit: nil)
      query = {
        "q" => q,
        "limit" => limit,
      }
      @client.request("GET", "/search/suggest", query: query)
    end

    # Semantic search (operationId: semanticSearch, POST /search/semantic).
    def semantic(body)
      @client.request("POST", "/search/semantic", body: body)
    end

  end
end