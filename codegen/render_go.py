"""Render the Go SDK (sdk-go/) from the IR.

Layout: one module `github.com/wave-av/sdks/sdk-go`, one package `wave` under
sdk-go/wave/ (core + all services in one package to avoid import cycles, the
idiomatic style for a single-vendor SDK — cf. stripe-go). Stdlib only.
"""

from __future__ import annotations

import os

from render_common import model_schemas, pascal

MODULE = "github.com/wave-av/sdks/sdk-go"
_INITIALISMS = {"Id": "ID", "Url": "URL", "Api": "API", "Json": "JSON", "Http": "HTTP"}


def _go_ident(name: str) -> str:
    p = pascal(name)
    for k, v in _INITIALISMS.items():
        if p == k:
            return v
        if p.endswith(k):
            p = p[: -len(k)] + v
    return p


def _enum_names(ir: dict) -> set[str]:
    return {s["name"] for s in ir["schemas"] if s["kind"] == "enum"}


def _model_names(ir: dict) -> set[str]:
    return {s["name"] for s in model_schemas(ir)}


def _go_type(desc: dict, required: bool, models: set[str]) -> str:
    """Map an IR field descriptor to a Go type (pointer when optional scalar)."""
    t = desc["t"]
    if t == "array":
        return "[]" + _go_type(desc["item"], True, models)
    if t == "map":
        return "map[string]any"
    if t == "ref":
        ref = desc["ref"]
        base = ref if ref in models or ref == "Pagination" else "map[string]any"
    else:
        base = {"string": "string", "integer": "int64", "number": "float64",
                "boolean": "bool"}.get(t, "any")
    # optional scalars/refs become pointers (slices/maps are already nilable)
    if not required and not base.startswith(("[]", "map[")):
        return "*" + base
    return base


def _scalar_go(t: str) -> str:
    return {"string": "string", "integer": "int64", "number": "float64",
            "boolean": "bool"}.get(t, "string")


def render(ir: dict, root: str) -> list[str]:
    pkg = os.path.join(root, "wave")
    os.makedirs(pkg, exist_ok=True)
    models = _model_names(ir)
    enums = _enum_names(ir)
    written = []

    def w(fn: str, content: str):
        path = os.path.join(pkg, fn)
        with open(path, "w") as f:
            f.write(content)
        written.append(path)

    w("go.doc.go", _doc(ir))
    w("errors.go", _errors())
    w("pagination.go", _pagination())
    w("client.go", _client(ir))
    w("models.go", _models(ir, models, enums))
    for prod in ir["products"]:
        w(f"{prod['snake']}.go", _service(prod, models, enums))
    # go.mod at module root (sdk-go/). The generated SDK is pure net/http, but the hand-written x402
    # signer (wave/x402.go — NOT codegen output) needs go-ethereum for EIP-712/EIP-3009. Emit its direct
    # require + the matching go directive here so a regen doesn't drop them; `go mod tidy` (run by
    # generate.py after rendering) restores the indirect block + go.sum from the actual imports.
    with open(os.path.join(root, "go.mod"), "w") as f:
        f.write(
            f"module {MODULE}\n\n"
            "go 1.24.0\n\n"
            "require github.com/ethereum/go-ethereum v1.17.3\n"
        )
    written.append(os.path.join(root, "go.mod"))
    return written


def _doc(ir: dict) -> str:
    return f'''// Package wave is the official WAVE API client for Go.
//
// Generated from the WAVE gateway OpenAPI contract (codegen/openapi.yaml) — do
// not edit generated files by hand; re-run `python3 codegen/generate.py`.
//
// All requests are authenticated with an API key (Bearer) and routed through
// the gateway at {ir["base_url"]}, which enforces entitlement
// server-side (401 unauthenticated / 402 not-entitled / 403 out-of-scope).
//
// Usage:
//
//	c, err := wave.New("wave_live_...")
//	if err != nil {{ log.Fatal(err) }}
//	clip, err := c.Clips.Get(context.Background(), "clip_123")
package wave
'''


