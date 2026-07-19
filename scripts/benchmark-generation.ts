import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultConfig } from '../packages/generator-core/src/index';
import { generateProjectWithMotionAwareDeepTime } from '../packages/generator-core/src/plateMotionPipeline';
import type { GenerationConfig, SelectedValues, WorldProject } from '@world-forge/shared';

type Resolution = { width: number; height: number };
type Profile = {
  id: string;
  label: string;
  selectedValues?: Partial<SelectedValues>;
};
type BenchmarkCase = {
  seed: string;
  resolution: Resolution;
  profile: Profile;
};
type Timing = { name: string; ms: number; percentOfTotal: number };
type BenchmarkResult = {
  caseId: string;
  seed: string;
  profileId: string;
  profileLabel: string;
  resolution: string;
  topologyResolution?: number;
  topologyCells?: number;
  outputPixels: number;
  totalMs: number;
  measuredWallMs: number;
  memoryBeforeMb: MemorySnapshot;
  memoryAfterMb: MemorySnapshot;
  signature: string;
  metrics: {
    oceanPercentage: number;
    icePercentage: number;
    riverCount: number;
  };
  graphNodes: Timing[];
  slowPhases: Timing[];
};
type BenchmarkReport = {
  version: 1;
  generatedAt: string;
  environment: {
    node: string;
    platform: string;
    arch: string;
    argv: string[];
  };
  options: {
    seeds: string[];
    resolutions: string[];
    profiles: string[];
    runsPerCase: number;
  };
  results: BenchmarkResult[];
  summaries: Summary[];
};
type Summary = {
  group: string;
  samples: number;
  medianTotalMs: number;
  averageTotalMs: number;
  p90TotalMs: number;
  topGraphNodes: Array<{ name: string; averageMs: number; averagePercent: number }>;
  topSlowPhases: Array<{ name: string; averageMs: number; averagePercent: number }>;
};
type MemorySnapshot = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
};

const profiles: Profile[] = [
  { id: 'earthlike', label: 'Earthlike' },
  {
    id: 'waterworld',
    label: 'Waterworld',
    selectedValues: { oceanPercentage: 86, aridity: 0.42, seaLevel: 0.1, continentCount: 2, continentScale: 0.28, islandDensity: 0.75 }
  },
  {
    id: 'archipelago',
    label: 'Archipelago',
    selectedValues: { oceanPercentage: 72, aridity: 0.5, seaLevel: 0.05, continentCount: 8, continentScale: 0.22, islandDensity: 0.9 }
  },
  {
    id: 'desert-world',
    label: 'Desert World',
    selectedValues: { oceanPercentage: 38, averageTemperatureC: 26, aridity: 0.88, riverDensity: 0.8 }
  },
  {
    id: 'pangea',
    label: 'Pangea',
    selectedValues: { oceanPercentage: 58, aridity: 0.52, continentCount: 1, continentScale: 0.92, islandDensity: 0.08 }
  }
];

const options = parseArgs(process.argv.slice(2));
const cases = buildCases(options.seeds, options.resolutions, options.profileIds);
const results: BenchmarkResult[] = [];

for (const benchmarkCase of cases) {
  for (let runIndex = 0; runIndex < options.runsPerCase; runIndex += 1) {
    const result = runCase(benchmarkCase, runIndex);
    results.push(result);
    console.log(
      `${result.caseId}: ${result.totalMs.toFixed(1)} ms total, ` +
        `${result.slowPhases.slice(0, 3).map((phase) => `${phase.name} ${phase.ms.toFixed(1)} ms`).join(', ')}`
    );
  }
}

const report: BenchmarkReport = {
  version: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    argv: process.argv.slice(2)
  },
  options: {
    seeds: options.seeds,
    resolutions: options.resolutions.map(formatResolution),
    profiles: options.profileIds,
    runsPerCase: options.runsPerCase
  },
  results,
  summaries: summarize(results)
};

const stamp = report.generatedAt.replace(/[:.]/g, '-');
const outputDir = join('refs', 'testing');
mkdirSync(outputDir, { recursive: true });
const jsonPath = join(outputDir, `generation-performance-${stamp}.json`);
const mdPath = join(outputDir, `generation-performance-${stamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown(report));

console.log(`\nWrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);

