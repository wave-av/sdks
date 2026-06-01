# frozen_string_literal: true

module Wave
  # Sentiment — Sentiment and emotion analysis
  class Sentiment
    def initialize(client)
      @client = client
    end

    # List sentiment analyses (operationId: listSentimentAnalyses, GET /sentiment).
    def list_analyses(page: nil, per_page: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "status" => status,
      }
      @client.request("GET", "/sentiment", query: query)
    end

    # Create a sentiment analysis (operationId: createSentimentAnalysis, POST /sentiment).
    def create_analysis(body)
      @client.request("POST", "/sentiment", body: body)
    end

    # Analyze text directly (operationId: analyzeText, POST /sentiment/analyze).
    def analyze_text(body)
      @client.request("POST", "/sentiment/analyze", body: body)
    end

  end
end