def _errors() -> str:
    return '''package wave

import "fmt"

// Error is the canonical WAVE API error. The gateway emits a nested envelope
// {"error":{"code","message"}}; Code/Message are lifted from it.
type Error struct {
	Message    string
	Code       string
	StatusCode int
	RequestID  string
	Details    any
	Retryable  bool
}

func (e *Error) Error() string {
	return fmt.Sprintf("wave: [%s] %s", e.Code, e.Message)
}

// RateLimitError is returned on HTTP 429 once retries are exhausted.
type RateLimitError struct {
	Message    string
	Code       string
	StatusCode int
	RequestID  string
	RetryAfter float64 // seconds
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("wave: [%s] %s (retry after %.0fs)", e.Code, e.Message, e.RetryAfter)
}

func isRetryable(status int, code string) bool {
	if status == 429 || (status >= 500 && status < 600) {
		return true
	}
	switch code {
	case "TIMEOUT", "NETWORK_ERROR", "SERVICE_UNAVAILABLE":
		return true
	}
	return false
}

func newError(message, code string, status int, requestID string, details any) *Error {
	return &Error{Message: message, Code: code, StatusCode: status, RequestID: requestID, Details: details, Retryable: isRetryable(status, code)}
}
'''


def _pagination() -> str:
    return '''package wave

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
'''


