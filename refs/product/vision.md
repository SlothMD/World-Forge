# Product Vision

World Forge is a local-first worldbuilding map generator for game masters, writers, and game designers. Its promise is to generate believable, attractive, reproducible world maps from a coherent planetary model, then preserve the underlying structured data for future regional, tile, hex, VTT, game-engine, and game-specific outputs.

The MVP is not a hard science simulator and not a full setting generator. It focuses on natural geography: solar system context, one detailed primary world, plate-influenced elevation, oceans, temperature, wetness, rivers, biomes, ice, and clean exports.

Product priority: generated worlds should look and feel natural, plausible, and cohesive. First-pass performance is secondary to believable terrain formation and world coherence. Prefer implementing the physically motivated generation pipeline first, then add performance fallbacks or quality presets as concrete bottlenecks emerge.

Success means a user can generate a default world, trust that the same seed and config reproduce it, save/reopen a project, export PNG/SVG/JSON, and use the result as a tabletop campaign planning map.
