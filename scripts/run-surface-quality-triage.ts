import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultConfig } from '../packages/generator-core/src/index';
import { generateProjectWithNativeStages } from '../packages/generator-core/src/nativeStagePipeline';
import { prepareSystemOrbitConfig, reconcileSystemOrbitPresets } from '../packages/generator-core/src/systemOrbitPreset';
import {
  biomeNames,
  buildCubedSphereTopology,
  buildSurfaceStructureClassification,
  surfaceElevationBands,
  surfaceMorphologies,
  type GenerationConfig,
  type SelectedValues,
  type WorldProject
} from '../packages/shared/src/index';
import { APP_VERSION } from '../apps/desktop/src/appVersion';

type Resolution = { width: number; height: number };
type Profile = {
  id: string;
  label: string;
  selectedValues?: Partial<SelectedValues>;
};
type TriageCase = {
  seed: string;
  starSeed: string;
  resolution: Resolution;
  profile: Profile;
};
type TriageReport = {
  version: 1;
  appVersion: string;
  generatedAt: string;
  options: {
    seeds: string[];
    starSeeds: string[];
    seedPairs?: string[];
    resolutions: string[];
    profiles: string[];
  };
  results: TriageResult[];
};
type TriageResult = {
  caseId: string;
  seed: string;
  starSeed: string;
  profileId: string;
  profileLabel: string;
  resolution: string;
  topologyResolution?: number;
  topologyCells?: number;
  totalMs: number;
  metrics: {
    oceanPercentage: number;
    icePercentage: number;
    riverCount: number;
  };
  surface: {
    reliefCharacter: string;
    highestElevationBand: string;
    highestElevationAboveSeaLevel: number;
    elevatedLandShare: number;
    ruggedOrMountainousShare: number;
    mountainousLandShare: number;
    elevationBandShares: Record<string, number>;
    morphologyShares: Record<string, number>;
    meanSlope: number;
    p90Slope: number;
    meanLocalRelief: number;
    p90LocalRelief: number;
    elevationDrivenTreelineShare: number;
    elevationDrivenSnowlineShare: number;
  };
  tectonics: Record<string, number | string | boolean>;
  seams: {
    projectedBiomeEdgeMismatchShare: number;
    projectedElevationEdgeMeanAbsDelta: number;
    projectedWaterEdgeMismatchShare: number;
    topologyBiomeLongitudeEdgeDistance: number;
  };
  striping: {
    projectedBiomeAdjacentMismatchMean: number;
    projectedBiomeAdjacentMismatchCv: number;
    projectedBiomeRepeatedColumnShare: number;
    topologyBiomeLongitudeDistanceMean: number;
    topologyBiomeLongitudeDistanceCv: number;
  };
  slowPhases: Array<{ name: string; ms: number }>;
  graphNodes: Array<{ name: string; ms: number }>;
};
type DeepTimeDiagnostics = {
  fragmentHistory?: Record<string, number | string | boolean | undefined>;
  continentalDrift?: Record<string, number | string | boolean | undefined>;
};

const profiles: Profile[] = [
  { id: 'earthlike', label: 'Earthlike' },
  {
    id: 'pangea',
    label: 'Pangea',
    selectedValues: { oceanPercentage: 58, aridity: 0.52, continentCount: 1, continentScale: 0.92, islandDensity: 0.08 }
  },
  {
    id: 'archipelago',
    label: 'Archipelago',
    selectedValues: { oceanPercentage: 72, aridity: 0.5, continentCount: 8, continentScale: 0.22, islandDensity: 0.9 }
  }
];

