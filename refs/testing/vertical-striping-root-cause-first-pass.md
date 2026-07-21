# Vertical Striping Root-Cause First Pass

Date: 2026-07-21

Status: Strong primary hypothesis. No generation correction applied yet.

Reference case:

- App version: `0.3.8`
- World seed: `1001001`
- Star seed: `2850873`
- Output resolution: `2048 x 1024`
- Topology resolution: `512`
- Source artifact: user-supplied `World 1001001.wforge`

## Executive finding

The globe renderer is not the first owner of the defect.

The saved projected elevation layer already contains the vertical bands, arcs, and moire-like structures. The saved topology plate layer contains the same structural pattern before equirectangular projection. The strongest current root-cause hypothesis is the non-coherent per-cell `sphericalNoise` used while assigning plate ownership.

That plate-assignment noise fragments 23 intended plates into roughly 130,000 tiny disconnected components. Deep-time fragment placement then treats those components as real continental fragments, moves and collides them, and applies terrain response across most of the topology. This amplifies the plate-assignment aliasing into authoritative elevation, coast, biome, and final-render striping.

## Evidence from the saved world

### The defect exists before rendering

The `.wforge` package contains both projected and topology-native layers.

- `layers/elevation.json` contains the visible vertical bands and curved grid structures.
- `topology-layers/elevation.json` contains the same family of structures in topology-native face layout.
- `topology-layers/plates.json` shows severe speckling, narrow bands, arcs, and moire patterns inside broad intended plate territories.

The equirectangular projection is a nearest-topology-cell copy. It adds blockiness when a 512 topology is displayed at 2048 x 1024, but it does not create the underlying bands.

### Plate topology is catastrophically fragmented

Direct measurements from the saved topology plate layer:

- Intended plate count: `23`
- Within-face plate-boundary cell share: approximately `56.8%`
- Face-local connected components: approximately `209,000`
- Face-local median connected-component size: `1` cell
- Face-local mean connected-component size: approximately `7.5` cells

The face-local component count overcounts components crossing cube-face edges, but the deep-time diagnostics independently confirm the same product-level failure:

- Initial lineage seed or moving fragment count: `132,854`
- Final fragment count: `116,054`
- Mean final fragment size: `9.11` cells
- Continental fragment boundary share: `48.8%`
- Direct-transform collision cell share: `27.7%`
- Ownership-changed cell share: `37.1%`
- Terrain response applied to `67.3%` of topology cells
- Landmass count increased from `6,448` before aging to `27,012` after reconciliation

Those values describe a plate map behaving as cell noise, not as 23 coherent tectonic plates.

## Code path

`packages/generator-core/src/graph/nodes/plate-construction-node.ts` assigns every topology cell to the highest-scoring plate.

The base score is the spherical dot product to the plate center. It is perturbed by two calls to this function:

```ts
function sphericalNoise(x: number, y: number, z: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}
```

This is a hash-like signal, not coherent spatial noise. Adjacent topology cells can receive sharply different values. Sampling the continuous cubed-sphere coordinates through the sine hash also produces structured aliasing and moire rather than clean independent jitter.

The combined warp amplitude can reach `0.115`. Across broad near-tie zones between plate-center scores, that is enough to repeatedly flip ownership between neighboring plates.

The current plate-node validator checks plate count, nonempty output, valid motion vectors, plate kind, and valid IDs. It does not check plate cohesion, disconnected-component count, boundary density, one-cell islands, or spatial aliasing.

## Reconstruction experiment

A local reconstruction used the saved plate metadata and the current plate-assignment formula. The saved plate layer is post-deep-time and plate centers are rounded, so this is not an exact replay. It is sufficient to compare the spatial behavior of assignment strategies.

### Current raw hash warp

- Within-face boundary share: approximately `51.1%`
- Face-local connected components: approximately `173,100`
- Mean component size: approximately `9.09` cells
- Median component size: `1` cell

This independently reproduces the same tiny-fragment shape reported by the saved deep-time diagnostics.

### No boundary warp

- Within-face boundary share: approximately `1.27%`
- Face-local connected components: `49`
- Mean component size: approximately `32,099` cells

### Coherent value-noise warp at the current frequencies and amplitudes

- Within-face boundary share: approximately `1.43%`
- Face-local connected components: `59`
- Mean component size: approximately `26,659` cells

The coherent replacement retains irregular boundaries without pulverizing each plate into cell-sized fragments.

## Root-cause chain

Current best explanation:

1. Plate centers are selected normally.
2. Raw sine-hash `sphericalNoise` is evaluated independently for every cell and every candidate plate.
3. Near plate boundaries, adjacent cells repeatedly switch ownership in aliasing patterns.
4. Plate ownership becomes highly disconnected and anisotropic.
5. Deep-time fragment lineage captures more than 130,000 tiny components as authoritative moving fragments.
6. Direct placement, collision handling, margin detection, and terrain response amplify those components into elevation changes across most of the world.
7. Climate, water, hydrology, and biomes rebuild from the corrupted final elevation.
8. Nearest-cell equirectangular projection and globe rendering make the topology artifacts more visible but do not originate them.

## Recommended confirmation experiment

Use the existing fixed seed and add a plate-construction diagnostic switch with three modes:

1. Current raw hash warp.
2. No warp.
3. Coherent spherical value-noise warp.

Capture after `plates.construct` and after final deep-time reconciliation:

- plate component count
- largest-component share per plate
- plate-boundary cell share
- one-cell and sub-16-cell component share
- fragment count and mean fragment size
- direct-transform collision share
- ownership-changed share
- terrain-response cell share
- topology elevation image
- projected elevation image
- Natural View, Globe, and export image

Run at topology resolutions 128, 256, and 512 for the reference seed plus at least three additional fixed seeds.

## Preferred remediation direction

Replace the raw hash warp with a coherent, bounded boundary perturbation.

A safe progression is:

1. Use no warp as the control and prove the striping disappears.
2. Replace raw `sphericalNoise` with coherent 3D value noise or another topology-safe coherent field.
3. Tune amplitude only after plate-cohesion diagnostics pass.
4. Add node validation that rejects pathological fragmentation.
5. Re-run deep-time model and quality checks because the correction intentionally changes generated worlds.

This is expected to be a version-changing generation correction. Exact replay remains required only inside the recorded compatible version set.

## Suggested validation guardrails

Do not lock final thresholds until several presets and resolutions are measured. Candidate checks include:

- Largest connected component for each meaningful plate contains most of that plate's cells.
- Total component count remains within a small multiple of plate count.
- Median component size is materially larger than one cell.
- Plate-boundary cell share remains plausible rather than approaching half the topology.
- Fragment-history count is proportional to actual continental breakup, not topology cell count.
- No dominant longitude-aligned or cube-lattice spectral spikes appear in plate, elevation, biome, or export layers.

## Secondary item to isolate

`cubedSphereNeighbor` appears to step beyond cube-face edges using global Cartesian X/Y offsets rather than face-local U/V axes. That deserves a focused face-edge adjacency test. It may contribute to face-edge seams or incorrect cross-face continuity, but it does not explain the widespread interior striping and should not be mixed into the first plate-noise confirmation patch unless tests prove direct coupling.
