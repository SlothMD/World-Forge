import { describe, expect, it } from 'vitest';
import { createDefaultConfig, generateProject } from './index';
import { buildCubedSphereTopology } from '../../shared/src/index';

const seeds = [
  'earthlike-default-001',
  'dry-world-001',
  'wet-world-001',
  'cold-world-001',
  'hot-world-001',
  'high-ocean-001',
  'low-ocean-001',
  'mountain-heavy-001'
];

describe('world generation MVP invariants', () => {
  it('is deterministic for the same seed and config', () => {
    const config = createDefaultConfig('earthlike-default-001', { width: 256, height: 128 });
    const a = stableProjectSignature(generateProject(config));
    const b = stableProjectSignature(generateProject(config));
    expect(hashText(a)).toBe(hashText(b));
  }, 15_000);

  it.each(seeds)('keeps required validation true for %s', (seed) => {
    const config = createDefaultConfig(seed, { width: 256, height: 128 });
    if (seed === 'dry-world-001') config.parameterRanges.aridity = { min: 0.76, max: 0.86 };
    if (seed === 'wet-world-001') config.parameterRanges.aridity = { min: 0.14, max: 0.24 };
    if (seed === 'cold-world-001') config.parameterRanges.averageTemperatureC = { min: -4, max: 2, unit: 'C' };
    if (seed === 'hot-world-001') config.parameterRanges.averageTemperatureC = { min: 24, max: 30, unit: 'C' };
    if (seed === 'high-ocean-001') config.parameterRanges.oceanPercentage = { min: 78, max: 82, unit: '%' };
    if (seed === 'low-ocean-001') config.parameterRanges.oceanPercentage = { min: 30, max: 35, unit: '%' };

    const project = generateProject(config);
    expect(project.metrics.validation.oceanWithinTolerance).toBe(true);
    expect(project.metrics.validation.riverPathsValid).toBe(true);
    expect(project.primaryWorld.rivers.length).toBeGreaterThan(0);
    expect(project.primaryWorld.layers.biomes.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.diagnostics?.phases.some((phase) => phase.name === 'topology.build')).toBe(true);
    expect(project.diagnostics?.phases.some((phase) => phase.name === 'topology.terrain.primordial')).toBe(true);
    expect(project.primaryWorld.layers.windX.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.primaryWorld.layers.currentX.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.primaryWorld.layers.climateMoisture.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.primaryWorld.layers.climatePrecipitation.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.primaryWorld.layers.climateWetnessDelta.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.diagnostics?.phases.some((phase) => phase.name === 'topology.terrain.aging.coasts')).toBe(true);
  });

  it('generates non-empty atmospheric and ocean vector fields', () => {
    const project = generateProject(createDefaultConfig('climate-vector-001', { width: 256, height: 128 }));
    expect(layerHasSignal(project.primaryWorld.layers.windX)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.windY)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.currentX)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.currentY)).toBe(true);
    const deflection = windDeflectionByTerrain(project);
    expect(deflection.highland).toBeGreaterThan(deflection.lowland + 0.04);
  });

  it('forms recognizable ocean current gyre and equatorial bands', () => {
    const project = generateProject(createDefaultConfig('2883711', { width: 256, height: 128 }));
    const bands = oceanCurrentBandStats(project);
    const currents = project.primaryWorld.climate?.circulation?.oceanCurrents;
    const windCurl = projectedVectorCurlSignal(project.primaryWorld.layers.windX, project.primaryWorld.layers.windY, project.primaryWorld.layers.water, project.primaryWorld.mapModel.resolution.width, project.primaryWorld.mapModel.resolution.height, false);

    expect(bands.equatorialWestwardX).toBeLessThan(-0.08);
    expect(bands.equatorialCounterCurrentX).toBeGreaterThan(0.03);
    expect(bands.subtropicalCurrentSpeed).toBeGreaterThan(0.16);
    expect(currents?.northernGyreSignal ?? 0).toBeGreaterThan(0.1);
    expect(currents?.southernGyreSignal ?? 0).toBeGreaterThan(0.1);
    expect(windCurl).toBeGreaterThan(0.22);
  });

  it('emits compact climate pipeline summaries for generated worlds', () => {
    const project = generateProject(createDefaultConfig('climate-pipeline-001', { width: 256, height: 128 }));
    const climate = project.primaryWorld.climate;

    expect(climate?.pipelineVersion).toBe('climate_pipeline_v1');
    expect(climate?.fidelity).toBe('preview');
    expect(climate?.seasonalFrames.length).toBe(4);
    expect(climate?.diagnostics.landSeasonalSwingC).toBeGreaterThan(climate?.diagnostics.oceanSeasonalSwingC ?? 0);
    expect(climate?.circulation?.bands.length).toBe(6);
    expect(Math.abs(climate?.circulation?.itczLatitudeDeg ?? 99)).toBeLessThanOrEqual(28);
    expect(climate?.circulation?.windTopographicDeflectionIndex ?? 0).toBeGreaterThan(0);
    expect(climate?.circulation?.meanOrographicLiftIndex ?? 0).toBeGreaterThan(0);
    expect(climate?.circulation?.oceanCurrents.meanCurrentSpeed ?? 0).toBeGreaterThan(0);
    expect(climate?.circulation?.oceanCurrents.oceanCellShare ?? 0).toBeGreaterThan(0.2);
    expect(climate?.moisture?.meanCandidateWetness ?? -1).toBeGreaterThanOrEqual(0);
    expect(climate?.moisture?.meanCandidateWetness ?? 2).toBeLessThanOrEqual(1);
    expect(climate?.moisture?.wetnessCorrelation ?? 0).toBeGreaterThan(0.1);
    expect(climate?.moisture?.riverSourceSupportIndex ?? 0).toBeGreaterThan(0);
  });

  it('responds to aridity in the climate moisture candidate layer', () => {
    const dryConfig = createDefaultConfig('climate-moisture-001', { width: 256, height: 128 });
    dryConfig.selectedValues = { aridity: 0.9 };
    const wetConfig = createDefaultConfig('climate-moisture-001', { width: 256, height: 128 });
    wetConfig.selectedValues = { aridity: 0.12 };

    const dry = generateProject(dryConfig).primaryWorld.climate?.moisture;
    const wet = generateProject(wetConfig).primaryWorld.climate?.moisture;

    expect(wet?.meanCandidateWetness ?? 0).toBeGreaterThan((dry?.meanCandidateWetness ?? 1) + 0.04);
    expect(wet?.wetCellShare ?? 0).toBeGreaterThan(dry?.wetCellShare ?? 1);
  });

  it('uses axial tilt to increase seasonal climate swing', () => {
    const lowTiltConfig = createDefaultConfig('tilt-climate-001', { width: 256, height: 128 });
    lowTiltConfig.selectedValues = { axialTiltDeg: 5 };
    const highTiltConfig = createDefaultConfig('tilt-climate-001', { width: 256, height: 128 });
    highTiltConfig.selectedValues = { axialTiltDeg: 45 };

    const lowTilt = generateProject(lowTiltConfig).primaryWorld.climate;
    const highTilt = generateProject(highTiltConfig).primaryWorld.climate;

    expect(highTilt?.diagnostics.landSeasonalSwingC ?? 0).toBeGreaterThan((lowTilt?.diagnostics.landSeasonalSwingC ?? 0) + 1);
    expect(highTilt?.diagnostics.axialTiltSeasonalityC ?? 0).toBeGreaterThan(lowTilt?.diagnostics.axialTiltSeasonalityC ?? 0);
  });

  it('reports stronger ice albedo cooling on cold worlds than hot worlds', () => {
    const coldConfig = createDefaultConfig('ice-albedo-001', { width: 256, height: 128 });
    coldConfig.selectedValues = { averageTemperatureC: -4 };
    const hotConfig = createDefaultConfig('ice-albedo-001', { width: 256, height: 128 });
    hotConfig.selectedValues = { averageTemperatureC: 28 };

    const cold = generateProject(coldConfig).primaryWorld.climate;
    const hot = generateProject(hotConfig).primaryWorld.climate;

    expect(cold?.diagnostics.meanIceAlbedoCoolingC ?? 0).toBeGreaterThan(hot?.diagnostics.meanIceAlbedoCoolingC ?? 0);
  });

  it('uses plate count as topology plate count', () => {
    const config = createDefaultConfig('topology-plates-001', { width: 128, height: 64 });
    config.selectedValues = { plateCount: 14 };
    const project = generateProject(config);
    expect(project.primaryWorld.plates.length).toBe(14);
    expect(Math.max(...Array.from(project.primaryWorld.topologyLayers.plates))).toBeLessThan(14);
  });

  it('keeps source topology stable when only projected map size changes', () => {
    const baseConfig = createDefaultConfig('resolution-stability-001', { width: 256, height: 128 });
    const largerConfig = {
      ...baseConfig,
      outputResolution: { width: 512, height: 256 }
    };

    const base = generateProject(baseConfig);
    const larger = generateProject(largerConfig);

    expect(larger.primaryWorld.topology.resolution).toBe(base.primaryWorld.topology.resolution);
    expect(hashTypedArray(larger.primaryWorld.topologyLayers.water)).toBe(hashTypedArray(base.primaryWorld.topologyLayers.water));
    expect(hashLayer(larger.primaryWorld.topologyLayers.elevation)).toBe(hashLayer(base.primaryWorld.topologyLayers.elevation));
    expect(larger.primaryWorld.layers.elevation.length).toBe(512 * 256);
  });

  it('forms multiple continent-scale landmasses for the default app seed', () => {
    const project = generateProject(createDefaultConfig('1001001', { width: 256, height: 128 }));
    const components = landComponentSizes(project.primaryWorld.topologyLayers.water, project.primaryWorld.topology.resolution);
    const landCells = components.reduce((sum, count) => sum + count, 0);
    const largest = components[0] / landCells;
    const substantial = components.filter((count) => count / landCells > 0.04).length;

    expect(largest).toBeLessThan(0.7);
    expect(substantial).toBeGreaterThanOrEqual(3);
  });

  it('keeps most marine area below the immediate coastal shelf band', () => {
    const project = generateProject(createDefaultConfig('2883711', { width: 256, height: 128 }));
    const depth = marineDepthShares(project);

    expect(depth.immediateShelf).toBeLessThan(0.26);
    expect(depth.deepOcean).toBeGreaterThan(0.28);
  });

  it('uses continent count to vary landmass component count', () => {
    const fewConfig = createDefaultConfig('continent-count-001', { width: 256, height: 128 });
    fewConfig.selectedValues = { continentCount: 2, continentScale: 0.72, islandDensity: 0.15 };
    const manyConfig = createDefaultConfig('continent-count-001', { width: 256, height: 128 });
    manyConfig.selectedValues = { continentCount: 8, continentScale: 0.42, islandDensity: 0.35 };

    const few = generateProject(fewConfig);
    const many = generateProject(manyConfig);
    const fewComponents = substantialLandComponents(few.primaryWorld.topologyLayers.water, few.primaryWorld.topology.resolution);
    const manyComponents = substantialLandComponents(many.primaryWorld.topologyLayers.water, many.primaryWorld.topology.resolution);
    const fewLargest = largestLandComponentShare(few.primaryWorld.topologyLayers.water, few.primaryWorld.topology.resolution);
    const manyLargest = largestLandComponentShare(many.primaryWorld.topologyLayers.water, many.primaryWorld.topology.resolution);

    expect(manyComponents).toBeGreaterThanOrEqual(fewComponents);
    expect(manyLargest).toBeLessThan(fewLargest);
  });

  it('routes topology rivers to ocean or visible lake termini', () => {
    const project = generateProject(createDefaultConfig('river-terminus-001', { width: 256, height: 128 }));
    const rivers = project.primaryWorld.rivers;
    expect(rivers.length).toBeGreaterThan(0);
    expect(rivers.every((river) => river.terminus === 'ocean' || river.terminus === 'lake' || river.terminus === 'wetland')).toBe(true);
    expect(project.primaryWorld.topologyLayers.river.some((value) => value > 0.08)).toBe(true);
    expect(project.primaryWorld.topologyLayers.lakes.some((value) => value === 1)).toBe(true);
  });

  it('uses world age to change impact and weathering terrain evolution', () => {
    const youngConfig = createDefaultConfig('terrain-aging-001', { width: 256, height: 128 });
    const oldConfig = createDefaultConfig('terrain-aging-001', { width: 256, height: 128 });
    youngConfig.selectedValues = { systemAgeGy: 0.8 };
    oldConfig.selectedValues = { systemAgeGy: 8.5 };

    const young = generateProject(youngConfig);
    const old = generateProject(oldConfig);

    expect(hashLayer(young.primaryWorld.layers.elevation)).not.toBe(hashLayer(old.primaryWorld.layers.elevation));
    expect(old.metrics.validation.oceanWithinTolerance).toBe(true);
    expect(old.metrics.validation.riverPathsValid).toBe(true);
  });

  it('emits non-authoritative preview frames during generation', () => {
    const frames: Array<{ stage: string; label: string; progress: number; width: number; height: number; bytes: number }> = [];
    const project = generateProject(createDefaultConfig('preview-stream-001', { width: 128, height: 64 }), {
      previewResolution: { width: 96, height: 48 },
      onProgress: (frame) => {
        frames.push({
          stage: frame.stage,
          label: frame.label,
          progress: frame.progress,
          width: frame.width,
          height: frame.height,
          bytes: frame.rgba.byteLength
        });
      }
    });

    expect(project.seed).toBe('preview-stream-001');
    expect(frames.length).toBeGreaterThanOrEqual(6);
    expect(frames[0].label).toBe('Primordial terrain');
    expect(frames.some((frame) => frame.stage === 'drift')).toBe(false);
    expect(frames.at(-1)?.label).toBe('Biomes settling');
    expect(frames.every((frame) => frame.width === 96 && frame.height === 48 && frame.bytes === 96 * 48 * 4)).toBe(true);
    expect(frames.every((frame, index) => index === 0 || frame.progress >= frames[index - 1].progress)).toBe(true);
  });

});

