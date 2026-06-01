use serde::{Deserialize, Serialize};

/// Pagination block returned alongside list responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    #[serde(default)]
    pub page: i64,
    #[serde(rename = "perPage", default)]
    pub per_page: i64,
    #[serde(default)]
    pub total: i64,
    #[serde(rename = "totalPages", default)]
    pub total_pages: i64,
}

/// Standard paginated envelope: `{ "data": [...], "pagination": {...} }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page<T> {
    pub data: Vec<T>,
    #[serde(default = "default_pagination")]
    pub pagination: Pagination,
}

fn default_pagination() -> Pagination {
    Pagination { page: 0, per_page: 0, total: 0, total_pages: 0 }
}
