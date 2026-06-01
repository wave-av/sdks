# frozen_string_literal: true

module Wave
  # Voice — Text-to-speech synthesis and voice cloning
  class Voice
    def initialize(client)
      @client = client
    end

    # List available voices (operationId: listVoices, GET /voice/voices).
    def list(category: nil, language: nil)
      query = {
        "category" => category,
        "language" => language,
      }
      @client.request("GET", "/voice/voices", query: query)
    end

    # Generate speech from text (operationId: generateSpeech, POST /voice/generate).
    def generate_speech(body)
      @client.request("POST", "/voice/generate", body: body)
    end

    # Clone a voice from audio samples (operationId: cloneVoice, POST /voice/clone).
    def clone(body)
      @client.request("POST", "/voice/clone", body: body)
    end

  end
end