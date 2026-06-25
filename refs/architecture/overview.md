# Architecture Overview

World Forge should be built library-first. The generation engine owns deterministic world facts, the renderer visualizes those facts, exporters serialize them, and the UI coordinates user intent without embedding procedural rules.

Primary world generation should use a global topology as the authoritative backing model. Equirectangular output is a projection of that model, not the model itself. Generation modules must ask for cell adjacency, spherical coordinates, area weights, distances, and layer samples through shared APIs so equirectangular, geodesic, hex, square tile, Civ-like, VTT, Godot, Tiled, and regional outputs can resample the same world facts.

Near-term implementation may keep raster preview/export layers, but those layers are derived views. They must not own tectonics, climate, hydrology, ice, biome, or river truth. This avoids seam workarounds, polar distortion artifacts, and export dead ends.

Core boundaries:

- `packages/generator-core`: seed, config, solar system, primary world, plates, elevation, climate, hydrology, biomes, ice.
- `packages/shared`: shared types, schema validation, units, topology contracts, coordinate helpers, projection sampling.
- `packages/renderer`: canvas and SVG rendering from generated layers, with configurable palettes.
- `packages/exporters`: .wforge package, PNG, simplified SVG, JSON, and future profile exporters.
- `apps/desktop`: Tauri shell and frontend state only; no procedural generation rules.

The renderer must not create world facts missing from the data model. Exporters must not mutate generated worlds. UI must not own generation logic.
