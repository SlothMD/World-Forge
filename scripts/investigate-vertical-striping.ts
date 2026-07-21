import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCubedSphereTopology, type CubedSphereTopology, type GenerationConfig, type WorldProject } from '@world-forge/shared';
import { createDefaultConfig, generateProject } from '../packages/generator-core/src/index';
import { generateProjectWithMotionAwareDeepTime } from '../packages/generator-core/src/plateMotionPipeline';

type LayerMetrics = {
  label: string;
  cellCount: number;
  plateBoundary?: PlateBoundaryMetrics;
  elevation?: ElevationOrientationMetrics;
  componentShape?: ComponentShapeMetrics;
};

type PlateBoundaryMetrics = {
  boundaryEdges: number;
  meridionalTangentShare: number;
  zonalTangentShare: number;
  faceEdgeBoundaryShare: number;
};

type ElevationOrientationMetrics = {
  comparedEdges: number;
  p90Delta: number;
  highDeltaEdges: number;
  highDeltaMeridionalTangentShare: number;
  highDeltaZonalTangentShare: number;
  meanHighDelta: number;
};

type ComponentShapeMetrics = {
  componentCount: number;
  largeComponentCount: number;
  longThinMeridionalShare: number;
  meanLargeLatSpanDeg: number;
  meanLargeLonSpanDeg: number;
  maxLatSpanDeg: number;
  maxLonSpanDeg: number;
};

type ProjectedMetrics = {
  label: string;
  width: number;
  height: number;
  horizontalP90Delta: number;
  verticalP90Delta: number;
  horizontalHighDeltaShare: number;
  verticalHighDeltaShare: number;
  horizontalToVerticalHighDeltaRatio: number;
  meanColumnAutocorrelation: number;
  meanRowAutocorrelation: number;
};

type InvestigationReport = {
  version: 1;
  generatedAt: string;
  config: {
    starSeed: string;
    worldSeed: string;
    outputResolution: string;
    topologyResolution: number;
  };
  generation: {
    initialAppVersion: string;
    finalAppVersion: string;
    finalSourceCommit?: string;
    totalMs?: number;
  };
  topologyLayers: LayerMetrics[];
  projectedLayers: ProjectedMetrics[];
  interpretation: string[];
};

const options = parseArgs(process.argv.slice(2));
const config = createInvestigationConfig(options);
console.log(`Generating baseline ${options.starSeed}:${options.worldSeed} at ${config.outputResolution.width}x${config.outputResolution.height}, topology ${config.topologyResolution}...`);

const initial = generateProject(config, { appVersion: 'striping-investigation-initial' });
const final = generateProjectWithMotionAwareDeepTime(config, {
  appVersion: 'striping-investigation-final',
  sourceCommit: currentCommitLabel()
});
const topology = buildCubedSphereTopology(final.primaryWorld.topology.resolution);

const report: InvestigationReport = {
  version: 1,
  generatedAt: new Date().toISOString(),
  config: {
    starSeed: options.starSeed,
    worldSeed: options.worldSeed,
    outputResolution: `${config.outputResolution.width}x${config.outputResolution.height}`,
    topologyResolution: final.primaryWorld.topology.resolution
  },
  generation: {
    initialAppVersion: initial.appVersion,
    finalAppVersion: final.appVersion,
    finalSourceCommit: final.sourceCommit,
    totalMs: final.diagnostics?.totalMs
  },
  topologyLayers: [
    summarizeTopologyLayer('initial topology plates/elevation', initial, topology),
    summarizeTopologyLayer('final topology plates/elevation', final, topology)
  ],
  projectedLayers: [
    summarizeProjectedElevation('initial projected elevation', initial),
    summarizeProjectedElevation('final projected elevation', final),
    summarizeProjectedPlateRaster('final projected plates', final)
  ],
  interpretation: []
};

report.interpretation = interpret(report);

const outputDir = join('refs', 'testing');
mkdirSync(outputDir, { recursive: true });
const jsonPath = join(outputDir, 'vertical-striping-v0.3.11-metrics.json');
const mdPath = join(outputDir, 'vertical-striping-v0.3.11-runtime-and-layer-isolation.md');
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown(report));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
for (const line of report.interpretation) console.log(`- ${line}`);

function parseArgs(argv: string[]): { starSeed: string; worldSeed: string; width: number; height: number; topologyResolution: number } {
  const get = (name: string, fallback: string): string => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  };
  return {
    starSeed: get('star', '2850873'),
    worldSeed: get('world', '1001001'),
    width: Number(get('width', '2048')),
    height: Number(get('height', '1024')),
    topologyResolution: Number(get('topology', '512'))
  };
}