def _client(ir: dict) -> str:
    svc_fields = "\n".join(
        f"\t{p['ident']} *{p['ident']}Service" for p in ir["products"]
    )
    svc_init = "\n".join(
        f"\tc.{p['ident']} = &{p['ident']}Service{{c: c}}" for p in ir["products"]
    )
    return f'''package wave

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBaseURL = "{ir["base_url"]}"
	userAgent      = "wave-sdk-go/{ir["version"]}"
)

// Client is the WAVE API client. Construct it with New and reach products via
// the typed service fields (c.Clips, c.Voice, ...).
type Client struct {{
	baseURL    string
	apiKey     string
	httpClient *http.Client
	maxRetries int

{svc_fields}
}}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the gateway base URL (e.g. the staging endpoint).
func WithBaseURL(u string) Option {{ return func(c *Client) {{ c.baseURL = strings.TrimRight(u, "/") }} }}

// WithHTTPClient supplies a custom *http.Client (timeouts, proxy, transport).
func WithHTTPClient(h *http.Client) Option {{ return func(c *Client) {{ c.httpClient = h }} }}

// WithMaxRetries sets the retry budget for retryable failures (default 3).
func WithMaxRetries(n int) Option {{ return func(c *Client) {{ c.maxRetries = n }} }}

// New creates a Client. apiKey is required.
func New(apiKey string, opts ...Option) (*Client, error) {{
	if apiKey == "" {{
		return nil, errors.New("wave: apiKey is required")
	}}
	c := &Client{{
		baseURL:    defaultBaseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{{Timeout: 30 * time.Second}},
		maxRetries: 3,
	}}
	for _, o := range opts {{
		o(c)
	}}
{svc_init}
	return c, nil
}}

// doRequest performs an authenticated request with retry/backoff and decodes a
// JSON response into out (out may be nil for 204/no-content endpoints).
func (c *Client) doRequest(ctx context.Context, method, path string, query url.Values, body, out any) error {{
	u := c.baseURL + path
	if len(query) > 0 {{
		u += "?" + query.Encode()
	}}
	var rawBody []byte
	if body != nil {{
		b, err := json.Marshal(body)
		if err != nil {{
			return newError(err.Error(), "SERIALIZATION_ERROR", 0, "", nil)
		}}
		rawBody = b
	}}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {{
		req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(rawBody))
		if err != nil {{
			return newError(err.Error(), "REQUEST_ERROR", 0, "", nil)
		}}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", userAgent)
		if rawBody != nil {{
			req.Header.Set("Content-Type", "application/json")
		}}

		resp, err := c.httpClient.Do(req)
		if err != nil {{
			lastErr = newError(err.Error(), "NETWORK_ERROR", 0, "", nil)
			if attempt < c.maxRetries {{
				if cerr := sleepCtx(ctx, backoff(attempt)); cerr != nil {{
					return cerr
				}}
				continue
			}}
			return lastErr
		}}

		reqID := resp.Header.Get("x-request-id")

		if resp.StatusCode == 429 {{
			ra := parseRetryAfter(resp)
			resp.Body.Close()
			if attempt < c.maxRetries {{
				if cerr := sleepCtx(ctx, time.Duration(ra*float64(time.Second))); cerr != nil {{
					return cerr
				}}
				continue
			}}
			return &RateLimitError{{Message: "rate limit exceeded", Code: "RATE_LIMITED", StatusCode: 429, RequestID: reqID, RetryAfter: ra}}
		}}

		if resp.StatusCode >= 400 {{
			apiErr := parseError(resp, reqID)
			resp.Body.Close()
			if apiErr.Retryable && attempt < c.maxRetries {{
				lastErr = apiErr
				if cerr := sleepCtx(ctx, backoff(attempt)); cerr != nil {{
					return cerr
				}}
				continue
			}}
			return apiErr
		}}

		defer resp.Body.Close()
		if out == nil || resp.StatusCode == http.StatusNoContent {{
			io.Copy(io.Discard, resp.Body)
			return nil
		}}
		if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {{
			io.Copy(io.Discard, resp.Body)
			return nil
		}}
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil && err != io.EOF {{
			return newError(err.Error(), "DESERIALIZATION_ERROR", resp.StatusCode, reqID, nil)
		}}
		return nil
	}}
	if lastErr != nil {{
		return lastErr
	}}
	return newError("request failed after retries", "UNKNOWN_ERROR", 0, "", nil)
}}

func parseError(resp *http.Response, reqID string) *Error {{
	var envelope struct {{
		Error struct {{
			Message string `json:"message"`
			Code    string `json:"code"`
			Details any    `json:"details"`
		}} `json:"error"`
		RequestID string `json:"request_id"`
	}}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err == nil && envelope.Error.Message != "" {{
		rid := reqID
		if rid == "" {{
			rid = envelope.RequestID
		}}
		return newError(envelope.Error.Message, envelope.Error.Code, resp.StatusCode, rid, envelope.Error.Details)
	}}
	return newError(fmt.Sprintf("HTTP %d", resp.StatusCode), fmt.Sprintf("HTTP_%d", resp.StatusCode), resp.StatusCode, reqID, nil)
}}

func parseRetryAfter(resp *http.Response) float64 {{
	if v := resp.Header.Get("Retry-After"); v != "" {{
		if f, err := strconv.ParseFloat(v, 64); err == nil {{
			return f
		}}
	}}
	return 1.0
}}

func backoff(attempt int) time.Duration {{
	d := math.Min(math.Pow(2, float64(attempt)), 30)
	jitter := rand.Float64() * d * 0.25
	return time.Duration((d + jitter) * float64(time.Second))
}}

// sleepCtx waits for d, but returns the context error immediately if ctx is
// cancelled or its deadline passes during the wait — so a cancelled request
// aborts its retry backoff instead of blocking for the full delay.
func sleepCtx(ctx context.Context, d time.Duration) error {{
	t := time.NewTimer(d)
	defer t.Stop()
	select {{
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}}
}}

// compile-time assertions that both error types satisfy error.
var _ error = (*Error)(nil)
var _ error = (*RateLimitError)(nil)
'''


