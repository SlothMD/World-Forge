# Data Flow

User input ranges and seed enter through UI, CLI, tests, or project load. The generator selects concrete values, creates solar system context, creates the primary world on an authoritative global topology, computes topology-attached world facts, projects those facts into map layers, and returns immutable project data. Renderers transform projected layers into visual output. Exporters write PNG, simplified SVG, JSON, or .wforge packages without mutating generated data.

Near-term quality pipeline should become:

1. Build deterministic global topology cells with spherical coordinates, area weights, and adjacency.
2. Generate plates, elevation, water, climate, hydrology, ice, and biomes on topology cells.
3. Add deterministic layered noise and plate-boundary perturbation in spherical/topology space before final terrain classification.
4. Apply planet-age-driven terrain evolution after tectonic uplift.
5. Run thermal weathering to soften slopes according to world age.
6. Run a simplified hydraulic erosion and sediment/deposition pass to carve drainage, form basins, build lowlands, and shape coastal shelves.
7. Generate final hydrology after terrain has aged.
8. Project topology facts into equirectangular preview/export layers and later into tile, hex, engine, or VTT profiles.
9. Downsample or resample projected layers to the preview canvas for responsive UI display.

This should reduce seam handling, polar artifacts, chunky geometric look, and speckled coastline feathering more effectively than simply increasing preview canvas size.

Generation quality principle: prioritize plausible, cohesive, natural-looking worlds over first-pass performance. Performance presets, fallback heuristics, and lower-quality preview modes should be added in response to measured bottlenecks rather than driving the initial terrain model.