function createInvestigationConfig(options: ReturnType<typeof parseArgs>): GenerationConfig {
  const config = createDefaultConfig(options.worldSeed, { width: options.width, height: options.height }) as GenerationConfig & {
    seeds?: { star?: string; world?: string };
    worldPresetId?: string;
  };
  config.seed = options.worldSeed;
  config.seeds = { star: options.starSeed, world: options.worldSeed };
  config.worldPresetId = 'Earthlike';
  config.topologyResolution = options.topologyResolution;
  config.outputResolution = { width: options.width, height: options.height };
  return config;
}

function summarizeTopologyLayer(label: string, project: WorldProject, topology: CubedSphereTopology): LayerMetrics {
  const plates = project.primaryWorld.topologyLayers.plates;
  const elevation = project.primaryWorld.topologyLayers.elevation;
  return {
    label,
    cellCount: topology.cellCount,
    plateBoundary: measurePlateBoundaries(topology, plates),
    elevation: measureTopologyElevationOrientation(topology, elevation),
    componentShape: measureComponentShapes(topology, plates)
  };
}

function measurePlateBoundaries(topology: CubedSphereTopology, plates: Uint16Array): PlateBoundaryMetrics {
  let boundaryEdges = 0;
  let meridional = 0;
  let zonal = 0;
  let faceEdge = 0;
  forEachTopologyEdge(topology, (cell, neighbor) => {
    if (plates[cell] === plates[neighbor]) return;
    boundaryEdges += 1;
    const orientation = edgeTangentOrientation(topology, cell, neighbor);
    if (orientation === 'meridional') meridional += 1;
    else zonal += 1;
    if (topologyFace(cell, topology.resolution) !== topologyFace(neighbor, topology.resolution)) faceEdge += 1;
  });
  return {
    boundaryEdges,
    meridionalTangentShare: round(meridional / Math.max(1, boundaryEdges), 6),
    zonalTangentShare: round(zonal / Math.max(1, boundaryEdges), 6),
    faceEdgeBoundaryShare: round(faceEdge / Math.max(1, boundaryEdges), 6)
  };
}

function measureTopologyElevationOrientation(topology: CubedSphereTopology, elevation: Float32Array): ElevationOrientationMetrics {
  const deltas: Array<{ delta: number; orientation: 'meridional' | 'zonal' }> = [];
  forEachTopologyEdge(topology, (cell, neighbor) => {
    deltas.push({
      delta: Math.abs(elevation[cell] - elevation[neighbor]),
      orientation: edgeTangentOrientation(topology, cell, neighbor)
    });
  });
  deltas.sort((a, b) => a.delta - b.delta);
  const p90Delta = percentile(deltas.map((item) => item.delta), 0.9);
  const high = deltas.filter((item) => item.delta >= p90Delta && item.delta > 0);
  const meridional = high.filter((item) => item.orientation === 'meridional').length;
  return {
    comparedEdges: deltas.length,
    p90Delta: round(p90Delta, 8),
    highDeltaEdges: high.length,
    highDeltaMeridionalTangentShare: round(meridional / Math.max(1, high.length), 6),
    highDeltaZonalTangentShare: round((high.length - meridional) / Math.max(1, high.length), 6),
    meanHighDelta: round(high.reduce((sum, item) => sum + item.delta, 0) / Math.max(1, high.length), 8)
  };
}

function measureComponentShapes(topology: CubedSphereTopology, plates: Uint16Array): ComponentShapeMetrics {
  const visited = new Uint8Array(plates.length);
  const queue = new Int32Array(plates.length);
  const large: Array<{ latSpan: number; lonSpan: number; size: number }> = [];
  for (let start = 0; start < plates.length; start += 1) {
    if (visited[start]) continue;
    const plateId = plates[start];
    let head = 0;
    let tail = 0;
    let size = 0;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    const longitudes: number[] = [];
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const cell = queue[head++];
      size += 1;
      const latitude = topology.latitudes[cell];
      minLat = Math.min(minLat, latitude);
      maxLat = Math.max(maxLat, latitude);
      longitudes.push(topology.longitudes[cell]);
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || visited[neighbor] || plates[neighbor] !== plateId) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (size >= Math.max(128, plates.length * 0.0025)) {
      large.push({
        size,
        latSpan: maxLat - minLat,
        lonSpan: minimalLongitudeSpan(longitudes)
      });
    }
  }
  const longThin = large.filter((item) => item.latSpan > Math.PI * 0.55 && item.lonSpan < Math.PI * 0.18);
  return {
    componentCount: countComponents(topology, plates),
    largeComponentCount: large.length,
    longThinMeridionalShare: round(longThin.length / Math.max(1, large.length), 6),
    meanLargeLatSpanDeg: round(radToDeg(mean(large.map((item) => item.latSpan))), 3),
    meanLargeLonSpanDeg: round(radToDeg(mean(large.map((item) => item.lonSpan))), 3),
    maxLatSpanDeg: round(radToDeg(Math.max(0, ...large.map((item) => item.latSpan))), 3),
    maxLonSpanDeg: round(radToDeg(Math.max(0, ...large.map((item) => item.lonSpan))), 3)
  };
}

