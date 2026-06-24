# Architecture Overview

World Forge should be built library-first. The generation engine owns deterministic world facts, the renderer visualizes those facts, exporters serialize them, and the UI coordinates user intent without embedding procedural rules.

MVP uses a wrapped equirectangular sample grid as the backing model, accessed through projection-neutral coordinate helpers. Generation modules must ask for latitude, longitude, neighbors, wrapped distance, and layer samples through shared APIs so future geodesic, hex, square tile, Civ-like, VTT, Godot, Tiled, and regional outputs can resample the same world model.

Core boundaries:

- `packages/generator-core`: seed, config, solar system, primary world, plates, elevation, climate, hydrology, biomes, ice.
- `packages/shared`: shared types, schema validation, units, coordinate helpers.
- `packages/renderer`: canvas and SVG rendering from generated layers, with configurable palettes.
- `packages/exporters`: .wforge package, PNG, simplified SVG, JSON, and future profile exporters.
- `apps/desktop`: Tauri shell and frontend state only; no procedural generation rules.

The renderer must not create world facts missing from the data model. Exporters must not mutate generated worlds. UI must not own generation logic.
