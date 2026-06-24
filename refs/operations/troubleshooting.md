# Troubleshooting

Known setup checks:

- If refs validation fails because `PyYAML` is missing, install it in the active Python environment.
- If a future generated map changes unexpectedly, compare seed, config, generator version, and golden seed output hash before assuming renderer failure.
- If a renderer/export visual differs from JSON data, treat the JSON/layer data as authoritative and inspect renderer mapping.
