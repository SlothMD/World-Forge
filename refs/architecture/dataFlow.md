# Data Flow

User input ranges and seed enter through UI, CLI, tests, or project load. The generator selects concrete values, creates solar system context, creates the primary world, computes map layers, and returns immutable project data. Renderers transform layers into visual output. Exporters write PNG, simplified SVG, JSON, or .wforge packages without mutating generated data.
