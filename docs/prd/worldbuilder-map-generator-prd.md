# Worldbuilder Map Generator PRD

Updated: 2026-06-24

Working product name: World Forge

Note: World Forge is a crowded namespace. Keep this as a working name until branding is addressed. Use `.wforge` as the working project package extension.

## Product Summary

Build a local-first procedural world map generator for tabletop RPG worldbuilding. The MVP creates one detailed primary planet map with shallow solar system context, deterministic seed-based generation, configurable parameter ranges, plausible natural geography, attractive clean game-map exports, and structured data suitable for future playable map formats.

The product is not a hard science simulator. It should use simplified, documented physical systems to produce believable worlds that are useful to GMs, writers, and game designers.

## MVP Must Deliver

- One detailed primary world map.
- Full but shallow solar system context.
- Seed-based deterministic generation.
- Min/max parameter ranges with Earth-like defaults.
- Continents, oceans, plate-like regions, mountains, temperature, required rainfall/wetness, rivers, biomes, ice caps, and simple moon influence.
- East-west world wrapping.
- Clean game-map visual style.
- PNG export.
- Simplified SVG export.
- Structured JSON export.
- `.wforge` project package save/load.
- Developer-only CLI/tooling for golden seeds and batch validation.

## Architecture Decisions

### Internal Map Model

MVP should use a global topology as the authoritative primary-world model, accessed through projection-neutral world-coordinate helpers. Equirectangular output at default `2048x1024` is a projected preview/export layer, not the generation backing model.

Generation systems must use shared APIs for topology cell ids, latitude, longitude, area weights, neighbors, distances, layer sampling, and projection resampling. Do not bind domain logic directly to rendered pixels.

This avoids equirectangular seam/polar artifacts and preserves support for:

- square tile maps
- hex maps
- Civ-like map scripts
- Godot and Unity data
- Tiled exports
- regional crops
- VTT image maps
- spherical/globe renderers
- geodesic or cubed-sphere sampling

### Stack

Use a TypeScript-first architecture:

- core generation library independent of UI
- shared schemas/types/units/coordinate helpers
- renderer package
- exporter package
- Tauri desktop shell later

Rust is optional and deferred until profiling proves a need.

### Boundaries

- Generator owns world facts.
- Renderer visualizes generated facts.
- Exporters serialize generated facts and do not mutate worlds.
- UI coordinates user intent and never owns procedural generation rules.
- Randomness flows only through deterministic seeded utilities.

## MVP Generation Scope

Required:

- star type
- solar system age
- list of major bodies
- primary world orbital placement
- moons
- visible celestial bodies
- moon-derived tide/climate influence scalar
- primary world size or radius class
- mass or mass class
- ocean percentage
- sea level
- axial tilt
- orbital eccentricity
- elevation
- plate regions and boundary effects
- temperature
- rainfall/wetness
- hydrology and rivers
- basin/lake termination where emergent
- biomes
- ice caps

Deferred:

- political borders
- settlements
- roads
- trade routes
- labels and names beyond simple world/project placeholder
- AI lore
- direct map editing
- VTT-native exports
- Civ 7 implementation
- natural resources
- polished multi-theme UI

## Hydrology And Lakes

Lakes should be emergent from hydrology, not hand-authored map decoration.

MVP requirement:

- Rivers flow downhill.
- Rivers terminate in oceans, basins, lakes, or wetlands when supported by the generated elevation and hydrology.
- Closed basin/lake handling may be simple but must prevent impossible uphill river paths and loops.
- Lake rendering can be minimal in MVP.

## Moon Influence

Moons must influence plausibility in MVP through simple generated values.

MVP requirement:

- Generate moon count and moon descriptors.
- Compute a tide/climate influence scalar from moon data.
- Use the influence modestly in coastal wetland/tidal/coastal climate behavior or world summary.
- Preserve data fields for richer post-MVP tide and climate modeling.

Full orbital mechanics and detailed tide simulation are post-MVP.

## User Controls

MVP parameter controls must include:

- seed
- system/world age
- ocean percentage
- average temperature
- aridity/wetness
- sea level
- axial tilt
- orbital eccentricity
- size/mass class where practical

Rules:

- User can manually enter and copy seed.
- User can randomize seed.
- User can regenerate with same seed and changed settings.
- User can regenerate with new seed and same settings.
- Min must be less than or equal to max.
- Final selected generated values must be stored with input ranges.

Ocean percentage target tolerance defaults to +/- 5 percentage points. The tolerance should become configurable later.

## Project Persistence

MVP save format is a zipped project package with working extension `.wforge`.

Package should contain:

- manifest JSON
- app version
- generator version
- schema/export version
- seed
- input ranges
- selected generated values
- solar system data
- primary world data
- layer files or layer references
- export metadata

JSON export remains required as a clean standalone handoff format.

## Rendering And Themes

MVP visual target: clean game-map style.

MVP ships one polished palette. Renderer architecture must support configurable palettes/themes later.

Rendering rules:

- No labels in MVP.
- No direct map editing in MVP.
- Map must wrap east-west logically.
- Biomes and major terrain must be visually distinguishable.
- Map layer state should not rely on color alone where controls or summaries can provide supporting metadata.

SVG export may be simplified/vectorized. PNG is the primary fidelity export.

## UI Standards

Follow TWS UI guidance:

- compact, information-dense layouts
- stable panels and controls
- obvious next legal/relevant actions
- small ordinary buttons, not oversized filler buttons
- semantic components backed by tokens
- keyboard-accessible primary controls
- hover/focus/tap inspect equivalents
- no player-facing internal development labels
- map view should claim the available viewport

## Acceptance Criteria

MVP is acceptable when:

- User can generate a default world.
- Same seed and same config reproduce the same world data.
- Default worlds are usually broadly habitable.
- Ocean percentage is within default +/- 5 percentage points unless tolerance is changed later.
- Mountains correlate with plate-like boundary effects.
- Rivers flow downhill and terminate logically.
- Biomes correlate with temperature, wetness, elevation, water, and ice.
- Moons contribute simple tide/climate influence.
- World wraps east-west.
- User can save and reopen a `.wforge` project.
- User can export PNG, simplified SVG, and JSON.
- JSON includes seed, config, solar system, primary world, and map/layer data.
- Generator logic is separated from UI logic.
- Export logic is separated by format/profile.
- Core data model does not prevent future tiled, hex, VTT, engine, or game-specific outputs.

## First Implementation Slices

1. Slice 0: deterministic seeded generation, wrapped grid, basic elevation, land/water split, PNG export, JSON config export.
2. Slice 1: solar system stub, primary world config, ocean percentage, sea level, simplified plates, plate-influenced elevation, save/load, map viewer.
3. Slice 2: temperature, wetness/rainfall, rain shadows, hydrology, rivers, basin/lake termination, ice, biomes.
4. Slice 3: polished PNG, simplified SVG, JSON schema docs, `.wforge` project package, summary panel, parameter ranges, golden seed tests.
5. Slice 4: optional structured exports after MVP fundamentals are stable.