def _models(ir: dict, models: set[str], enums: set[str]) -> str:
    out = ["package wave", ""]
    for s in ir["schemas"]:
        if s["name"] not in models:
            continue
        if s["kind"] == "enum":
            tn = _go_ident(s["name"])
            out.append(f"// {tn} is a string enum.")
            out.append(f"type {tn} string")
            out.append("")
            out.append("const (")
            for v in s["values"]:
                cname = tn + _go_ident(v)
                out.append(f'\t{cname} {tn} = "{v}"')
            out.append(")")
            out.append("")
        elif s["kind"] == "object":
            tn = _go_ident(s["name"])
            out.append(f"// {tn} is a generated model.")
            out.append(f"type {tn} struct {{")
            for fld in s["fields"]:
                gi = _go_ident(fld["name"])
                gt = _go_type(fld, fld["required"], models)
                omit = "" if fld["required"] else ",omitempty"
                out.append(f'\t{gi} {gt} `json:"{fld["name"]}{omit}"`')
            out.append("}")
            out.append("")
        else:  # map
            tn = _go_ident(s["name"])
            out.append(f"// {tn} is a free-form object.")
            out.append(f"type {tn} = map[string]any")
            out.append("")
    return "\n".join(out)


def _opt_query(op: dict) -> list[dict]:
    return [q for q in op["query_params"] if not q["required"]]


def _req_query(op: dict) -> list[dict]:
    return [q for q in op["query_params"] if q["required"]]


def _scalar_conv_go(qtype: str, expr: str) -> str:
    """Render a Go expression converting `expr` of the param's type to a string."""
    if qtype == "integer":
        return f"strconv.FormatInt({expr}, 10)"
    if qtype == "number":
        return f"strconv.FormatFloat({expr}, 'f', -1, 64)"
    if qtype == "boolean":
        return f"strconv.FormatBool({expr})"
    return expr  # string-backed (incl. JobStatus)


def _params_struct(prod: dict, op: dict, models: set[str]) -> tuple[str, str]:
    """Return (struct_def, struct_name) for an op's OPTIONAL query params, or ('','').

    Required query params are positional method args (enforced at compile time);
    only the optional ones live in this struct.
    """
    opt = _opt_query(op)
    if not opt:
        return "", ""
    name = f"{prod['ident']}{pascal(op['verb'])}Params"
    lines = [f"// {name} holds the optional query parameters for {prod['ident']}.{pascal(op['verb'])}.",
             f"type {name} struct {{"]
    setters = []
    for q in opt:
        gi = _go_ident(q["name"])
        gt = {"integer": "*int64", "number": "*float64", "boolean": "*bool"}.get(q["type"], "*string")
        lines.append(f"\t{gi} {gt} // {q['name']}")
        setters.append((q["name"], gi, _scalar_conv_go(q["type"], f"*p.{gi}")))
    lines.append("}")
    lines.append("")
    lines.append(f"func (p *{name}) apply(v url.Values) {{")
    lines.append("\tif p == nil {")
    lines.append("\t\treturn")
    lines.append("\t}")
    for qname, gi, conv in setters:
        lines.append(f"\tif p.{gi} != nil {{")
        lines.append(f'\t\tv.Set("{qname}", {conv})')
        lines.append("\t}")
    lines.append("}")
    lines.append("")
    return "\n".join(lines), name


