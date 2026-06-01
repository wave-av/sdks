//! Collab — Real-time collaboration rooms
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Collab product.
pub struct Collab<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct CollabListRoomsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

impl<'a> Collab<'a> {
    /// List collaboration rooms (operationId: listCollabRooms, GET /collab/rooms).
    pub fn list_rooms(&self, params: &CollabListRoomsParams) -> Result<Page<models::CollabRoom>, Error> {
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
        self.http.request("GET", "/collab/rooms", &query, None::<&serde_json::Value>)
    }

    /// Create a collaboration room (operationId: createCollabRoom, POST /collab/rooms).
    pub fn create_room(&self, body: &models::CollabRoomCreate) -> Result<models::CollabRoom, Error> {
        self.http.request("POST", "/collab/rooms", &[], Some(body))
    }

    /// Get a room (operationId: getCollabRoom, GET /collab/rooms/{roomId}).
    pub fn get_room(&self, room_id: &str) -> Result<models::CollabRoom, Error> {
        let path = "/collab/rooms/{roomId}".to_string().replace("{roomId}", room_id);
        self.http.request("GET", &path, &[], None::<&serde_json::Value>)
    }

    /// Delete a room (operationId: deleteCollabRoom, DELETE /collab/rooms/{roomId}).
    pub fn delete_room(&self, room_id: &str) -> Result<(), Error> {
        let path = "/collab/rooms/{roomId}".to_string().replace("{roomId}", room_id);
        self.http.request_no_content("DELETE", &path, &[], None::<&serde_json::Value>)
    }

}