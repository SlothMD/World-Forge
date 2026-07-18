# World Forge

World Forge is the public procedural world-generation tool for Parchment Worlds.

This repository is intentionally public and must not contain product secrets, private project data, deployment credentials, private roadmap material, or user-specific validation records.

## Local Development

```powershell
npm install
npm run dev
```

The local app runs at `http://localhost:5173/`. Parchment Worlds embeds it from the sibling private app during local development.

## Hosted Integration

Parchment Worlds builds this app and stages the static output under `/apps/world-forge/` during combined deployments.

The first integration contract passes non-secret project context through URL parameters:

- `contract`
- `projectId`
- `projectName`
- `revision`

Later slices will replace the placeholder app shell with the portable generation UI and a stricter message-based contract.
