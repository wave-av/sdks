"""Parse openapi.yaml into a language-neutral IR (intermediate representation).

The IR is the single source the per-language renderers consume, so naming/typing
decisions live here once and every SDK stays consistent. Run via `generate.py`;
this module is import-only (no side effects beyond `build_ir`).

Grounding: the WAVE gateway contract at codegen/openapi.yaml (OpenAPI 3.1, 12
tags, 49 operations). The generated clients are therefore the most contract-
accurate in the fleet — TS/Python were hand-carved and drift (tracked in #122).
"""

from __future__ import annotations

import re
from typing import Any

import yaml

# Version stamped onto every generated SDK. 0.1.0 == real-API / gateway-
# entitle-able surface, matching the TS real-API products. Bumped by hand on
# contract changes; the codegen is otherwise deterministic.
SDK_VERSION = "0.1.0"

HTTP_METHODS = ("get", "post", "put", "patch", "delete")


def _resolve_ref(spec: dict, ref: str) -> tuple[str, dict]:
    """'#/components/schemas/Clip' -> ('Clip', {schema dict})."""
    parts = ref.lstrip("#/").split("/")
    node: Any = spec
    for p in parts:
        node = node[p]
    return parts[-1], node


def _schema_type_ref(schema: dict) -> str | None:
    """If a schema is exactly a $ref to a named component schema, return its name."""
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    return None


def _classify_response(spec: dict, schema: dict) -> tuple[str, str | None]:
    """Return (kind, item_or_type).

    kind: 'single' (named type), 'paginated' (PaginatedResponse + data:[X]),
          'raw' (inline/anonymous object -> generic JSON), 'none' (no body).
    """
    if not schema:
        return "none", None  # 204 / no application-json body
    ref = _schema_type_ref(schema)
    if ref:
        return "single", ref
    # allOf: PaginatedResponse + { data: [X] } -> paginated of X, but ONLY when the
    # inline part is exactly {data}. A richer shape (e.g. /search adds `facets`)
    # would lose fields through Page<T>, so fall back to raw (full map).
    if "allOf" in schema:
        item = None
        extra = False
        for part in schema["allOf"]:
            props = part.get("properties", {})
            if not props:
                continue
            data = props.get("data", {})
            if data.get("type") == "array":
                item = _schema_type_ref(data.get("items", {}))
            if set(props) - {"data"}:
                extra = True
        if item and not extra:
            return "paginated", item
        return "raw", None
    # inline object (e.g. /search/quick { results: [...] }) -> generic raw
    return "raw", None


def _param(spec: dict, p: dict) -> dict:
    """Normalize a parameter (resolving a $ref into components.parameters)."""
    if "$ref" in p:
        _, p = _resolve_ref(spec, p["$ref"])
    sch = p.get("schema", {})
    return {
        "name": p["name"],
        "in": p["in"],
        "required": bool(p.get("required", False)),
        "type": sch.get("type", "string"),
        "default": sch.get("default"),
    }


