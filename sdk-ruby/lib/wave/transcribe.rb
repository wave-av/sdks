# frozen_string_literal: true

module Wave
  # Transcribe — Speech-to-text transcription
  class Transcribe
    def initialize(client)
      @client = client
    end

    # List transcriptions (operationId: listTranscriptions, GET /transcribe).
    def list_transcriptions(page: nil, per_page: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "status" => status,
      }
      @client.request("GET", "/transcribe", query: query)
    end

    # Create a transcription (operationId: createTranscription, POST /transcribe).
    def create_transcription(body)
      @client.request("POST", "/transcribe", body: body)
    end

    # Get a transcription (operationId: getTranscription, GET /transcribe/{transcriptionId}).
    def get_transcription(transcription_id)
      @client.request("GET", "/transcribe/#{transcription_id}")
    end

    # Delete a transcription (operationId: deleteTranscription, DELETE /transcribe/{transcriptionId}).
    def delete_transcription(transcription_id)
      @client.request("DELETE", "/transcribe/#{transcription_id}")
    end

  end
end