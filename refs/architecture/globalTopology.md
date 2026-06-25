# Global Topology Direction

World Forge should make global topology the authoritative model for primary-world generation before release. Equirectangular rasters remain useful for preview and export, but they should be projected artifacts.

## Recommendation

Start with a cubed-sphere topology unless implementation testing proves it unsuitable.

Rationale:

- It has straightforward deterministic construction and indexing.
- It avoids singular poles and full-width east-west seams.
- It maps naturally to square-ish local neighborhoods, which keeps erosion, flow, climate, and rendering resampling simpler than an irregular geodesic mesh.
- It is easier to tune and debug in TypeScript than a fully irregular spherical triangulation.
- It can still project to equirectangular, regional square maps, tiles, and future game/export formats.

Geodesic/icosphere remains attractive for more uniform cell shapes, but it has more complex adjacency, subdivision, indexing, and raster projection behavior. Treat it as the alternative if cubed-sphere artifacts become worse than geodesic implementation cost.

## Required Contracts

The shared topology API should expose:

- stable topology cell id
- face/local coordinate where applicable
- latitude and longitude
- 3D unit-sphere position
- approximate cell area
- neighbor cell ids
- spherical distance
- sampling from topology cells to projection pixels
- optional reverse lookup from projected pixel to nearest/interpolated topology cell

Generation code should consume those contracts instead of raw x/y raster loops.

## Migration Shape

1. Add topology types and deterministic topology construction.
2. Generate one scalar layer, such as elevation, on topology cells.
3. Project that topology layer to the existing equirectangular renderer.
4. Move water, climate, hydrology, ice, biomes, plates, and rivers one subsystem at a time.
5. Keep projected raster layers in packages only as compatibility/export artifacts.
6. Add world model version metadata so raster-backed prototype saves do not masquerade as topology-backed saves.

## Non-Goals

- Do not implement a physically complete planetary simulator before the topology migration.
- Do not add new export profiles before topology-backed core data exists.
- Do not let renderer overlays define authoritative geography.