function hashText(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function hashLayer(layer: Float32Array): string {
  let h = 2166136261;
  for (const value of layer) {
    h ^= Math.round(value * 100000);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function stableProjectSignature(project: ReturnType<typeof generateProject>): string {
  return JSON.stringify({
    seed: project.seed,
    selectedValues: project.selectedValues,
    metrics: project.metrics,
    climate: project.primaryWorld.climate?.diagnostics,
    elevation: hashLayer(project.primaryWorld.layers.elevation),
    biomes: hashTypedArray(project.primaryWorld.layers.biomes),
    rivers: project.primaryWorld.rivers.map((river) => [river.sourceIndex, river.mouthIndex, river.terminus, river.path.length, river.topologyPath?.length ?? 0])
  });
}

function hashTypedArray(layer: Uint8Array | Uint16Array): string {
  let h = 2166136261;
  for (const value of layer) {
    h ^= value;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function layerHasSignal(layer: Float32Array): boolean {
  return layer.some((value) => Math.abs(value) > 0.01);
}

function windDeflectionByTerrain(project: ReturnType<typeof generateProject>): { highland: number; lowland: number } {
  const { elevation, water, windX, windY } = project.primaryWorld.layers;
  const { width, height } = project.primaryWorld.mapModel.resolution;
  let highland = 0;
  let highlandCount = 0;
  let lowland = 0;
  let lowlandCount = 0;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const ideal = idealProjectedWind(latitude);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (water[index] === 1) continue;
    const magnitude = Math.max(0.001, Math.hypot(windX[index], windY[index]));
      const idealMagnitude = Math.max(0.001, Math.hypot(ideal.x, ideal.y));
      const alignment = (windX[index] / magnitude) * (ideal.x / idealMagnitude) + (windY[index] / magnitude) * (ideal.y / idealMagnitude);
      const deflection = 1 - Math.max(0, alignment);
    if (elevation[index] > project.primaryWorld.seaLevel + 0.32) {
        highland += deflection;
      highlandCount += 1;
    } else if (elevation[index] < project.primaryWorld.seaLevel + 0.16) {
        lowland += deflection;
      lowlandCount += 1;
    }
  }
  }
  return {
    highland: highland / Math.max(1, highlandCount),
    lowland: lowland / Math.max(1, lowlandCount)
  };
}

function idealProjectedWind(latitude: number): { x: number; y: number } {
  const lat01 = latitude / (Math.PI / 2);
  const absLat = Math.abs(lat01);
  const hemisphere = latitude < 0 ? -1 : 1;
  const cellBand = absLat < 0.33 ? 0 : absLat < 0.66 ? 1 : 2;
  const zonalDirection = cellBand === 1 ? -hemisphere : hemisphere;
  const pressureGradient = cellBand === 0 ? -lat01 : cellBand === 1 ? hemisphere * 0.42 : -hemisphere * 0.28;
  return { x: zonalDirection, y: pressureGradient * 0.35 };
}

function oceanCurrentBandStats(project: ReturnType<typeof generateProject>): { equatorialWestwardX: number; equatorialCounterCurrentX: number; subtropicalCurrentSpeed: number } {
  const { currentX, currentY, water } = project.primaryWorld.layers;
  const { width, height } = project.primaryWorld.mapModel.resolution;
  let equatorialWestwardX = 0;
  let equatorialWestwardCount = 0;
  let equatorialCounterCurrentX = 0;
  let equatorialCounterCurrentCount = 0;
  let subtropicalCurrentSpeed = 0;
  let subtropicalCurrentCount = 0;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const absLat = Math.abs(latitude);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (water[index] !== 1) continue;
      if (absLat > 0.12 && absLat < 0.35) {
        equatorialWestwardX += currentX[index];
        equatorialWestwardCount += 1;
      } else if (absLat < 0.07) {
        equatorialCounterCurrentX += currentX[index];
        equatorialCounterCurrentCount += 1;
      } else if (absLat > 0.35 && absLat < 0.85) {
        subtropicalCurrentSpeed += Math.hypot(currentX[index], currentY[index]);
        subtropicalCurrentCount += 1;
      }
    }
  }
  return {
    equatorialWestwardX: equatorialWestwardX / Math.max(1, equatorialWestwardCount),
    equatorialCounterCurrentX: equatorialCounterCurrentX / Math.max(1, equatorialCounterCurrentCount),
    subtropicalCurrentSpeed: subtropicalCurrentSpeed / Math.max(1, subtropicalCurrentCount)
  };
}

function projectedVectorCurlSignal(xLayer: Float32Array, yLayer: Float32Array, water: Uint8Array, width: number, height: number, waterOnly: boolean): number {
  let signal = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const absLat = Math.abs(latitude);
    if (absLat < 0.15 || absLat > 1.1) continue;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (waterOnly && water[index] !== 1) continue;
      const longitude = (x / width) * Math.PI * 2 - Math.PI;
      signal += Math.abs(xLayer[index] * Math.sin(longitude) - yLayer[index] * Math.cos(longitude));
      count += 1;
    }
  }
  return signal / Math.max(1, count);
}

