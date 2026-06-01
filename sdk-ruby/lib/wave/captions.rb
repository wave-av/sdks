# frozen_string_literal: true

module Wave
  # Captions — Auto-captioning and multi-language translation
  class Captions
    def initialize(client)
      @client = client
    end

    # List caption jobs (operationId: listCaptions, GET /captions).
    def list(page: nil, per_page: nil, video_id: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "videoId" => video_id,
        "status" => status,
      }
      @client.request("GET", "/captions", query: query)
    end

    # Create a caption job (operationId: createCaptionJob, POST /captions).
    def create_job(body)
      @client.request("POST", "/captions", body: body)
    end

    # Get a caption job (operationId: getCaptionJob, GET /captions/{jobId}).
    def get_job(job_id)
      @client.request("GET", "/captions/#{job_id}")
    end

    # Delete a caption job (operationId: deleteCaptionJob, DELETE /captions/{jobId}).
    def delete_job(job_id)
      @client.request("DELETE", "/captions/#{job_id}")
    end

    # Download captions (operationId: downloadCaptions, GET /captions/{jobId}/download).
    def download(job_id, language, format: nil)
      query = {
        "language" => language,
        "format" => format,
      }
      @client.request("GET", "/captions/#{job_id}/download", query: query)
    end

  end
end