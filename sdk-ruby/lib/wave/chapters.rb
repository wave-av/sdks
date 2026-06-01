# frozen_string_literal: true

module Wave
  # Chapters — AI chapter detection and video segmentation
  class Chapters
    def initialize(client)
      @client = client
    end

    # List chapters for a video (operationId: listChapters, GET /videos/{videoId}/chapters).
    def list(video_id)
      @client.request("GET", "/videos/#{video_id}/chapters")
    end

    # Create a chapter (operationId: createChapter, POST /videos/{videoId}/chapters).
    def create(video_id, body)
      @client.request("POST", "/videos/#{video_id}/chapters", body: body)
    end

    # Start AI chapter detection (operationId: detectChapters, POST /videos/{videoId}/chapters/detect).
    def detect(video_id, body)
      @client.request("POST", "/videos/#{video_id}/chapters/detect", body: body)
    end

  end
end