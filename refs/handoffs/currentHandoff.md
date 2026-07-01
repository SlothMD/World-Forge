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
- Generate now runs through a desktop/web Worker after startup and shows a live evolving preview, keeping the UI responsive during long High-resolution runs. The worker emits disposable low-resolution RGBA snapshots after major topology phases; the UI blits the latest transferred frame and drops stale frames rather than making generation wait for rendering.
- Biome legend now includes deep ocean, ocean, and shallow shelf colors. Shallow shelf color was shifted away from ambiguous cyan, and river overlays stop at water cells in map/globe presentation.
- Biome map rendering now has a view-only coastline treatment dropdown: `Bare coast`, `Toned coast`, and `Outlined coast`. Toned/outlined modes use landward edge-lighting plus water-side shelf/darkening derived from water adjacency; outlined adds a fine coast stroke. This is presentation only and should stay separate from future border overlays.
- Added first post-generation hex tile export slice. The exporter can emit an aligned pointy-top odd-row hex-grid SVG and a structured hex tile JSON dataset sampled from topology facts, with editable dimensions, corrected Civ 7 size presets, and a configurable Civ 7-style terrain/feature profile. Hex tile JSON distinguishes minor river edges from navigable river centers, and the SVG shows fallback hill/mountain/cliff/river symbology with native hover titles for terrain/features/elevation.
- Added first VTT-agnostic export slice under the same right-panel export tab. The VTT ZIP contains a rendered PNG map, a composited map-with-grid PNG when grid is enabled, JSON metadata, and an optional transparent pointy-top hex SVG overlay with selectable image resolution and hex size in miles. The UI now shows read-only VTT grid hex counts and hex-tile scale in miles.
- Hex tile export now routes named generated river paths onto the hex grid before using raw river strength, so navigable rivers draw edge-to-center/edge segments instead of a center-only icon. Exported tiles now include `featureDetails`, `navigableRiverEdges`, and `ridgeEdges`; SVG hover exposes these fields, and ridge edges draw hachure marks.
- Lake translation bug fixed: topology lake cells now export as Marine/Lake even when the underlying surface-water layer is not ocean water. Seed `2883711` is covered by regression checks for Lake, Plains, Tropical, ridges, and navigable river edges.
- Navigable river SVG strokes are now substantially heavier than minor rivers, and named river path drawing stops at Lake/Marine tile edges rather than drawing into lake tiles.
- JSON and `.wforge` browser download reliability was improved by attaching the temporary download anchor to the document and delaying object URL revocation.
- JSON/`.wforge` export buttons now show explicit export progress/status immediately. Browser JSON export uses compact JSON, and `.wforge` packages no longer duplicate layer payloads in both `project.json` and layer files; imports support both slim packages and older embedded-layer packages.
- Export buttons now track progress per button rather than using a shared overlay: the clicked button locks, greys, fills as progress advances, then briefly shows Done/Error without blocking the rest of the map UI.
- River tile translation now treats navigable rivers as downstream named-path segments rather than scalar river-strength spikes. This keeps upstream stretches/minor tributaries visible as minor river edges and prevents old high-source river-strength data from promoting sources to navigable rivers.
- River plausibility root cause: core topology hydrology was producing valid ocean/lake/wetland termini, but hex export was using projected raster river paths and scalar river strength, which introduced apparent dead ends at coarse tile sizes. Named rivers now persist `topologyPath`; hex export routes from authoritative topology cells, forces coarse terminal mouth tiles to Lake/Coastal when projection would otherwise sample land, and prunes low flat one-edge source stubs.
- Polar ice striping root cause: topology ice used a hard latitude threshold. Ice assignment now uses noisy spherical latitude thresholds plus neighbor cleanup, and hex SVG export draws snow/ice overlay marks so polar ice survives tile export.
- App startup no longer auto-generates the default world. The seed/config controls are prefilled, the map starts in an empty ready state, and `.wforge` imports still populate the project immediately.
- Added a left-panel configuration gear that opens a content configuration modal. Initial configurable categories are Biomes, Tiles, Features, and Resources, each with sets/packs, default set marking, member browsing, copy-to-set behavior, mapping-rule display, preview colors, and image/texture/icon attachment slots. Defaults capture the current biome rules, Civ 7-style tile/feature vocabularies, and an initial Civ 7 resource-name pack.
- Added lightweight user awareness and persistence. The app now creates a local profile, persists generation config/content library assets/hex export settings/saved maps locally, and defaults `Keep data synced` on under the Config > Sync tab.
- Cloud sync now targets the existing EcoMoguls-style service contract: `POST /api/identity/register`, `PATCH /api/identity/me`, then authenticated `GET`/`PUT /api/world-forge/user-sync/{profileId}` using `X-Player-Id` / `X-Player-Token`. This avoids coupling the app to a final premium/provider SDK.
- Login now falls back to a durable local-only profile if a configured service URL is missing or returns 404, so relaunching on the same computer keeps the user logged in. Service-backed sync still requires the backend routes.
- The main profile control is now a compact status pill. Fresh profiles show `Not Logged In`; provider IDs are not manually editable in Config. Google sign-in uses Google Identity Services when `VITE_GOOGLE_CLIENT_ID` is configured, and Steam builds can link an injected `window.__WORLD_FORGE_STEAM_IDENTITY__` value at launch.
- Saved map persistence is metadata-only for now. Full High-resolution project payloads exceeded browser localStorage quota and caused a blank-page crash; full saved-map sync needs IndexedDB and/or backend blob storage.