function parseArgs(argv: string[]): {
  seeds: string[];
  resolutions: Resolution[];
  profileIds: string[];
  runsPerCase: number;
} {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const quick = argv.includes('--quick');
  const seeds = splitList(get('seeds')) ?? ['1001001'];
  const resolutions = (splitList(get('resolutions')) ?? (quick ? ['256x128'] : ['512x256'])).map(parseResolution);
  const profileIds = splitList(get('profiles')) ?? (quick ? ['earthlike'] : profiles.map((profile) => profile.id));
  const runsPerCase = Math.max(1, Number(get('runs') ?? '1'));
  return { seeds, resolutions, profileIds, runsPerCase };
}

function buildCases(seeds: string[], resolutions: Resolution[], profileIds: string[]): BenchmarkCase[] {
  return resolutions.flatMap((resolution) =>
    profileIds.flatMap((profileId) => {
      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (!profile) throw new Error(`Unknown profile: ${profileId}`);
      return seeds.map((seed) => ({ seed, resolution, profile }));
    })
  );
}

function runCase(benchmarkCase: BenchmarkCase, runIndex: number): BenchmarkResult {
  const caseId = `${benchmarkCase.profile.id}-${benchmarkCase.seed}-${formatResolution(benchmarkCase.resolution)}-run${runIndex + 1}`;
  const config = createConfig(benchmarkCase);
  const memoryBeforeMb = readMemoryMb();
  const started = performance.now();
  const project = generateProjectWithMotionAwareDeepTime(config);
  const measuredWallMs = performance.now() - started;
  const memoryAfterMb = readMemoryMb();
  const totalMs = project.diagnostics?.totalMs ?? measuredWallMs;
  return {
    caseId,
    seed: benchmarkCase.seed,
    profileId: benchmarkCase.profile.id,
    profileLabel: benchmarkCase.profile.label,
    resolution: formatResolution(benchmarkCase.resolution),
    topologyResolution: config.topologyResolution,
    topologyCells: project.primaryWorld.topology?.cellCount,
    outputPixels: benchmarkCase.resolution.width * benchmarkCase.resolution.height,
    totalMs,
    measuredWallMs,
    memoryBeforeMb,
    memoryAfterMb,
    signature: signature(project),
    metrics: {
      oceanPercentage: project.metrics.oceanPercentage,
      icePercentage: project.metrics.icePercentage,
      riverCount: project.metrics.riverCount
    },
    graphNodes: timings(project.diagnostics?.graph?.nodes.map((node) => ({ name: node.nodeId, ms: node.durationMs })) ?? [], totalMs),
    slowPhases: timings(project.diagnostics?.phases.map((phase) => ({ name: phase.name, ms: phase.ms })) ?? [], totalMs)
      .filter((phase) => !phase.name.includes('primary-world'))
      .sort((a, b) => b.ms - a.ms)
  };
}

function createConfig(benchmarkCase: BenchmarkCase): GenerationConfig {
  const config = createDefaultConfig(benchmarkCase.seed, benchmarkCase.resolution);
  config.selectedValues = { ...benchmarkCase.profile.selectedValues };
  return config;
}