function landComponentSizes(water: Uint8Array, topologyResolution: number): number[] {
  const topology = buildCubedSphereTopology(topologyResolution);
  const seen = new Uint8Array(water.length);
  const components: number[] = [];
  for (let cell = 0; cell < water.length; cell += 1) {
    if (water[cell] === 1 || seen[cell]) continue;
    let count = 0;
    const stack = [cell];
    seen[cell] = 1;
    while (stack.length) {
      const current = stack.pop()!;
      count += 1;
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[current * 4 + i];
        if (neighbor >= 0 && water[neighbor] === 0 && !seen[neighbor]) {
          seen[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    components.push(count);
  }
  return components.sort((a, b) => b - a);
}

function substantialLandComponents(water: Uint8Array, topologyResolution: number): number {
  const components = landComponentSizes(water, topologyResolution);
  const landCells = components.reduce((sum, count) => sum + count, 0);
  if (landCells === 0) return 0;
  return components.filter((count) => count / landCells > 0.04).length;
}

function largestLandComponentShare(water: Uint8Array, topologyResolution: number): number {
  const components = landComponentSizes(water, topologyResolution);
  const landCells = components.reduce((sum, count) => sum + count, 0);
  if (landCells === 0) return 0;
  return components[0] / landCells;
}

function marineDepthShares(project: ReturnType<typeof generateProject>): { immediateShelf: number; deepOcean: number } {
  const world = project.primaryWorld;
  let marine = 0;
  let immediateShelf = 0;
  let deepOcean = 0;
  for (let index = 0; index < world.layers.water.length; index += 1) {
    if (world.layers.water[index] !== 1) continue;
    marine += 1;
    const depth = world.seaLevel - world.layers.elevation[index];
    if (depth <= 0.055) immediateShelf += 1;
    if (depth >= 0.24) deepOcean += 1;
  }
  return {
    immediateShelf: immediateShelf / Math.max(1, marine),
    deepOcean: deepOcean / Math.max(1, marine)
  };
}
