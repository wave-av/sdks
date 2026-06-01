package wave

// Pagination mirrors the gateway's pagination block.
type Pagination struct {
	Page       int64 `json:"page"`
	PerPage    int64 `json:"perPage"`
	Total      int64 `json:"total"`
	TotalPages int64 `json:"totalPages"`
}

// Page is the standard paginated envelope: {data:[...],pagination:{...}}.
type Page[T any] struct {
	Data       []T        `json:"data"`
	Pagination Pagination `json:"pagination"`
}
