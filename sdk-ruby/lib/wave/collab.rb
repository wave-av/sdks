# frozen_string_literal: true

module Wave
  # Collab — Real-time collaboration rooms
  class Collab
    def initialize(client)
      @client = client
    end

    # List collaboration rooms (operationId: listCollabRooms, GET /collab/rooms).
    def list_rooms(page: nil, per_page: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "status" => status,
      }
      @client.request("GET", "/collab/rooms", query: query)
    end

    # Create a collaboration room (operationId: createCollabRoom, POST /collab/rooms).
    def create_room(body)
      @client.request("POST", "/collab/rooms", body: body)
    end

    # Get a room (operationId: getCollabRoom, GET /collab/rooms/{roomId}).
    def get_room(room_id)
      @client.request("GET", "/collab/rooms/#{room_id}")
    end

    # Delete a room (operationId: deleteCollabRoom, DELETE /collab/rooms/{roomId}).
    def delete_room(room_id)
      @client.request("DELETE", "/collab/rooms/#{room_id}")
    end

  end
end