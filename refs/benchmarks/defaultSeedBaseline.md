# Default Seed Performance Baseline

Date: 2026-06-25

Baseline seed: `1001001`

Primary QA resolution: `2048x1024` generation, `1024x512` detailed preview unless otherwise noted.

Committed milestone before this optimization pass: `4378ead Implement topology world generation and globe view`

## Baseline Before Optimization

Local focused benchmark for seed `1001001` at `2048x1024` after the topology/globe milestone:

- Total generation: about `38.8s`.
- Ocean: about `69.8%`.
- Named rivers: `51`.
- Main hotspots:
  - `topology.terrain.elevation`: about `17.1s`.
  - `topology.hydrology`: about `5.0s`.
  - `topology.terrain.enrichment`: about `4.3s`.
  - `topology.water.sea-level.final`: about `2.8s`.
  - `topology.water.sea-level.pre-aging`: about `2.6s`.
  - `topology.terrain.primordial`: about `2.3s`.
  - `topology.climate`: about `1.5s`.
  - `topology.plates.assign`: about `1.4s`.

## Current Baseline After Optimization

Local focused benchmark for seed `1001001` at `2048x1024` after the percentile/crust-field optimization pass:

- Total generation: `23676ms`.
- Ocean: `69.7%`.
- Ice: `1.0%`.
- Named rivers: `51`.
- Main hotspots:
  - `topology.terrain.crust-fields`: `7834ms`.
  - `topology.hydrology`: `4675ms`.
  - `topology.terrain.primordial`: `2426ms`.
  - `topology.terrain.elevation`: `2046ms`.
  - `topology.terrain.enrichment`: `1926ms`.
  - `topology.plates.assign`: `1444ms`.
  - `topology.climate`: `1424ms`.
  - `topology.terrain.aging`: `1004ms`.

Interpretation:

- This pass preserves the default-seed water and river counts while cutting local High generation from about `38.8s` to about `23.7s`.
- The largest safe win came from replacing full-array percentile sorts with fixed-bin histograms and avoiding expensive continent-lobe math outside each region influence.
- Hydrology is now the largest remaining process hotspot after crust-field generation. Further wins should be profiled carefully because priority-flood drainage and global flow ordering are part of the real hydrology model, not presentation cleanup.
- The desktop app now runs Generate in a Web Worker and shows a progress indicator for subsequent generations, so the UI remains responsive while the generator runs.

## QA Reference Seeds

Seeds identified for visual QA after the local profile/sync and saved-map persistence pass:

- `5985700`
- `7772599` - useful for checking heavy southeastern feathering and unclear river termination/readability.
- `1404958`
- `6096962`

Use these alongside default seed `1001001` when testing projection sampling, coastline readability, river termination display, and future map zoom/pan behavior.
