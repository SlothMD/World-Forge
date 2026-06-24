# Framework Maintenance

Use this guide when changing the reusable refs harness itself. Do not add project-specific facts to the framework.

## Add a Refs File

1. Add the file under the most specific existing `refs/` folder.
2. Include `version: 1` and `schema: refs/schemas/schemaRegistry.yaml` for YAML files.
3. Use `TEMPLATE_TODO` and `TEMPLATE_TODO_DATE` for intentional blanks.
4. Document the file in `refs/fileGuide.yaml`.
5. Add schema hints in `refs/schemas/schemaRegistry.yaml` if the file is structured YAML.
6. Add the file to `refs/templatePolicy.yaml` if it is required or has special placeholder rules.

## Update Schemas

Schema hints should stay simple and stable. Prefer required top-level keys and allowed status values over highly specific project rules.

## Versioning

Keep existing paths stable whenever possible. When a breaking layout change is unavoidable, update this file with a migration note and preserve compatibility guidance for projects that already copied the harness.

## Migrations

Migration notes should include the old path, new path, reason for change, and the safest copy/update sequence. Avoid destructive instructions.
