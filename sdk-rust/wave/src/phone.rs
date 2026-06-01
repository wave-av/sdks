//! Phone — VoIP phone lines and call management
#![allow(clippy::all)]
use wave_core::{models, Client, Error, Page};

/// Service handle for the Phone product.
pub struct Phone<'a> {
    pub(crate) http: &'a Client,
}

#[derive(Debug, Clone, Default)]
pub struct PhoneListLinesParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Clone, Default)]
pub struct PhoneListCallsParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub line_id: Option<String>,
    pub direction: Option<String>,
}

impl<'a> Phone<'a> {
    /// List phone lines (operationId: listPhoneLines, GET /phone/lines).
    pub fn list_lines(
        &self,
        params: &PhoneListLinesParams,
    ) -> Result<Page<models::PhoneLine>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/phone/lines", &query, None::<&serde_json::Value>)
    }

    /// Provision a phone line (operationId: provisionPhoneLine, POST /phone/lines).
    pub fn provision_line(
        &self,
        body: &models::PhoneLineProvision,
    ) -> Result<models::PhoneLine, Error> {
        self.http.request("POST", "/phone/lines", &[], Some(body))
    }

    /// List calls (operationId: listCalls, GET /phone/calls).
    pub fn list_calls(&self, params: &PhoneListCallsParams) -> Result<Page<models::Call>, Error> {
        let mut query: Vec<(String, String)> = Vec::new();
        if let Some(v) = &params.page {
            query.push(("page".to_string(), v.to_string()));
        }
        if let Some(v) = &params.per_page {
            query.push(("perPage".to_string(), v.to_string()));
        }
        if let Some(v) = &params.line_id {
            query.push(("lineId".to_string(), v.to_string()));
        }
        if let Some(v) = &params.direction {
            query.push(("direction".to_string(), v.to_string()));
        }
        self.http
            .request("GET", "/phone/calls", &query, None::<&serde_json::Value>)
    }

    /// Make a call (operationId: makeCall, POST /phone/calls).
    pub fn make_call(&self, body: &models::CallCreate) -> Result<models::Call, Error> {
        self.http.request("POST", "/phone/calls", &[], Some(body))
    }
}
