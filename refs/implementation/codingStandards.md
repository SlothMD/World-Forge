# Coding Standards

- Keep generation logic, data schemas, rendering, export formats, and UI state in separate modules.
- Make the generator authoritative; UI renders state and dispatches explicit user actions.
- Route all randomness through deterministic seeded utilities. Never use platform randomness in generation paths.
- Keep generated values inspectable and serializable for golden seed tests.
- Prefer structured schemas and typed APIs over ad hoc string or object manipulation.
- Keep project package and JSON exports versioned and forward-compatible with safely ignorable unknown fields.
- Do not store secrets, credentials, private account details, or machine-only paths in `refs/` or committed project files.
- When adding game-specific outputs later, implement them as export profiles over core world data rather than separate generators.
