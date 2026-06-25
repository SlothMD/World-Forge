# Data Flow

User input ranges and seed enter through UI, CLI, tests, or project load. The generator selects concrete values, creates solar system context, creates the primary world, computes map layers, and returns immutable project data. Renderers transform layers into visual output. Exporters write PNG, simplified SVG, JSON, or .wforge packages without mutating generated data.

Near-term quality pipeline should become:

1. Generate raw high-resolution layers.
2. Add deterministic layered noise and plate-boundary perturbation before final terrain classification.
3. Apply planet-age-driven terrain evolution after tectonic uplift.
4. Run thermal weathering to soften slopes according to world age.
5. Run a simplified hydraulic erosion and sediment/deposition pass to carve drainage, form basins, build lowlands, and shape coastal shelves.
6. Run post-process smoothing/cleanup for elevation, water masks, wetness, and biomes.
7. Generate final hydrology after terrain has aged.
8. Keep high-resolution layers for export/package data.
9. Downsample or resample to the preview canvas for responsive UI display.

This should reduce the current chunky geometric look and speckled coastline feathering more effectively than simply increasing preview canvas size.

Generation quality principle: prioritize plausible, cohesive, natural-looking worlds over first-pass performance. Performance presets, fallback heuristics, and lower-quality preview modes should be added in response to measured bottlenecks rather than driving the initial terrain model.
