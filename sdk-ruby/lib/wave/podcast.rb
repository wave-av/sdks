# frozen_string_literal: true

module Wave
  # Podcast — Podcast show and episode management
  class Podcast
    def initialize(client)
      @client = client
    end

    # List podcast shows (operationId: listPodcastShows, GET /podcast/shows).
    def list_shows(page: nil, per_page: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
      }
      @client.request("GET", "/podcast/shows", query: query)
    end

    # Create a podcast show (operationId: createPodcastShow, POST /podcast/shows).
    def create_show(body)
      @client.request("POST", "/podcast/shows", body: body)
    end

    # List episodes for a show (operationId: listPodcastEpisodes, GET /podcast/shows/{showId}/episodes).
    def list_episodes(show_id, page: nil, per_page: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
      }
      @client.request("GET", "/podcast/shows/#{show_id}/episodes", query: query)
    end

    # Create an episode (operationId: createPodcastEpisode, POST /podcast/shows/{showId}/episodes).
    def create_episode(show_id, body)
      @client.request("POST", "/podcast/shows/#{show_id}/episodes", body: body)
    end

  end
end