def _camel_tokens(s: str) -> list[str]:
    """'createCaptionJob' -> ['create','Caption','Job']; 'listPhoneLines' -> ['list','Phone','Lines']."""
    return re.findall(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+", s)


def _strip_tag_noun(op_id: str, product_ident: str) -> str:
    """Drop the product-noun token(s) from a camelCase operationId.

    'createCaptionJob' (Captions) -> 'createJob'; 'searchSuggest' (Search) ->
    'suggest'; 'detectClips' (Clips) -> 'detect'. Matches a token to the product
    noun by exact or naive-singular (trailing-s) equality, so both singular
    ('Clip') and plural ('Clips') product nouns line up. The full operationId is
    preserved in each method's doc comment, so traceability is never lost.
    Returns '' when everything strips away (caller falls back to the operationId).
    """
    noun = re.sub(r"[^a-z0-9]", "", product_ident.lower())  # 'studioai','clips'
    noun_sing = noun.rstrip("s")
    kept = []
    for tok in _camel_tokens(op_id):
        tl = tok.lower()
        if tl == noun or tl.rstrip("s") == noun_sing:
            continue  # this token IS the product noun -> drop
        kept.append(tok)
    if not kept:
        return ""
    # re-camel: first token lowercased, rest title-cased preserving acronyms
    head, *tail = kept
    return head[:1].lower() + head[1:] + "".join(t[:1].upper() + t[1:] for t in tail)


def _success_response(spec: dict, op: dict) -> tuple[int, dict]:
    """First 2xx response -> (status, json schema dict)."""
    for status, body in op.get("responses", {}).items():
        s = str(status)
        if s.startswith("2"):
            if "$ref" in body:  # 2xx that is itself a component ref (rare)
                _, body = _resolve_ref(spec, body["$ref"])
            schema = (
                body.get("content", {})
                .get("application/json", {})
                .get("schema", {})
            )
            return int(s), schema
    return 0, {}


def build_ir(spec_path: str) -> dict:
    spec = yaml.safe_load(open(spec_path))
    base_url = spec["servers"][0]["url"].rstrip("/")

    # --- products (one per tag, ordered as declared) ---
    products: dict[str, dict] = {}
    for tag in spec.get("tags", []):
        ident = re.sub(r"[^A-Za-z0-9]", "", tag["name"].title())  # 'StudioAI'
        slug = re.sub(r"[^a-z0-9]+", "-", tag["name"].lower()).strip("-")
        snake = slug.replace("-", "_")
        products[tag["name"]] = {
            "tag": tag["name"],
            "ident": ident,
            "slug": slug,
            "snake": snake,
            "description": tag.get("description", ""),
            "operations": [],
        }

    # --- operations ---
    for path, item in spec.get("paths", {}).items():
        for method in HTTP_METHODS:
            if method not in item:
                continue
            op = item[method]
            tag = op["tags"][0]
            prod = products[tag]
            params = [_param(spec, p) for p in op.get("parameters", [])]
            body = op.get("requestBody", {})
            body_schema = (
                body.get("content", {}).get("application/json", {}).get("schema", {})
            )
            body_ref = _schema_type_ref(body_schema) if body_schema else None
            status, resp_schema = _success_response(spec, op)
            resp_kind, resp_item = _classify_response(spec, resp_schema)
            prod["operations"].append(
                {
                    "operation_id": op["operationId"],
                    "verb": _strip_tag_noun(op["operationId"], prod["ident"]),
                    "http_method": method.upper(),
                    "path": path,
                    "summary": op.get("summary", ""),
                    "path_params": [p for p in params if p["in"] == "path"],
                    "query_params": [p for p in params if p["in"] == "query"],
                    "has_body": bool(body_schema),
                    "body_type": body_ref,          # named schema or None (inline->generic)
                    "body_required": bool(body.get("required", False)),
                    "success_status": status,
                    "response_kind": resp_kind,      # single|paginated|raw|none
                    "response_type": resp_item,      # named type for single/paginated
                }
            )

    # resolve verb collisions within a product -> fall back to full operationId
    for prod in products.values():
        seen: dict[str, int] = {}
        for o in prod["operations"]:
            v = o["verb"] or o["operation_id"]
            seen[v] = seen.get(v, 0) + 1
        for o in prod["operations"]:
            v = o["verb"] or o["operation_id"]
            o["verb"] = v if seen[v] == 1 else o["operation_id"]

    # --- schemas ---
    schemas = []
    for name, sch in spec["components"]["schemas"].items():
        schemas.append(_classify_schema(name, sch))

    return {
        "base_url": base_url,
        "version": SDK_VERSION,
        "auth": "bearer",
        "products": list(products.values()),
        "schemas": schemas,
    }


def _classify_schema(name: str, sch: dict) -> dict:
    """Normalize a component schema into {name, kind, ...}."""
    # string enum -> string-with-allowed-values (rendered as primitive + doc)
    if sch.get("type") == "string" and "enum" in sch:
        return {"name": name, "kind": "enum", "values": sch["enum"]}
    # allOf (e.g. nothing here, but be safe) -> flatten properties
    props = dict(sch.get("properties", {}))
    required = set(sch.get("required", []))
    for part in sch.get("allOf", []):
        props.update(part.get("properties", {}))
        required |= set(part.get("required", []))
    if props:
        fields = []
        for fname, fsch in props.items():
            fields.append(
                {
                    "name": fname,
                    "required": fname in required,
                    **_field_type(fsch),
                }
            )
        return {"name": name, "kind": "object", "fields": fields}
    # bare object / additionalProperties -> free-form map
    return {"name": name, "kind": "map"}


def _field_type(fsch: dict) -> dict:
    """Map an openapi field schema to a neutral type descriptor."""
    ref = _schema_type_ref(fsch)
    if ref:
        return {"t": "ref", "ref": ref}
    t = fsch.get("type")
    if t == "array":
        inner = fsch.get("items", {})
        iref = _schema_type_ref(inner)
        if iref:
            return {"t": "array", "item": {"t": "ref", "ref": iref}}
        return {"t": "array", "item": {"t": inner.get("type", "string")}}
    if t == "object" or t is None:
        return {"t": "map"}
    return {"t": t}  # string|integer|number|boolean


if __name__ == "__main__":
    import json
    import sys

    ir = build_ir(sys.argv[1] if len(sys.argv) > 1 else "codegen/openapi.yaml")
    print(json.dumps(ir, indent=2))
