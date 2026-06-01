# frozen_string_literal: true

module Wave
  # Phone — VoIP phone lines and call management
  class Phone
    def initialize(client)
      @client = client
    end

    # List phone lines (operationId: listPhoneLines, GET /phone/lines).
    def list_lines(page: nil, per_page: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
      }
      @client.request("GET", "/phone/lines", query: query)
    end

    # Provision a phone line (operationId: provisionPhoneLine, POST /phone/lines).
    def provision_line(body)
      @client.request("POST", "/phone/lines", body: body)
    end

    # List calls (operationId: listCalls, GET /phone/calls).
    def list_calls(page: nil, per_page: nil, line_id: nil, direction: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "lineId" => line_id,
        "direction" => direction,
      }
      @client.request("GET", "/phone/calls", query: query)
    end

    # Make a call (operationId: makeCall, POST /phone/calls).
    def make_call(body)
      @client.request("POST", "/phone/calls", body: body)
    end

  end
end