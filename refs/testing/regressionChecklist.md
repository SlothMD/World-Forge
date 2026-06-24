# Regression Checklist

- Same seed/config output hash remains stable unless generator version intentionally changes.
- Ocean target remains within the default +/- 5 percentage point tolerance.
- Rivers do not flow uphill or loop indefinitely.
- Renderer does not invent world facts missing from generated layer data.
- Exporters do not mutate generated world data.
- Project package versioning remains load-compatible or warns clearly.