function summarizeProjectedElevation(label: string, project: WorldProject): ProjectedMetrics {
  return summarizeProjectedNumeric(label, project.primaryWorld.layers.elevation, project.primaryWorld.mapModel.resolution.width, project.primaryWorld.mapModel.resolution.height);
}

function summarizeProjectedPlateRaster(label: string, project: WorldProject): ProjectedMetrics {
  const source = project.primaryWorld.layers.plates;
  const numeric = new Float32Array(source.length);
  for (let index = 0; index < source.length; index += 1) numeric[index] = source[index];
  return summarizeProjectedNumeric(label, numeric, project.primaryWorld.mapModel.resolution.width, project.primaryWorld.mapModel.resolution.height);
}

function summarizeProjectedNumeric(label: string, layer: Float32Array | Uint16Array, width: number, height: number): ProjectedMetrics {
  const horizontal: number[] = [];
  const vertical: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const right = y * width + ((x + 1) % width);
      horizontal.push(Math.abs(Number(layer[index]) - Number(layer[right])));
      if (y + 1 < height) vertical.push(Math.abs(Number(layer[index]) - Number(layer[index + width])));
    }
  }
  const all = [...horizontal, ...vertical].sort((a, b) => a - b);
  const threshold = percentile(all, 0.9);
  const horizontalHigh = horizontal.filter((value) => value >= threshold && value > 0).length;
  const verticalHigh = vertical.filter((value) => value >= threshold && value > 0).length;
  return {
    label,
    width,
    height,
    horizontalP90Delta: round(percentile(horizontal.sort((a, b) => a - b), 0.9), 8),
    verticalP90Delta: round(percentile(vertical.sort((a, b) => a - b), 0.9), 8),
    horizontalHighDeltaShare: round(horizontalHigh / Math.max(1, horizontal.length), 6),
    verticalHighDeltaShare: round(verticalHigh / Math.max(1, vertical.length), 6),
    horizontalToVerticalHighDeltaRatio: round((horizontalHigh / Math.max(1, horizontal.length)) / Math.max(0.000001, verticalHigh / Math.max(1, vertical.length)), 6),
    meanColumnAutocorrelation: round(meanProjectedAutocorrelation(layer, width, height, 'column'), 6),
    meanRowAutocorrelation: round(meanProjectedAutocorrelation(layer, width, height, 'row'), 6)
  };
}

function forEachTopologyEdge(topology: CubedSphereTopology, callback: (cell: number, neighbor: number) => void): void {
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor > cell) callback(cell, neighbor);
    }
  }
}

function topologyFace(cell: number, resolution: number): number {
  return Math.floor(cell / (resolution * resolution));
}

function edgeTangentOrientation(topology: CubedSphereTopology, cell: number, neighbor: number): 'meridional' | 'zonal' {
  const meanLatitude = (topology.latitudes[cell] + topology.latitudes[neighbor]) * 0.5;
  const longitudeDelta = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.max(0.12, Math.cos(meanLatitude));
  const latitudeDelta = topology.latitudes[neighbor] - topology.latitudes[cell];
  return Math.abs(longitudeDelta) >= Math.abs(latitudeDelta) ? 'meridional' : 'zonal';
}

function countComponents(topology: CubedSphereTopology, layer: Uint16Array): number {
  const visited = new Uint8Array(layer.length);
  const queue = new Int32Array(layer.length);
  let components = 0;
  for (let start = 0; start < layer.length; start += 1) {
    if (visited[start]) continue;
    const value = layer[start];
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const cell = queue[head++];
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || visited[neighbor] || layer[neighbor] !== value) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    components += 1;
  }
  return components;
}

function meanProjectedAutocorrelation(layer: Float32Array | Uint16Array, width: number, height: number, mode: 'row' | 'column'): number {
  const correlations: number[] = [];
  const count = mode === 'row' ? height : width;
  for (let line = 0; line < count; line += 1) {
    const values: number[] = [];
    const length = mode === 'row' ? width : height;
    for (let offset = 0; offset < length; offset += 1) {
      const x = mode === 'row' ? offset : line;
      const y = mode === 'row' ? line : offset;
      values.push(Number(layer[y * width + x]));
    }
    correlations.push(lagOneAutocorrelation(values));
  }
  return mean(correlations.filter(Number.isFinite));
}

function lagOneAutocorrelation(values: number[]): number {
  if (values.length < 3) return 0;
  const avg = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    const centered = values[index] - avg;
    denominator += centered * centered;
    if (index + 1 < values.length) numerator += centered * (values[index + 1] - avg);
  }
  return denominator > 0 ? numerator / denominator : 0;
}