Important architecture change:

- Accepted direction is global-topology-first generation: generate authoritative world facts on topology cells with spherical coordinates, adjacency, distances, and area weights, then project to equirectangular or other map views.
- The current full generation pipeline is now mostly topology-native for plates, elevation, water, climate/wetness, hydrology, lakes, ice, biomes, and rivers. Projected raster layers should be treated as preview/export artifacts.
- Do not spend effort on seam/polar patching as a primary strategy; fix authoritative topology data first, then improve projection sampling where artifacts are view-only.
- User identity/sync is local-first from the implementation side, but user-light from the product side: hosted builds should preconfigure `VITE_WORLD_FORGE_SERVICE_URL` and `VITE_GOOGLE_CLIENT_ID`, keep sync on by default, and automatically sync after provider sign-in.

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
- `npm run typecheck`, `npm test`, and `npm run build` pass after the hex tile export slice and tab move. Test suite currently has 20 passing tests. Playwright smoke verified the Hex Tile Export tab and first-row SVG hex alignment.
- Playwright smoke verified empty startup without generation, opening the content configuration modal, and generating from the empty startup state.
- `npm run typecheck`, `npm test`, and `npm run build` pass after the local profile/cloud-sync slice. Test suite currently has 27 passing tests across package and desktop test files.
- Playwright login smoke verified clean local sign-in and stale app-origin service URL fallback: both persist a `local-` profile after reload, show the compact local profile pill, and clear the prior `Service request failed (404)` warning.
- Playwright smoke verified a fresh profile pill displays `Not Logged In` and the sync config no longer exposes manual Google ID or Steam ID text boxes.
- `npm run typecheck` and `npm test` pass after the coastline/VTT export slice. Test suite currently has 28 passing tests. VTT exporter tests cover metadata and hex-grid SVG output.
- Playwright smoke verified the visible `Filter` label was removed, the coastline treatment dropdown works, and bare versus outlined coast changes rendered map pixels.
- `npm run typecheck` and `npm test` pass after the live generation preview slice. Test suite currently has 29 passing tests. Playwright smoke verified Large generation shows a nonblank `Generating map preview` canvas and stage labels before final render.
- `npm run typecheck` and `npm test` pass after the VTT/hex export correction slice. Test suite currently has 30 passing tests. Playwright smoke verified the VTT ZIP contains `vtt-map.png`, `vtt-map-grid.png`, `vtt-grid.svg`, and metadata with mile-based hex sizing.
- Playwright smoke verified the VTT miles field supports clear/type editing, readouts show grid counts and tile scale, and downloaded hex SVG includes hover metadata plus terrain markings.
- `npm run typecheck` and `npm test` pass after the hex terrain/vocabulary/ridge pass. Test suite currently has 31 passing tests.
- Browser smoke on local dev verified JSON and `.wforge` downloads for seed `2883711` at 256x128: `World-2883711.json` about 13.0 MB and `World-2883711.wforge` about 4.3 MB.
- `npm run typecheck`, `npm test`, and `npm run build` pass after the topology-path river export and noisy polar ice pass. The hex endpoint diagnostic across QA seeds `2883711`, `7772599`, `5985700`, `1404958`, and `6096962` showed zero suspicious visible river endpoints at 60x38 after pruning.
- Browser smoke on local dev verified the actual JSON and `.wforge` buttons at 512x256 after the slim-package export fix: compact JSON about 23.4 MB, `.wforge` about 8.9 MB, with visible export progress.
- Attached seed/package `7477202` imported successfully from `C:\Users\sloth\Downloads\World-7477202.wforge`. Current 106x66 hex export now reports 122 minor-river tiles and 35 navigable-river tiles; minor inner stroke is about 1.05px and navigable inner stroke about 3.55px. Endpoint diagnostic showed zero suspicious endpoints at 60x38, 84x54, and 106x66.
- Browser smoke verified `.wforge` per-button progress for seed `7477202`: button showed running percent, downloaded `World-7477202.wforge`, then showed Done.
- Playwright generate-after-sync-persistence smoke verified map generation no longer blanks the page after localStorage quota handling was hardened.
- Browser smoke verified left-panel tabs, fast generation, in-app save to `My Worlds`, reload, and in-app load. `npm run typecheck`, `npm test`, and `npm run build` pass after the My Worlds and river-enrichment slice.
- Latest QA: visible rivers now look logically connected with no obvious orphan endpoints, but river density can be too scarce and concentrated in one drainage-heavy region. Volcanoes are still not visible; verify whether the generator is producing them at all, then add map/globe/hex indicators.
- YnAMP sanity check source: `D:\Apps\ynamp1.1.4\ynamp\modules\maps`. Their scripts are useful references for Civ 7 integration surfaces: terrain/biome/feature/resource stamping through builder APIs, natural wonder and volcano placement, regional resource filtering/replacement, true/cultural start handling, discoveries, plot tags, landmass region IDs, and builder validation. Future World Forge Civ 7 script output should emit these concepts from neutral world facts rather than hardwire Civ-specific logic into core generation.
- Product direction after YnAMP review: World Forge should stay centered on the generic world generator. Civ 7 should become a target-specific downstream pipeline/fork that consumes neutral generated world facts, then performs game-specific map-script validation, balancing, API calls, and mod packaging. The same architecture should support later non-Civ targets.
- Rivers, volcanoes, resources, wonders, homeland/distant land, and discovery-like content should be authoritative world semantics, not renderer-only visuals. Civ-specific labels such as natural wonders, discoveries, true starts, or regional resources should map from generic layers where possible.
- Left panel now has `Generator` and `My Worlds` tabs. `My Worlds` provides in-app save/load/remove backed by IndexedDB for full serialized world payloads; localStorage still holds identity, config, content assets/settings, hex export settings, and saved-world metadata. SQLite is not in use yet.
- Hex tile export now enriches minor river translation by allowing strong raw topology river signal to produce minor river edge semantics before endpoint pruning. Seed `2883711` at 84x54 reported 147 river-bearing tiles, 283 minor river edges, and 18 navigable river edges in the latest spot check.

