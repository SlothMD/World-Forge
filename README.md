# World Forge

World Forge is an open procedural world-generation project for tabletop RPG settings, fiction, and simulation. It generates science-informed star systems and planets, then turns the primary world into an explorable globe with terrain, climate, biomes, rivers, and exportable world data.

## Recent development

- Expanded procedural solar-system and primary-world generation.
- Added interactive 3D globe rendering and surface inspection tools.
- Added saved-world workflows and PNG, JSON, binary, and `.wforge` exports.
- Added generation diagnostics and performance benchmarking.
- Continued work on graph-based terrain, hydrology, biome, and surface-classification systems.

World Forge is under active development. Generated results, file formats, and controls may change between preview builds.

## Install and run

### Manual start

```powershell
npm install
npm run dev
```

The development server opens on `http://localhost:5173/`. The private Parchment Worlds shell can also launch and embed this sibling checkout.

### Validate and build

```powershell
npm run validate
npm run build
```

## Roadmap

Near-term work focuses on improving physical plausibility, graph-based surface generation, biome and ocean classification, editing tools, diagnostics, and export reliability. The reusable generation engine and browser tool remain public; private product shell, account, roadmap, and deployment material stay in Parchment Worlds and Portfolio.
