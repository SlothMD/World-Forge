#!/usr/bin/env python3
"""Validate the reusable refs harness.

Template mode allows sentinel placeholders. Initialized mode rejects sentinel
placeholders in bootstrap files so copied projects can verify they were filled.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required: python -m pip install pyyaml") from exc


ROOT = Path(__file__).resolve().parents[2]
REFS = ROOT / "refs"
POLICY = REFS / "templatePolicy.yaml"


def load_yaml(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def all_ref_files() -> list[Path]:
    return [p for p in REFS.rglob("*") if p.is_file()]


def yaml_files() -> list[Path]:
    return [p for p in all_ref_files() if p.suffix in {".yaml", ".yml"}]


def add_error(errors: list[str], path: Path | str, message: str) -> None:
    label = path if isinstance(path, str) else rel(path)
    errors.append(f"{label}: {message}")


def validate_required_files(policy: dict[str, Any], errors: list[str]) -> None:
    for item in policy.get("required_files", []):
        if not (ROOT / item).is_file():
            add_error(errors, item, "required file is missing")


def validate_yaml_parse(errors: list[str]) -> dict[str, Any]:
    loaded: dict[str, Any] = {}
    for path in yaml_files():
        try:
            loaded[rel(path)] = load_yaml(path)
        except yaml.YAMLError as exc:
            add_error(errors, path, f"invalid YAML: {exc}")
    return loaded


def validate_schema_keys(loaded: dict[str, Any], errors: list[str]) -> None:
    registry_path = REFS / "schemas" / "schemaRegistry.yaml"
    registry = loaded.get(rel(registry_path)) or load_yaml(registry_path)
    defaults = registry.get("defaults", {}).get("yaml_required_top_level_keys", [])

    for path in yaml_files():
        data = loaded.get(rel(path), {})
        if not isinstance(data, dict):
            add_error(errors, path, "YAML root must be a mapping")
            continue
        for key in defaults:
            if key not in data:
                add_error(errors, path, f"missing required top-level key `{key}`")

    for item, schema in registry.get("schemas", {}).items():
        data = loaded.get(item)
        if data is None:
            continue
        for key in schema.get("required_top_level_keys", []):
            if key not in data:
                add_error(errors, item, f"missing schema top-level key `{key}`")

    integration_schema = registry.get("integration_file_schema", {})
    allowed = set(integration_schema.get("allowed_statuses", []))
    required_keys = integration_schema.get("required_integration_keys", [])
    for path in REFS.glob("integrations/*.yaml"):
        data = loaded.get(rel(path), {})
        integration = data.get("integration") if isinstance(data, dict) else None
        if not isinstance(integration, dict):
            add_error(errors, path, "missing integration mapping")
            continue
        for key in required_keys:
            if key not in integration:
                add_error(errors, path, f"missing integration key `{key}`")
        status = integration.get("status")
        if allowed and status not in allowed:
            add_error(errors, path, f"integration status `{status}` is not allowed")


def validate_schema_references(loaded: dict[str, Any], errors: list[str]) -> None:
    for item, data in loaded.items():
        if not isinstance(data, dict) or "schema" not in data:
            continue
        schema_ref = data["schema"]
        if not isinstance(schema_ref, str):
            add_error(errors, item, "`schema` must be a relative path string")
            continue
        if Path(schema_ref).is_absolute() or re.match(r"^[A-Za-z]:", schema_ref):
            add_error(errors, item, "`schema` must be relative")
            continue
        if not (ROOT / schema_ref).is_file():
            add_error(errors, item, f"schema reference `{schema_ref}` does not exist")


def validate_placeholders(policy: dict[str, Any], mode: str, errors: list[str]) -> None:
    allowed_tokens = set(policy.get("placeholder_tokens", []))
    token_re = re.compile(r"\b[A-Z][A-Z0-9_]*TODO[A-Z0-9_]*\b")
    bootstrap = {ROOT / item for item in policy.get("bootstrap_files", [])}

    for path in all_ref_files():
        found = set(token_re.findall(text(path)))
        disallowed = found - allowed_tokens
        for token in sorted(disallowed):
            add_error(errors, path, f"placeholder token `{token}` is not allowed")
        if mode == "initialized" and path in bootstrap and found:
            add_error(errors, path, "bootstrap file still contains template placeholders")


def validate_secret_scan(policy: dict[str, Any], errors: list[str]) -> None:
    patterns = policy.get("validation", {}).get("disallowed_secret_patterns", [])
    regexes = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
    assignment_re = re.compile(r"[:=]\s*['\"]?[A-Za-z0-9_/\-+=]{16,}")

    for path in all_ref_files():
        if rel(path).startswith("refs/examples/"):
            continue
        for lineno, line in enumerate(text(path).splitlines(), start=1):
            if any(regex.search(line) for regex in regexes) and assignment_re.search(line):
                add_error(errors, path, f"possible secret-like value on line {lineno}")


def validate_portable_paths(errors: list[str]) -> None:
    absolute_windows = re.compile(r"[A-Za-z]:\\")
    absolute_unix = re.compile(r"(?<!:)\\s/[A-Za-z0-9_.-]")
    for path in yaml_files():
        contents = text(path)
        if absolute_windows.search(contents):
            add_error(errors, path, "contains a Windows absolute path")
        if absolute_unix.search(contents):
            add_error(errors, path, "contains a Unix absolute path")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["template", "initialized"], default="template")
    args = parser.parse_args()

    errors: list[str] = []
    if not POLICY.is_file():
        add_error(errors, POLICY, "template policy is missing")
        print("\n".join(errors), file=sys.stderr)
        return 1

    policy = load_yaml(POLICY)
    validate_required_files(policy, errors)
    loaded = validate_yaml_parse(errors)
    validate_schema_keys(loaded, errors)
    validate_schema_references(loaded, errors)
    validate_placeholders(policy, args.mode, errors)
    validate_secret_scan(policy, errors)
    validate_portable_paths(errors)

    if errors:
        print("refs validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"refs validation passed ({args.mode} mode)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
