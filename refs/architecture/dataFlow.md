# Data Flow

User input ranges and seed enter through UI, CLI, tests, or project load. The generator selects concrete values, creates solar system context, creates the primary world, computes map layers, and returns immutable project data. Renderers transform layers into visual output. Exporters write PNG, simplified SVG, JSON, or .wforge packages without mutating generated data.

Near-term quality pipeline should become:

1. Generate raw high-resolution layers.
2. Add deterministic layered noise and plate-boundary perturbation before final terrain classification.
3. Run post-process smoothing/cleanup for elevation, water masks, wetness, and biomes.
4. Keep high-resolution layers for export/package data.
5. Downsample or resample to the preview canvas for responsive UI display.

This should reduce the current chunky geometric look and speckled coastline feathering more effectively than simply increasing preview canvas size.
