package wave

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// EditorService accesses the Editor product. Cloud video editing projects
type EditorService struct{ c *Client }

// EditorListProjectsParams holds the optional query parameters for Editor.ListProjects.
type EditorListProjectsParams struct {
	Page    *int64  // page
	PerPage *int64  // perPage
	Status  *string // status
}

func (p *EditorListProjectsParams) apply(v url.Values) {
	if p == nil {
		return
	}
	if p.Page != nil {
		v.Set("page", strconv.FormatInt(*p.Page, 10))
	}
	if p.PerPage != nil {
		v.Set("perPage", strconv.FormatInt(*p.PerPage, 10))
	}
	if p.Status != nil {
		v.Set("status", *p.Status)
	}
}

// ListProjects — List editor projects (operationId: listProjects, GET /editor/projects).
func (s *EditorService) ListProjects(ctx context.Context, params *EditorListProjectsParams) (*Page[EditorProject], error) {
	vals := url.Values{}
	params.apply(vals)
	var out Page[EditorProject]
	if err := s.c.doRequest(ctx, "GET", "/editor/projects", vals, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateProject — Create an editor project (operationId: createProject, POST /editor/projects).
func (s *EditorService) CreateProject(ctx context.Context, body EditorProjectCreate) (*EditorProject, error) {
	var out EditorProject
	if err := s.c.doRequest(ctx, "POST", "/editor/projects", nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetProject — Get a project (operationId: getProject, GET /editor/projects/{projectId}).
func (s *EditorService) GetProject(ctx context.Context, projectId string) (*EditorProject, error) {
	path := strings.ReplaceAll("/editor/projects/{projectId}", "{projectId}", url.PathEscape(projectId))
	var out EditorProject
	if err := s.c.doRequest(ctx, "GET", path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateProject — Update a project (operationId: updateProject, PATCH /editor/projects/{projectId}).
func (s *EditorService) UpdateProject(ctx context.Context, projectId string, body EditorProjectUpdate) (*EditorProject, error) {
	path := strings.ReplaceAll("/editor/projects/{projectId}", "{projectId}", url.PathEscape(projectId))
	var out EditorProject
	if err := s.c.doRequest(ctx, "PATCH", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteProject — Delete a project (operationId: deleteProject, DELETE /editor/projects/{projectId}).
func (s *EditorService) DeleteProject(ctx context.Context, projectId string) error {
	path := strings.ReplaceAll("/editor/projects/{projectId}", "{projectId}", url.PathEscape(projectId))
	return s.c.doRequest(ctx, "DELETE", path, nil, nil, nil)
}

// ExportProject — Export a project (operationId: exportProject, POST /editor/projects/{projectId}/export).
func (s *EditorService) ExportProject(ctx context.Context, projectId string, body ExportRequest) (*ExportJob, error) {
	path := strings.ReplaceAll("/editor/projects/{projectId}/export", "{projectId}", url.PathEscape(projectId))
	var out ExportJob
	if err := s.c.doRequest(ctx, "POST", path, nil, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
