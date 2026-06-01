# frozen_string_literal: true

module Wave
  # Clips — AI-powered highlight detection and clip management
  class Clips
    def initialize(client)
      @client = client
    end

    # List clips (operationId: listClips, GET /clips).
    def list(page: nil, per_page: nil, video_id: nil, status: nil, category: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "videoId" => video_id,
        "status" => status,
        "category" => category,
      }
      @client.request("GET", "/clips", query: query)
    end

    # Create a clip (operationId: createClip, POST /clips).
    def create(body)
      @client.request("POST", "/clips", body: body)
    end

    # Get a clip (operationId: getClip, GET /clips/{clipId}).
    def get(clip_id)
      @client.request("GET", "/clips/#{clip_id}")
    end

    # Update a clip (operationId: updateClip, PATCH /clips/{clipId}).
    def update(clip_id, body)
      @client.request("PATCH", "/clips/#{clip_id}", body: body)
    end

    # Delete a clip (operationId: deleteClip, DELETE /clips/{clipId}).
    def delete(clip_id)
      @client.request("DELETE", "/clips/#{clip_id}")
    end

    # Start AI clip detection (operationId: detectClips, POST /clips/detect).
    def detect(body)
      @client.request("POST", "/clips/detect", body: body)
    end

  end
end