const options = parseArgs(process.argv.slice(2));
const cases = buildCases(options.seeds, options.starSeeds, options.seedPairs, options.resolutions, options.profileIds);
const results = cases.map(runCase);
const report: TriageReport = {
  version: 1,
  appVersion: APP_VERSION,
  generatedAt: new Date().toISOString(),
  options: {
    seeds: options.seeds,
    starSeeds: options.starSeeds,
    seedPairs: options.seedPairs,
    resolutions: options.resolutions.map(formatResolution),
    profiles: options.profileIds
  },
  results
};
const stamp = report.generatedAt.replace(/[:.]/g, '-');
const outputDir = join('refs', 'testing');
mkdirSync(outputDir, { recursive: true });
const jsonPath = join(outputDir, `surface-quality-triage-${stamp}.json`);
const mdPath = join(outputDir, `surface-quality-triage-${stamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown(report));
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);

function parseArgs(argv: string[]): {
  seeds: string[];
  starSeeds: string[];
  seedPairs?: string[];
  resolutions: Resolution[];
  profileIds: string[];
} {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const quick = argv.includes('--quick');
  const seedPairs = splitList(get('seed-pairs'));
  return {
    seeds: seedPairs ? seedPairs.map((pair) => parseSeedPair(pair).seed) : splitList(get('seeds')) ?? ['1001001'],
    starSeeds: seedPairs ? seedPairs.map((pair) => parseSeedPair(pair).starSeed) : splitList(get('star-seeds')) ?? splitList(get('star-seed')) ?? splitList(get('seeds')) ?? ['1001001'],
    seedPairs,
    resolutions: (splitList(get('resolutions')) ?? (quick ? ['256x128'] : ['512x256'])).map(parseResolution),
    profileIds: splitList(get('profiles')) ?? (quick ? ['earthlike'] : profiles.map((profile) => profile.id))
  };
}

function buildCases(seeds: string[], starSeeds: string[], seedPairs: string[] | undefined, resolutions: Resolution[], profileIds: string[]): TriageCase[] {
  const pairedSeeds = seedPairs?.map(parseSeedPair);
  return resolutions.flatMap((resolution) =>
    profileIds.flatMap((profileId) => {
      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (!profile) throw new Error(`Unknown profile: ${profileId}`);
      if (pairedSeeds?.length) return pairedSeeds.map(({ starSeed, seed }) => ({ seed, starSeed, resolution, profile }));
      return seeds.flatMap((seed) => starSeeds.map((starSeed) => ({ seed, starSeed, resolution, profile })));
    })
  );
}

function runCase(triageCase: TriageCase): TriageResult {
  const seedLabel = triageCase.starSeed === triageCase.seed ? triageCase.seed : `star${triageCase.starSeed}-world${triageCase.seed}`;
  const caseId = `${triageCase.profile.id}-${seedLabel}-${formatResolution(triageCase.resolution)}`;
  console.log(`Running ${caseId}`);
  // Keep CLI triage aligned with the desktop generator path; preset preparation changes plate counts and relief.
  const config = prepareSystemOrbitConfig(createConfig(triageCase));
  const project = reconcileSystemOrbitPresets(generateProjectWithNativeStages(config, { appVersion: APP_VERSION }));
  return analyzeProject(caseId, triageCase, project);
}

function createConfig(triageCase: TriageCase): GenerationConfig {
  const config = createDefaultConfig(triageCase.seed, triageCase.resolution) as GenerationConfig & { seeds?: { star?: string; world?: string }; worldPresetId?: string; starPresetId?: string };
  config.selectedValues = { ...triageCase.profile.selectedValues };
  config.seeds = { star: triageCase.starSeed, world: triageCase.seed };
  config.starPresetId = 'sol-like';
  config.worldPresetId = triageCase.profile.label;
  return config;
}

function analyzeProject(caseId: string, triageCase: TriageCase, project: WorldProject): TriageResult {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const surface = buildSurfaceStructureClassification({
    seaLevel: world.seaLevel,
    topology,
    elevation: world.topologyLayers.elevation,
    water: world.topologyLayers.water,
    temperature: world.topologyLayers.temperature,
    ice: world.topologyLayers.ice
  });
  const landArea = Math.max(0.000001, surface.summary.landArea);
  const slopeStats = distributionStats(surface.slopeByCell, world.topologyLayers.water);
  const reliefStats = distributionStats(surface.localReliefByCell, world.topologyLayers.water);
  const topologyBiomeLongitude = topologyLongitudeStats(topology.longitudes, world.topologyLayers.biomes, world.topologyLayers.water, world.mapModel.resolution.width);
  const deepTime = (world as typeof world & { deepTime?: DeepTimeDiagnostics }).deepTime;
  return {
    caseId,
    seed: triageCase.seed,
    starSeed: triageCase.starSeed,
    profileId: triageCase.profile.id,
    profileLabel: triageCase.profile.label,
    resolution: formatResolution(triageCase.resolution),
    topologyResolution: world.topology.resolution,
    topologyCells: world.topology.cellCount,
    totalMs: project.diagnostics?.totalMs ?? 0,
    metrics: {
      oceanPercentage: project.metrics.oceanPercentage,
      icePercentage: project.metrics.icePercentage,
      riverCount: project.metrics.riverCount
    },
    surface: {
      reliefCharacter: surface.summary.reliefCharacter,
      highestElevationBand: surface.summary.highestElevationBand,
      highestElevationAboveSeaLevel: round(surface.summary.highestElevationAboveSeaLevel, 4),
      elevatedLandShare: round((surface.summary.elevationBandArea.upland + surface.summary.elevationBandArea.highland + surface.summary.elevationBandArea.alpine) / landArea, 4),
      ruggedOrMountainousShare: round((surface.summary.morphologyArea.rugged + surface.summary.morphologyArea.mountainous) / landArea, 4),
      mountainousLandShare: round(surface.summary.morphologyArea.mountainous / landArea, 4),
      elevationBandShares: Object.fromEntries(surfaceElevationBands.map((band) => [band, round(surface.summary.elevationBandArea[band] / landArea, 4)])),
      morphologyShares: Object.fromEntries(surfaceMorphologies.map((form) => [form, round(surface.summary.morphologyArea[form] / landArea, 4)])),
      meanSlope: round(slopeStats.mean, 4),
      p90Slope: round(slopeStats.p90, 4),
      meanLocalRelief: round(reliefStats.mean, 4),
      p90LocalRelief: round(reliefStats.p90, 4),
      elevationDrivenTreelineShare: round(surface.summary.elevationDrivenTreelineArea / landArea, 4),
      elevationDrivenSnowlineShare: round(surface.summary.elevationDrivenSnowlineArea / landArea, 4)
    },
    tectonics: compactRecord({
      driftMode: deepTime?.continentalDrift?.driftMode,
      puzzleFitPotential: deepTime?.continentalDrift?.puzzleFitPotential,
      activeBoundaryPairs: deepTime?.continentalDrift?.activeBoundaryPairs,
      fragmentHistoryVersion: deepTime?.fragmentHistory?.modelVersion,
      fragmentHistoryPuzzleFitScore: deepTime?.fragmentHistory?.puzzleFitScore,
      fragmentHistoryConjugateMarginPairs: deepTime?.fragmentHistory?.conjugateMarginCandidatePairs,
      fragmentHistoryCollisionEventPairs: deepTime?.fragmentHistory?.collisionEventCandidatePairs,
      fragmentHistoryRiftSplitCandidates: deepTime?.fragmentHistory?.riftSplitCandidateFragments,
      fragmentHistoryTerrainResponseApplied: deepTime?.fragmentHistory?.terrainResponseApplied,
      fragmentHistoryTerrainResponseCellShare: deepTime?.fragmentHistory?.terrainResponseCellShare,
      fragmentHistoryMeanAbsTerrainResponseDelta: deepTime?.fragmentHistory?.meanAbsTerrainResponseDelta
    }),
    seams: {
      projectedBiomeEdgeMismatchShare: round(categoricalEdgeMismatch(world.layers.biomes, world.mapModel.resolution.width, world.mapModel.resolution.height), 4),
      projectedElevationEdgeMeanAbsDelta: round(numericEdgeMeanAbsDelta(world.layers.elevation, world.mapModel.resolution.width, world.mapModel.resolution.height), 4),
      projectedWaterEdgeMismatchShare: round(categoricalEdgeMismatch(world.layers.water, world.mapModel.resolution.width, world.mapModel.resolution.height), 4),
      topologyBiomeLongitudeEdgeDistance: round(topologyBiomeLongitude.edgeDistance, 4)
    },
    striping: {
      projectedBiomeAdjacentMismatchMean: round(projectedCategoricalColumnStats(world.layers.biomes, world.mapModel.resolution.width, world.mapModel.resolution.height).adjacentMismatchMean, 4),
      projectedBiomeAdjacentMismatchCv: round(projectedCategoricalColumnStats(world.layers.biomes, world.mapModel.resolution.width, world.mapModel.resolution.height).adjacentMismatchCv, 4),
      projectedBiomeRepeatedColumnShare: round(projectedCategoricalColumnStats(world.layers.biomes, world.mapModel.resolution.width, world.mapModel.resolution.height).repeatedColumnShare, 4),
      topologyBiomeLongitudeDistanceMean: round(topologyBiomeLongitude.adjacentDistanceMean, 4),
      topologyBiomeLongitudeDistanceCv: round(topologyBiomeLongitude.adjacentDistanceCv, 4)
    },
    slowPhases: [...(project.diagnostics?.phases ?? [])].sort((a, b) => b.ms - a.ms).slice(0, 8).map((phase) => ({ name: phase.name, ms: round(phase.ms, 1) })),
    graphNodes: [...(project.diagnostics?.graph?.nodes ?? [])].sort((a, b) => b.durationMs - a.durationMs).slice(0, 8).map((node) => ({ name: node.nodeId, ms: round(node.durationMs, 1) }))
  };
}

function distributionStats(values: Float32Array, water: Uint8Array): { mean: number; p90: number } {
  const samples: number[] = [];
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (water[index] === 1) continue;
    const value = values[index];
    samples.push(value);
    total += value;
  }
  samples.sort((a, b) => a - b);
  return {
    mean: samples.length ? total / samples.length : 0,
    p90: samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0
  };
}

function categoricalEdgeMismatch(layer: Uint8Array, width: number, height: number): number {
  let mismatches = 0;
  for (let y = 0; y < height; y += 1) {
    if (layer[y * width] !== layer[y * width + width - 1]) mismatches += 1;
  }
  return mismatches / Math.max(1, height);
}

function numericEdgeMeanAbsDelta(layer: Float32Array, width: number, height: number): number {
  let delta = 0;
  for (let y = 0; y < height; y += 1) {
    delta += Math.abs(layer[y * width] - layer[y * width + width - 1]);
  }
  return delta / Math.max(1, height);
}

function projectedCategoricalColumnStats(layer: Uint8Array, width: number, height: number): {
  adjacentMismatchMean: number;
  adjacentMismatchCv: number;
  repeatedColumnShare: number;
} {
  const mismatches: number[] = [];
  for (let x = 0; x < width; x += 1) {
    const nextX = (x + 1) % width;
    let mismatch = 0;
    for (let y = 0; y < height; y += 1) {
      if (layer[y * width + x] !== layer[y * width + nextX]) mismatch += 1;
    }
    mismatches.push(mismatch / Math.max(1, height));
  }
  const mean = average(mismatches);
  const variance = average(mismatches.map((value) => (value - mean) ** 2));
  const repeated = mismatches.filter((value) => value < 0.02).length / Math.max(1, mismatches.length);
  return { adjacentMismatchMean: mean, adjacentMismatchCv: mean > 0 ? Math.sqrt(variance) / mean : 0, repeatedColumnShare: repeated };
}

function topologyLongitudeStats(longitudes: Float32Array, biomes: Uint8Array, water: Uint8Array, bucketCount: number): {
  adjacentDistanceMean: number;
  adjacentDistanceCv: number;
  edgeDistance: number;
} {
  const buckets = Array.from({ length: bucketCount }, () => new Array<number>(biomeNames.length).fill(0));
  const totals = new Array<number>(bucketCount).fill(0);
  for (let cell = 0; cell < longitudes.length; cell += 1) {
    if (water[cell] === 1) continue;
    const bucket = Math.max(0, Math.min(bucketCount - 1, Math.floor(((longitudes[cell] + Math.PI) / (Math.PI * 2)) * bucketCount)));
    const biome = Math.max(0, Math.min(biomeNames.length - 1, biomes[cell]));
    buckets[bucket][biome] += 1;
    totals[bucket] += 1;
  }
  const normalized = buckets.map((bucket, index) => bucket.map((value) => value / Math.max(1, totals[index])));
  const distances: number[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    distances.push(histogramDistance(normalized[index], normalized[(index + 1) % bucketCount]));
  }
  const mean = average(distances);
  const variance = average(distances.map((value) => (value - mean) ** 2));
  return {
    adjacentDistanceMean: mean,
    adjacentDistanceCv: mean > 0 ? Math.sqrt(variance) / mean : 0,
    edgeDistance: histogramDistance(normalized[0], normalized[bucketCount - 1])
  };
}

function histogramDistance(a: number[], b: number[]): number {
  let total = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) total += Math.abs(a[index] - b[index]);
  return total / 2;
}

function compactRecord(record: Record<string, number | string | boolean | undefined>): Record<string, number | string | boolean> {
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, number | string | boolean] => entry[1] !== undefined));
}

function renderMarkdown(report: TriageReport): string {
  const lines = [
    '# Surface Quality Triage',
    '',
    `Generated: ${report.generatedAt}`,
    `App version: ${report.appVersion}`,
    `Options: seeds=${report.options.seeds.join(', ')}; starSeeds=${report.options.starSeeds.join(', ')}; seedPairs=${report.options.seedPairs?.join(', ') ?? ''}; resolutions=${report.options.resolutions.join(', ')}; profiles=${report.options.profiles.join(', ')}`,
    '',
    '## Cases',
    '',
    '| Case | Relief | Mountainous land | Rugged+mountainous | Above tree line | Above snow line | Highest band | Seam biome mismatch | Stripe CV | Top slow phase |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |',
    ...report.results.map((result) => {
      const slowest = result.slowPhases[0];
      return `| ${result.caseId} | ${result.surface.reliefCharacter} | ${pct(result.surface.mountainousLandShare)} | ${pct(result.surface.ruggedOrMountainousShare)} | ${pct(result.surface.elevationDrivenTreelineShare)} | ${pct(result.surface.elevationDrivenSnowlineShare)} | ${result.surface.highestElevationBand} | ${pct(result.seams.projectedBiomeEdgeMismatchShare)} | ${result.striping.projectedBiomeAdjacentMismatchCv.toFixed(3)} | ${slowest ? `${slowest.name} ${slowest.ms.toFixed(1)} ms` : ''} |`;
    }),
    '',
    '## Tectonic Signal',
    '',
    '| Case | Drift mode | Puzzle fit | Collision pairs | Terrain response cells | Mean terrain delta |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...report.results.map((result) =>
      `| ${result.caseId} | ${result.tectonics.driftMode ?? ''} | ${num(result.tectonics.fragmentHistoryPuzzleFitScore ?? result.tectonics.puzzleFitPotential)} | ${num(result.tectonics.fragmentHistoryCollisionEventPairs)} | ${pct(Number(result.tectonics.fragmentHistoryTerrainResponseCellShare ?? 0))} | ${num(result.tectonics.fragmentHistoryMeanAbsTerrainResponseDelta)} |`
    ),
    '',
    '## Interpretation Notes',
    '',
    '- Surface triage uses the same app-facing generation path as the desktop generator: `prepareSystemOrbitConfig`, `generateProjectWithNativeStages`, then `reconcileSystemOrbitPresets`.',
    '- Mountain deficit work should start with `mountainousLandShare`, `elevationDrivenTreelineShare`, `elevationDrivenSnowlineShare`, `p90Slope`, `p90LocalRelief`, and fragment-history terrain response metrics.',
    '- Seam work should start with `projectedBiomeEdgeMismatchShare` and `projectedElevationEdgeMeanAbsDelta` before changing texture wrapping.',
    '- Striping work should compare projected-column CV against topology-longitude CV. High projected CV with lower topology CV points to projection or smoothing.',
    ''
  ];
  return `${lines.join('\n')}\n`;
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseResolution(value: string): Resolution {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid resolution: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseSeedPair(value: string): { starSeed: string; seed: string } {
  const match = value.match(/^(\d+)[/:](\d+)$/);
  if (!match) throw new Error(`Invalid seed pair: ${value}. Use starSeed:worldSeed.`);
  return { starSeed: match[1], seed: match[2] };
}

function formatResolution(resolution: Resolution): string {
  return `${resolution.width}x${resolution.height}`;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function num(value: unknown): string {
  return typeof value === 'number' ? value.toFixed(4) : String(value ?? '');
}
