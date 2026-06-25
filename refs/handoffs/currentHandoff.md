# Current Handoff

## Current State

World Forge has a browser-testable and Tauri-packageable prototype as of 2026-06-25, but QA exposed enough projection/topology issues that the authoritative world model should be changed before release.

Implemented pieces:

- TypeScript-first package structure for shared types, generator core, renderer, exporters, and desktop/web app.
- Deterministic seeded generation with solar system context, moons, plate-like elevation, water, temperature, wetness, rivers, lakes/basins, biomes, ice, and metrics.
- Canvas map rendering with clean game-map palette and optional plate/rivers overlays.
- PNG, simplified SVG, JSON, and `.wforge` package export.
- `.wforge` package import/hydration.
- Golden seed tests and package roundtrip test.
- Resolution selector for fast/default/large map generation.
- Heightmap render toggle for elevation inspection.
- Planet-age-driven terrain aging with asteroid impacts, thermal weathering, hydraulic erosion/deposition, basin shaping, and coastal shelves.
- Layered terrain noise and plate-boundary perturbation to reduce visible Voronoi geometry.
- Post-process cleanup for water masks, wetness, and biome classification.
- Noise-influenced river routing and fallback carving.
- Separate generation, preview, and PNG export resolution controls up to 4096 x 2048.
- Configurable ocean percentage validation tolerance.
- Tauri v2 desktop shell and Windows MSI/NSIS packaging.
- Generation diagnostics with total runtime and per-phase timings.
- Repeatable generation benchmark script for 256x128, 512x256, and 1024x512 samples.
- QA-driven controls for plate count, river density, wider parameter ranges, biome legend, colored elevation, grayscale heightmap, and seam-aware river rendering.
- Preset dropdown for Earthlike, Waterworld, Archipelago, Desert World, and Pangea.
- Adjustable continent scale and island density ranges.
- Cubed-sphere topology construction in shared code with topology cell positions, latitude/longitude, area weights, and adjacency.
- Topology-backed plate assignment and initial elevation generation, projected into existing equirectangular preview/export layers.
- Topology elevation and plate layers are persisted in JSON and `.wforge` packages.
- Terrain cleanup after topology migration: plate identity is now a weaker elevation bias, plate boundaries are warped, intra-plate terrain uses multi-scale spherical fields, plateau/basin fields exist independent of plate id, and underwater impact craters are damped against provisional sea level.
- High-resolution QA baseline is important: user is primarily testing at 2048x1024, where plate geometry, landmass shape, river sparsity, and projection artifacts are more visible than at default preview resolution.
- Latest terrain pass decouples landmass/ocean shape from plate membership by using continent/island fields as the primary landmass driver. Plates now mainly contribute weaker bias and boundary deformation.
- Biome rendering darkens mountain ridge detail and brightens high/mountain ice for readability.
- Topology water masks, climate/wetness, hydrology, river accumulation, lakes, ice, and biomes are now generated on cubed-sphere topology layers and projected to the equirectangular renderer.
- Root-cause terrain fix: landmass generation now uses coherent spherical value noise plus deterministic farthest-spaced continental crust nuclei, rift/ocean-basin cuts, shelves, crust thickness, cratons, plate deformation, and smoothed topology elevation. This replaces hash-noise thresholding that caused speckle or supercontinents.
- Added regression coverage that the default app seed forms multiple continent-scale landmasses.
- Added adjustable Region count for continent/craton nuclei. Region footprints now scale down as count increases, and each region is multi-lobed and warped so high-resolution landmasses are less fixed, round, or regular.
- Added sharper shear-rift breakup and less aggressive crust-mask smoothing to reduce the remaining mask-driven look.
- Replaced local-sink river routing with topology priority-flood drainage. Rivers now route over a filled drainage surface, shallow depressions spill onward, real depressions become visible lake basins, and named river termini preserve ocean/lake/wetland classification.
- Added first topology-aware terrain enrichment pass inspired by ProceduralTerrains concepts: ridged detail, dry highland terrace/strata signal, and broad masked undulation are applied over authoritative topology terrain without replacing real hydrology or tectonics.
- Terrain generation now has a topology-native primordial pre-pass before plates/water: accretion-scale lumpy terrain, broad basins/highlands, crust age, crust thickness, and early impact scars are generated first.
- Plate generation now uses farthest-spaced sphere candidates as a Poisson-like seed set, then assigns warped/fractal Voronoi-like plate regions. Plate kind, density, age, and motion inherit from primordial crust fields.
- Plate boundary terrain interaction is now motion-aware: convergence, divergence, and shear produce different uplift/rift/fault effects before aging, weathering, erosion, climate, water, and hydrology run.
- Added first 3D globe viewer in the desktop app using Three.js. The globe uses the existing map renderer as an equirectangular texture and displaces sphere vertices from generated elevation, keeping 3D display as a view of existing world facts.
- Globe ocean geometry is now fixed at sea level using a subtle constant-radius ocean shell; seafloor bathymetry no longer displaces the visible ocean surface.
- Globe texture sampling now uses a 2048x1024 generated texture. Biome-mode globe view uses a dedicated presentation albedo texture with flatter oceans, shore tint, softer land colors, slope/rock shading, subtle grain, and optional rivers/plate edges.
- Submerged terrain vertices are pushed below the ocean shell so transparent water does not reveal raised seafloor facets as ocean hills.
- Globe land displacement is presentation-scaled and intentionally subtle; it should not use exaggerated diagnostic terrain heights.
- Further texture polish should move toward globe-specific normal/roughness/depth/cloud maps rather than reusing the inspection-map palette directly.
- Fixed `createDefaultConfig()` to deep-clone parameter ranges so tests/UI changes do not mutate global defaults.
- Stamped default seed `1001001` at `2048x1024` as the current High-resolution performance baseline in `refs/benchmarks/defaultSeedBaseline.md`.
- Optimized High-resolution generation by replacing full-array percentile sorts with fixed-bin histogram percentiles, splitting crust-field generation into its own diagnostic phase, and skipping continent-lobe math outside each region influence.
- Generate now runs through a desktop/web Worker after startup and shows an estimated progress indicator, keeping the UI responsive during long High-resolution runs.
- Biome legend now includes deep ocean, ocean, and shallow shelf colors. Shallow shelf color was shifted away from ambiguous cyan, and river overlays stop at water cells in map/globe presentation.

