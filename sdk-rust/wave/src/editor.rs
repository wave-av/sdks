//! Editor — Cloud video editing projects
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Editor product.
pub struct Editor<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct EditorListProjectsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

impl<'a> Editor<'a> {
    /// List editor projects (operationId: listProjects, GET /editor/projects).
    pub fn list_projects(&self, params: &EditorListProjectsParams) -> Result<Page<models::EditorProject>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        if let Some(v) = &params.status {
            query.push(("status".to_string(), v.to_string()));
        }
        self.http.request("GET", "/editor/projects", &query, None::<&serde_json::Value>)
    }

    /// Create an editor project (operationId: createProject, POST /editor/projects).
    pub fn create_project(&self, body: &models::EditorProjectCreate) -> Result<models::EditorProject, Error> {
        self.http.request("POST", "/editor/projects", &[], Some(body))
    }

    /// Get a project (operationId: getProject, GET /editor/projects/{projectId}).
    pub fn get_project(&self, project_id: &str) -> Result<models::EditorProject, Error> {
        let path = "/editor/projects/{projectId}".to_string().replace("{projectId}", project_id);
        self.http.request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Update a project (operationId: updateProject, PATCH /editor/projects/{projectId}).
    pub fn update_project(&self, project_id: &str, body: &models::EditorProjectUpdate) -> Result<models::EditorProject, Error> {
        let path = "/editor/projects/{projectId}".to_string().replace("{projectId}", project_id);
        self.http.request("PATCH", &path, &[], Some(body))
    }

    /// Delete a project (operationId: deleteProject, DELETE /editor/projects/{projectId}).
    pub fn delete_project(&self, project_id: &str) -> Result<(), Error> {
        let path = "/editor/projects/{projectId}".to_string().replace("{projectId}", project_id);
        self.http.request_no_content("DELETE", &path, &[], None::<&serde_json::Value>)
    }

    /// Export a project (operationId: exportProject, POST /editor/projects/{projectId}/export).
    pub fn export_project(&self, project_id: &str, body: &models::ExportRequest) -> Result<models::ExportJob, Error> {
        let path = "/editor/projects/{projectId}/export".to_string().replace("{projectId}", project_id);
        self.http.request("POST", &path, &[], Some(body))
    }

}