def _service(prod: dict, models: set[str], enums: set[str]) -> str:
    ident = prod["ident"]
    # Build the file body first, tracking which stdlib imports it actually uses,
    # then prune the import block (url/strconv/strings vary per product; context
    # is always used). Avoids "imported and not used" compile errors.
    body = []
    body.append(f"// {ident}Service accesses the {prod['tag']} product. {prod['description']}")
    body.append(f"type {ident}Service struct {{ c *Client }}")
    body.append("")
    used = {"context": True, "url": False, "strconv": False, "strings": False}
    for op in prod["operations"]:
        opt_q = _opt_query(op)
        req_q = _req_query(op)
        pstruct, pname = _params_struct(prod, op, models)
        if pstruct:
            body.append(pstruct)
            used["url"] = True
            if any(q["type"] in ("integer", "number", "boolean") for q in opt_q):
                used["strconv"] = True
        method = pascal(op["verb"])

        # build arg list: ctx, path params, required query (positional), body, optional params
        args = ["ctx context.Context"]
        path_expr = f'"{op["path"]}"'
        for pp in op["path_params"]:
            an = pp["name"]  # raw lowerCamel param name, a valid Go identifier
            args.append(f"{an} string")
            path_expr = f'strings.ReplaceAll({path_expr}, "{{{pp["name"]}}}", url.PathEscape({an}))'
            used["strings"] = True
            used["url"] = True
        req_arg_types = {"integer": "int64", "number": "float64", "boolean": "bool"}
        for q in req_q:
            args.append(f"{q['name']} {req_arg_types.get(q['type'], 'string')}")
            used["url"] = True
            if q["type"] in ("integer", "number", "boolean"):
                used["strconv"] = True
        if op["has_body"]:
            bt = op["body_type"]
            btype = (_go_ident(bt) if bt and bt in models else "map[string]any")
            args.append(f"body {btype}")
        if pname:
            args.append(f"params *{pname}")
        argstr = ", ".join(args)

        rk = op["response_kind"]
        if rk == "single":
            ret = f"(*{_go_ident(op['response_type'])}, error)"
        elif rk == "paginated":
            ret = f"(*Page[{_go_ident(op['response_type'])}], error)"
        elif rk == "raw":
            ret = "(map[string]any, error)"
        else:
            ret = "error"

        body.append(f"// {method} — {op['summary']} (operationId: {op['operation_id']}, {op['http_method']} {op['path']}).")
        body.append(f"func (s *{ident}Service) {method}({argstr}) {ret} {{")
        # path var
        if op["path_params"]:
            body.append(f"\tpath := {path_expr}")
            pvar = "path"
        else:
            pvar = f'"{op["path"]}"'
        # query: build url.Values from required args + optional params
        if op["query_params"]:
            body.append("\tvals := url.Values{}")
            for q in req_q:
                body.append(f'\tvals.Set("{q["name"]}", {_scalar_conv_go(q["type"], q["name"])})')
            if pname:
                body.append("\tparams.apply(vals)")
            qexpr = "vals"
        else:
            qexpr = "nil"
        bexpr = "body" if op["has_body"] else "nil"
        if rk in ("single", "paginated"):
            outdecl = f"Page[{_go_ident(op['response_type'])}]" if rk == "paginated" else _go_ident(op["response_type"])
            body.append(f"\tvar out {outdecl}")
            body.append(f'\tif err := s.c.doRequest(ctx, "{op["http_method"]}", {pvar}, {qexpr}, {bexpr}, &out); err != nil {{')
            body.append("\t\treturn nil, err")
            body.append("\t}")
            body.append("\treturn &out, nil")
        elif rk == "raw":
            body.append("\tvar out map[string]any")
            body.append(f'\tif err := s.c.doRequest(ctx, "{op["http_method"]}", {pvar}, {qexpr}, {bexpr}, &out); err != nil {{')
            body.append("\t\treturn nil, err")
            body.append("\t}")
            body.append("\treturn out, nil")
        else:
            body.append(f'\treturn s.c.doRequest(ctx, "{op["http_method"]}", {pvar}, {qexpr}, {bexpr}, nil)')
        body.append("}")
        body.append("")

    # prune unused imports
    imports = [k for k in ("context", "url", "strconv", "strings") if used[k]]
    imap = {"context": '"context"', "url": '"net/url"', "strconv": '"strconv"', "strings": '"strings"'}
    if imports:
        imp = "import (\n" + "\n".join(f"\t{imap[k]}" for k in imports) + "\n)\n"
    else:
        imp = ""
    return f"package wave\n\n{imp}\n" + "\n".join(body)