Important architecture change:

- Accepted direction is global-topology-first generation: generate authoritative world facts on topology cells with spherical coordinates, adjacency, distances, and area weights, then project to equirectangular or other map views.
- The current full generation pipeline is now mostly topology-native for plates, elevation, water, climate/wetness, hydrology, lakes, ice, biomes, and rivers. Projected raster layers should be treated as preview/export artifacts.
- Do not spend effort on seam/polar patching as a primary strategy; fix authoritative topology data first, then improve projection sampling where artifacts are view-only.

## Validation

Passing commands:

- `npm run build`
- `npm run benchmark:generation`
- `npm run tauri:build`
- Browser smoke screenshot via Playwright at `http://127.0.0.1:5173/`

Recent local validation notes:

- `npm run typecheck`, `npm test`, and `npm run build` pass after terrain enrichment and 3D globe viewer updates. Test suite currently has 18 passing tests.
- Playwright Chromium smoke checks passed for Globe view at 1280x800 and 390x844; both produced nonblank WebGL canvas pixels with no page errors.
- `npm run build` emits a large-chunk warning after adding Three.js; code-splitting the globe viewer is a useful follow-up but not a runtime blocker.
- High-resolution 2048x1024 diagnostic for seed `1001001` produced about 70.4% ocean, 35 named rivers, about 40.6k topology river-channel cells, no basin-terminating named rivers, and five substantial landmasses; generation took about 24.6 seconds locally.
- After the primordial/plate-history pass, high-resolution 2048x1024 diagnostic for seed `1001001` produced about 70.5% ocean, 51 named rivers, no basin-terminating named rivers, and seven substantial landmasses; generation took about 36.3 seconds locally. `topology.terrain.elevation` is now the major hotspot.
- After the first High-resolution optimization pass, seed `1001001` at `2048x1024` produced 69.7% ocean, 1.0% ice, and 51 named rivers in about 23.7 seconds locally. Current measured hotspots are `topology.terrain.crust-fields` at about 7.8 seconds and `topology.hydrology` at about 4.7 seconds.
- `npm run validate` is blocked locally until PyYAML is installed for `refs/tools/validate_refs.py`.

## Known Gaps

Final product name and package extension are still placeholders. The Tauri identifier currently uses `com.slothmd.worldforge` and should be revisited when branding is final.

Visual quality has improved, but final art direction and generated app icons are still placeholder-level.

The main architectural gap is now projection quality and richer process modeling. Raster layers should remain projected artifacts only; reintroducing raster-authoritative rules would be a dead end for globe, tile, hex, VTT, engine, and regional exports.

Other flagged landmines:

- Renderer-derived facts: overlays or styling must not become authoritative rivers, lakes, coasts, or biome data.
- Package/schema lock-in: `.wforge` and JSON need explicit world model versioning for topology data and projected artifacts.
- Fallbacks becoming hidden rules: performance and cleanup fallbacks should stay named, deterministic, measured, and tested.
- Export/game-rule coupling: resources, Civ-like data, VTT assumptions, and engine formats should remain export profiles over neutral world facts.
- Simplified moon/tide model: acceptable for now only if orbital fields remain replaceable by richer modeling.

External reference note:

- `D:\Apps\ProceduralTerrains` was cloned from `ZyFou/ProceduralTerrains` for comparison. It is primarily a shader-driven terrain editor, not a tectonic world simulator, but useful ideas include serializable procedural layer stacks, CPU/GPU sampler parity, 3D sphere-domain noise, biome-weighted terrain recipes, triplanar planet coloring, cubemap/face export baking, and water/shoreline export masks.

Current benchmark sample after first optimization pass:

- 256x128: about 364 ms average, about 11.4% ice.
- 512x256: about 757 ms average, about 12.0% ice.
- 1024x512: about 1989 ms average, about 11.4% ice.
- 2048x1024 default seed `1001001`: about 23.7 seconds after the current optimization pass.

Current measured hotspots at 2048x1024 are crust-field generation, hydrology priority-flood/flow ordering, terrain primordial/enrichment/elevation passes, plate assignment, and climate.

## Next Useful Actions

1. Visually QA high-resolution 2048x1024 output after adjustable Region-count/multi-lobed continent updates.
2. Visually QA the primordial/plate-history pass at 2048x1024 and decide whether to keep/tune it before optimizing.
3. Continue optimizing high-resolution topology generation, now focused on crust-field and hydrology phases, while preserving the new primordial/plate-history visual quality.
4. Expand Globe view with atmosphere, clouds, sun/moon scene objects, day/night lighting, layer controls, and direct topology/cubed-sphere sampling where useful.
5. Code-split the Three.js globe viewer so 2D-only startup stays lightweight.
6. Add richer wind/current circulation as topology vector fields rather than raster-only visualization.
7. Refine topology-native terrain aging/weathering/glaciation with climate feedback loops.
8. Improve projection sampling from nearest-cell to interpolated topology sampling where visible artifacts appear.
9. Expand deterministic tests for topology data separately from projected-render/export tests.
10. Decide final product name, desktop app identifier, package extension, and real app icon assets.
