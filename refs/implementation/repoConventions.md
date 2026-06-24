# Repo Conventions

- Use a package-first layout so generator code can be called by CLI tools, tests, desktop UI, and future frontends.
- Keep `docs/prd/` for product requirements and `refs/` for durable agent/project memory.
- Keep generated artifacts, build outputs, caches, and exported maps out of source control unless explicitly added as small test fixtures.
- Use golden seeds for regression tests and keep fixtures intentionally small.
- Avoid hardcoded local filesystem paths in committed files.