function minimalLongitudeSpan(longitudes: number[]): number {
  if (longitudes.length <= 1) return 0;
  const normalized = longitudes.map((value) => {
    const wrapped = wrappedAngle(value);
    return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped;
  }).sort((a, b) => a - b);
  let maxGap = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const next = index + 1 < normalized.length ? normalized[index + 1] : normalized[0] + Math.PI * 2;
    maxGap = Math.max(maxGap, next - normalized[index]);
  }
  return Math.PI * 2 - maxGap;
}

function interpret(report: InvestigationReport): string[] {
  const initial = report.topologyLayers[0];
  const final = report.topologyLayers[1];
  const lines: string[] = [];
  const initialMeridional = initial.plateBoundary?.meridionalTangentShare ?? 0;
  const finalMeridional = final.plateBoundary?.meridionalTangentShare ?? 0;
  const initialComponents = initial.componentShape?.componentCount ?? 0;
  const finalComponents = final.componentShape?.componentCount ?? 0;
  if (finalComponents > initialComponents * 20) {
    lines.push(`Final topology plate ownership is massively more fragmented than initial ownership (${finalComponents} vs ${initialComponents}), pointing to downstream fragment placement or later plate mutation.`);
  } else if (finalComponents <= initialComponents + 32) {
    lines.push(`Final topology plate ownership remains near initial cohesion (${finalComponents} vs ${initialComponents}); downstream fragment placement is not shredding plate ownership in this run.`);
  }
  if (finalMeridional > initialMeridional + 0.12) {
    lines.push(`Final topology plate boundaries are materially more meridional than initial plates (${finalMeridional} vs ${initialMeridional}), pointing downstream of plates.construct.`);
  } else {
    lines.push(`Initial and final topology plate-boundary orientation are comparable (${initialMeridional} vs ${finalMeridional}).`);
  }
  const finalElevationMeridional = final.elevation?.highDeltaMeridionalTangentShare ?? 0;
  if (finalElevationMeridional > 0.62) {
    lines.push(`Final topology high-elevation-gradient edges are strongly meridional (${finalElevationMeridional}), matching the visible north-south stripe family.`);
  }
  const projected = report.projectedLayers.find((item) => item.label === 'final projected elevation');
  if (projected && projected.horizontalToVerticalHighDeltaRatio > 1.35) {
    lines.push(`Projected elevation has more high horizontal deltas than vertical deltas (ratio ${projected.horizontalToVerticalHighDeltaRatio}), consistent with vertical visual bands.`);
  }
  lines.push('This pass compares initial generation against final deep-time output only; if downstream ownership is confirmed, the next slice should add internal snapshots around fragment placement and fragment-history terrain response.');
  return lines;
}

function renderMarkdown(report: InvestigationReport): string {
  const lines = [
    '# Vertical Striping v0.3.11 Runtime and Layer Isolation',
    '',
    `Generated: ${report.generatedAt}`,
    `Seed pair: ${report.config.starSeed}:${report.config.worldSeed}`,
    `Resolution: ${report.config.outputResolution}; topology ${report.config.topologyResolution}`,
    `Final source commit: ${report.generation.finalSourceCommit ?? 'unknown'}`,
    `Total generation ms: ${report.generation.totalMs ?? 'n/a'}`,
    '',
    '## Interpretation',
    '',
    ...report.interpretation.map((line) => `- ${line}`),
    '',
    '## Topology Layers',
    '',
    '| Layer | Boundary edges | Meridional boundary share | High-gradient meridional share | Components | Long-thin component share |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.topologyLayers.map((layer) =>
      `| ${layer.label} | ${layer.plateBoundary?.boundaryEdges ?? ''} | ${layer.plateBoundary?.meridionalTangentShare ?? ''} | ${layer.elevation?.highDeltaMeridionalTangentShare ?? ''} | ${layer.componentShape?.componentCount ?? ''} | ${layer.componentShape?.longThinMeridionalShare ?? ''} |`
    ),
    '',
    '## Projected Layers',
    '',
    '| Layer | Horizontal high-delta share | Vertical high-delta share | H/V ratio | Column autocorr | Row autocorr |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.projectedLayers.map((layer) =>
      `| ${layer.label} | ${layer.horizontalHighDeltaShare} | ${layer.verticalHighDeltaShare} | ${layer.horizontalToVerticalHighDeltaRatio} | ${layer.meanColumnAutocorrelation} | ${layer.meanRowAutocorrelation} |`
    ),
    ''
  ];
  return `${lines.join('\n')}\n`;
}

function currentCommitLabel(): string {
  return process.env.VITE_WORLD_FORGE_COMMIT_SHA || process.env.GITHUB_SHA || 'local-script';
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.round((sortedValues.length - 1) * p)));
  return sortedValues[index];
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