## Known Gaps

Final product name and package extension are still placeholders. The Tauri identifier currently uses `com.slothmd.worldforge` and should be revisited when branding is final.

Visual quality has improved, but final art direction and generated app icons are still placeholder-level.

The main architectural gap is now projection quality and richer process modeling. Raster layers should remain projected artifacts only; reintroducing raster-authoritative rules would be a dead end for globe, tile, hex, VTT, engine, and regional exports.

Other flagged landmines:

- Renderer-derived facts: overlays or styling must not become authoritative rivers, lakes, coasts, or biome data.
- Package/schema lock-in: `.wforge` and JSON need explicit world model versioning for topology data and projected artifacts.
- Fallbacks becoming hidden rules: performance and cleanup fallbacks should stay named, deterministic, measured, and tested.
- Export/game-rule coupling: resources, Civ-like data, VTT assumptions, and engine formats should remain export profiles over neutral world facts.
- Target-specific forks: Civ 7 script generation should not become the core model. It should consume a stable neutral world model and add game-specific constraints only at the adapter/export layer.
- Simplified moon/tide model: acceptable for now only if orbital fields remain replaceable by richer modeling.
- Civ 7 exact map-size dimensions and mod-script hooks are partially explored through YnAMP, but our future map-script exporter still needs a deliberate compatibility pass against the actual in-game API and mod packaging structure before treating the output as canonical.
- Content configuration is currently scaffolding/state in the app and shared defaults. Generation/export still use the existing hardcoded logic until the planned data-driven cutover.
- Cloud sync currently requires a compatible external service; the app implements the client contract and local persistence, but does not yet bundle/deploy the hosted backend. Minimum backend delta is documented in `refs/architecture/userSync.md`.
- Near-term export integration focus is VTT first-pass: generic VTT-ready map/grid/metadata outputs before platform-specific Foundry, Roll20, or Owlbear assumptions.
- Durable local saved-world storage is currently browser/Tauri webview storage: localStorage for small workspace metadata and IndexedDB for full saved world payloads. SQLite remains a candidate future native storage layer, especially before large asset libraries or heavier saved-map querying.

