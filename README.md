# World Forge

Working-name local-first procedural world map generator for tabletop RPG worldbuilding.

Start points:

- `docs/prd/worldbuilder-map-generator-prd.md` for MVP product decisions.
- `refs/README.md` for the Agent-Academy project-memory harness.
- `refs/agents.yaml` for agent operating instructions.

## MVP App

Launch on Windows:

```powershell
.\launch.ps1
```

or double-click `launch.bat`.

Manual start:

```powershell
npm install
npm run dev
```

Then open `http://127.0.0.1:5173/`.

Validation:

```powershell
npm run validate
npm run build
```

Do not store secrets or machine-local credentials in this repository.
