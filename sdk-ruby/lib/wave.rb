# frozen_string_literal: true

require_relative "wave/version"
require_relative "wave/errors"
require_relative "wave/client"
require_relative "wave/clips"
require_relative "wave/voice"
require_relative "wave/captions"
require_relative "wave/chapters"
require_relative "wave/editor"
require_relative "wave/phone"
require_relative "wave/collab"
require_relative "wave/podcast"
require_relative "wave/studio_ai"
require_relative "wave/transcribe"
require_relative "wave/sentiment"
require_relative "wave/search"

# Official WAVE API SDK for Ruby. Generated from the gateway OpenAPI contract.
#
#   client = Wave::Client.new("wave_live_...")
#   clip = client.clips.get("clip_123")
module Wave
  class Client
    # Access the Clips product.
    def clips
      Wave::Clips.new(self)
    end

    # Access the Voice product.
    def voice
      Wave::Voice.new(self)
    end

    # Access the Captions product.
    def captions
      Wave::Captions.new(self)
    end

    # Access the Chapters product.
    def chapters
      Wave::Chapters.new(self)
    end

    # Access the Editor product.
    def editor
      Wave::Editor.new(self)
    end

    # Access the Phone product.
    def phone
      Wave::Phone.new(self)
    end

    # Access the Collab product.
    def collab
      Wave::Collab.new(self)
    end

    # Access the Podcast product.
    def podcast
      Wave::Podcast.new(self)
    end

    # Access the Studio AI product.
    def studio_ai
      Wave::StudioAi.new(self)
    end

    # Access the Transcribe product.
    def transcribe
      Wave::Transcribe.new(self)
    end

    # Access the Sentiment product.
    def sentiment
      Wave::Sentiment.new(self)
    end

    # Access the Search product.
    def search
      Wave::Search.new(self)
    end
  end
end
