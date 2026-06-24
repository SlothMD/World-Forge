# Test Strategy

MVP testing should start with deterministic golden seeds and expand around the generator API before UI polish.

Core checks:

- Same seed and same config produce the same output hash.
- Ocean percentage lands within the default +/- 5 percentage point tolerance.
- Rivers descend or remain level only through explicit basin/lake handling.
- Biomes follow temperature, wetness, elevation, water, and ice rules.
- PNG, simplified SVG, JSON, and .wforge exports complete.
- Saved projects reopen with matching seed, config, solar system, selected values, and layer metadata.