function timings(items: Array<{ name: string; ms?: number | null }>, totalMs: number): Timing[] {
  return items
    .map((item) => ({ name: item.name, ms: item.ms ?? 0, percentOfTotal: totalMs > 0 ? ((item.ms ?? 0) / totalMs) * 100 : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

function summarize(results: BenchmarkResult[]): Summary[] {
  const groups = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    addGroup(groups, 'all', result);
    addGroup(groups, `resolution:${result.resolution}`, result);
    addGroup(groups, `profile:${result.profileId}`, result);
  }
  return Array.from(groups, ([group, groupResults]) => {
    const totals = groupResults.map((result) => result.totalMs).sort((a, b) => a - b);
    return {
      group,
      samples: groupResults.length,
      medianTotalMs: percentile(totals, 0.5),
      averageTotalMs: average(totals),
      p90TotalMs: percentile(totals, 0.9),
      topGraphNodes: topAverages(groupResults.flatMap((result) => result.graphNodes)),
      topSlowPhases: topAverages(groupResults.flatMap((result) => result.slowPhases))
    };
  });
}

function addGroup(groups: Map<string, BenchmarkResult[]>, group: string, result: BenchmarkResult): void {
  const current = groups.get(group);
  if (current) current.push(result);
  else groups.set(group, [result]);
}

function topAverages(items: Timing[]): Array<{ name: string; averageMs: number; averagePercent: number }> {
  const totals = new Map<string, { ms: number; percent: number; count: number }>();
  for (const item of items) {
    const current = totals.get(item.name) ?? { ms: 0, percent: 0, count: 0 };
    current.ms += item.ms;
    current.percent += item.percentOfTotal;
    current.count += 1;
    totals.set(item.name, current);
  }
  return Array.from(totals, ([name, total]) => ({
    name,
    averageMs: total.ms / total.count,
    averagePercent: total.percent / total.count
  })).sort((a, b) => b.averageMs - a.averageMs).slice(0, 10);
}

function signature(project: WorldProject): string {
  const world = project.primaryWorld;
  return [
    hashBytes(new Uint8Array(world.topologyLayers.elevation.buffer)),
    hashBytes(new Uint8Array(world.topologyLayers.water.buffer)),
    hashBytes(new Uint8Array(world.topologyLayers.biomes.buffer)),
    hashBytes(new Uint8Array(world.layers.elevation.buffer)),
    hashBytes(new Uint8Array(world.layers.water.buffer)),
    hashBytes(new Uint8Array(world.layers.biomes.buffer)),
    project.metrics.oceanPercentage.toFixed(4),
    project.metrics.icePercentage.toFixed(4),
    project.metrics.riverCount
  ].join(':');
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 2166136261;
  const stride = Math.max(1, Math.floor(bytes.length / 200_000));
  for (let index = 0; index < bytes.length; index += stride) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readMemoryMb(): MemorySnapshot {
  const memory = process.memoryUsage();
  return {
    rss: round(memory.rss / 1024 / 1024, 1),
    heapUsed: round(memory.heapUsed / 1024 / 1024, 1),
    heapTotal: round(memory.heapTotal / 1024 / 1024, 1)
  };
}

function renderMarkdown(report: BenchmarkReport): string {
  const lines = [
    '# Generation Performance Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    `Node: ${report.environment.node} on ${report.environment.platform}/${report.environment.arch}`,
    `Options: seeds=${report.options.seeds.join(', ')}; resolutions=${report.options.resolutions.join(', ')}; profiles=${report.options.profiles.join(', ')}; runs=${report.options.runsPerCase}`,
    '',
    '## Summary',
    '',
    '| Group | Samples | Median total ms | Average total ms | P90 total ms | Top graph node | Top slow phase |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.summaries.map((summary) => {
      const graph = summary.topGraphNodes[0];
      const phase = summary.topSlowPhases[0];
      return `| ${summary.group} | ${summary.samples} | ${summary.medianTotalMs.toFixed(1)} | ${summary.averageTotalMs.toFixed(1)} | ${summary.p90TotalMs.toFixed(1)} | ${graph ? `${graph.name} ${graph.averageMs.toFixed(1)} ms` : ''} | ${phase ? `${phase.name} ${phase.averageMs.toFixed(1)} ms` : ''} |`;
    }),
    '',
    '## Cases',
    '',
    '| Case | Total ms | Wall ms | Topology cells | Output pixels | Signature | Top slow phases |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.results.map((result) =>
      `| ${result.caseId} | ${result.totalMs.toFixed(1)} | ${result.measuredWallMs.toFixed(1)} | ${result.topologyCells ?? ''} | ${result.outputPixels} | ${result.signature} | ${result.slowPhases.slice(0, 5).map((phase) => `${phase.name} ${phase.ms.toFixed(1)} ms`).join('<br>')} |`
    ),
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

function formatResolution(resolution: Resolution): string {
  return `${resolution.width}x${resolution.height}`;
}

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const index = clampIndex(Math.round((sortedValues.length - 1) * p), sortedValues.length);
  return sortedValues[index];
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
