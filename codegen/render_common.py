"""Shared helpers for the per-language renderers.

Keeps naming + the core-owned schema skip-list in one place so Go/Rust/Ruby
stay consistent. The CORE schemas below are hand-written in every language
(they encode the gateway's *real* error/pagination behavior, which the OpenAPI
component schemas document incompletely — see codegen/README.md §Divergences).
"""

from __future__ import annotations

import re

# Schemas the core owns by hand (NOT generated as models):
#   Error            -> WaveError/RateLimitError (gateway emits nested {error:{code,message}})
#   Pagination       -> core Pagination type
#   PaginatedResponse-> core Page<T> generic wrapper
CORE_SCHEMAS = {"Error", "Pagination", "PaginatedResponse"}


def model_schemas(ir: dict) -> list[dict]:
    """Schemas to generate as models (everything except the core-owned ones)."""
    return [s for s in ir["schemas"] if s["name"] not in CORE_SCHEMAS]


def pascal(s: str) -> str:
    return "".join(w[:1].upper() + w[1:] for w in re.split(r"[^A-Za-z0-9]+", s) if w)


def camel_to_snake(s: str) -> str:
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", s)
    return s.lower()


def field_doc_values(schema: dict) -> str:
    if schema["kind"] == "enum":
        return "one of: " + ", ".join(schema["values"])
    return ""
