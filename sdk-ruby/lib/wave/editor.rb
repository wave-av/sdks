# frozen_string_literal: true

module Wave
  # Editor — Cloud video editing projects
  class Editor
    def initialize(client)
      @client = client
    end

    # List editor projects (operationId: listProjects, GET /editor/projects).
    def list_projects(page: nil, per_page: nil, status: nil)
      query = {
        "page" => page,
        "perPage" => per_page,
        "status" => status,
      }
      @client.request("GET", "/editor/projects", query: query)
    end

    # Create an editor project (operationId: createProject, POST /editor/projects).
    def create_project(body)
      @client.request("POST", "/editor/projects", body: body)
    end

    # Get a project (operationId: getProject, GET /editor/projects/{projectId}).
    def get_project(project_id)
      @client.request("GET", "/editor/projects/#{project_id}")
    end

    # Update a project (operationId: updateProject, PATCH /editor/projects/{projectId}).
    def update_project(project_id, body)
      @client.request("PATCH", "/editor/projects/#{project_id}", body: body)
    end

    # Delete a project (operationId: deleteProject, DELETE /editor/projects/{projectId}).
    def delete_project(project_id)
      @client.request("DELETE", "/editor/projects/#{project_id}")
    end

    # Export a project (operationId: exportProject, POST /editor/projects/{projectId}/export).
    def export_project(project_id, body)
      @client.request("POST", "/editor/projects/#{project_id}/export", body: body)
    end

  end
end