External reference note:

- `D:\Apps\ProceduralTerrains` was cloned from `ZyFou/ProceduralTerrains` for comparison. It is primarily a shader-driven terrain editor, not a tectonic world simulator, but useful ideas include serializable procedural layer stacks, CPU/GPU sampler parity, 3D sphere-domain noise, biome-weighted terrain recipes, triplanar planet coloring, cubemap/face export baking, and water/shoreline export masks.

Current benchmark sample after first optimization pass:

- 256x128: about 364 ms average, about 11.4% ice.
- 512x256: about 757 ms average, about 12.0% ice.
- 1024x512: about 1989 ms average, about 11.4% ice.
- 2048x1024 default seed `1001001`: about 23.7 seconds after the current optimization pass.

Current measured hotspots at 2048x1024 are crust-field generation, hydrology priority-flood/flow ordering, terrain primordial/enrichment/elevation passes, plate assignment, and climate.

Current interesting QA seeds:

- `2883711` - strong hex/VTT export target; useful for checking biome-colored tiles, river edge/center markers, cliffs, and mountain overlays.
- `5985700`
- `7772599` - heavy southeastern feathering and unclear river termination/readability.
- `1404958`
- `6096962`

## Next Useful Actions

1. Visually QA high-resolution 2048x1024 output after adjustable Region-count/multi-lobed continent updates.
2. Visually QA the primordial/plate-history pass at 2048x1024 and decide whether to keep/tune it before optimizing.
3. Continue optimizing high-resolution topology generation, now focused on crust-field and hydrology phases, while preserving the new primordial/plate-history visual quality.
4. Tone up coastline readability with a subtle shore halo/edge-light and shallow-shelf treatment, keeping it theme-driven and non-authoritative.
5. Add 2D map zoom/pan controls with reset-to-fit; export resolution should remain independent of viewport zoom.
6. Expand Globe view with atmosphere, clouds, sun/moon scene objects, day/night lighting, layer controls, and direct topology/cubed-sphere sampling where useful.
7. Code-split the Three.js globe viewer so 2D-only startup stays lightweight.
8. Add richer wind/current circulation as topology vector fields rather than raster-only visualization.
9. Refine topology-native terrain aging/weathering/glaciation with climate feedback loops.
10. Improve projection sampling from nearest-cell to interpolated topology sampling where visible artifacts appear.
11. Expand deterministic tests for topology data separately from projected-render/export tests.
12. Verify Civ 7 mod data for exact map-size dimensions and map-script APIs, then align the generic hex tile profile with the future in-game generation mod.
13. Cut generation/export logic over to content configuration sets, starting with biome thresholds and hex tile/profile mapping.
14. Add or deploy the thin cloud sync service matching `refs/architecture/userSync.md`, then test automatic cross-machine sync with real user content assets and saved maps.
15. Add missing feature config members: rough, volcano, and tropical.
16. Tune river density/distribution so coherent river networks appear across suitable landmasses rather than only in isolated drainage-heavy areas.
17. Add authoritative volcano generation plus map/globe/hex display/export indicators.
18. Add neutral world-wonder generation from distinctive generated geology, hydrology, climate, and biome facts.
19. Add neutral regional resource generation, then map it into Civ/VTT/game-dev export profiles later.
20. Add areas of interest and minor tribes as part of the later population/discovery loop.
21. Design homeland/distant-land classification over generated landmasses, with a deep-water separation pass after assignment.
22. Hand off secondary moon generation to a background process.
23. Add globe atmospheric overlay.
24. Build non-terrestrial terrain sets for moons and worlds outside the habitable zone.
25. Add a 3D terrain map view after texture/detail handling is robust enough for close inspection.
26. Longer-term: move detailed map finer-detail generation to a background process.
27. Decide final product name, desktop app identifier, package extension, and real app icon assets.
