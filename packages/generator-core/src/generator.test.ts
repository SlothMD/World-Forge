import { describe, expect, it } from 'vitest';
import { createDefaultConfig, generateProject } from './index';
import { exportHexGridSvg, exportHexTileMapJson, exportSvg, exportWforge, generateHexTileMap, importWforge, projectToJson } from '@world-forge/exporters';
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
    const a = projectToJson(generateProject(config));
    const b = projectToJson(generateProject(config));
    expect(hashText(a)).toBe(hashText(b));
  });

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
    expect(project.primaryWorld.layers.windX.length).toBe(config.outputResolution.width * config.outputResolution.height);
    expect(project.primaryWorld.layers.currentX.length).toBe(config.outputResolution.width * config.outputResolution.height);
  });

  it('generates non-empty atmospheric and ocean vector fields', () => {
    const project = generateProject(createDefaultConfig('climate-vector-001', { width: 256, height: 128 }));
    expect(layerHasSignal(project.primaryWorld.layers.windX)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.windY)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.currentX)).toBe(true);
    expect(layerHasSignal(project.primaryWorld.layers.currentY)).toBe(true);
  });

  it('generates and persists authoritative topology layers', async () => {
    const project = generateProject(createDefaultConfig('topology-smoke-001', { width: 128, height: 64 }));
    expect(project.primaryWorld.topology.kind).toBe('cubed-sphere');
    expect(project.primaryWorld.topology.cellCount).toBeGreaterThan(0);
    expect(project.primaryWorld.topologyLayers.elevation.length).toBe(project.primaryWorld.topology.cellCount);
    expect(project.primaryWorld.topologyLayers.plates.length).toBe(project.primaryWorld.topology.cellCount);

    const blob = await exportWforge(project);
    const file = new File([blob], 'topology-smoke-001.wforge');
    const loaded = await importWforge(file);

    expect(loaded.primaryWorld.topology.kind).toBe('cubed-sphere');
    expect(loaded.primaryWorld.topologyLayers.elevation.length).toBe(project.primaryWorld.topology.cellCount);
    expect(loaded.primaryWorld.topologyLayers.plates.length).toBe(project.primaryWorld.topology.cellCount);
  });

  it('uses plate count as topology plate count', () => {
    const config = createDefaultConfig('topology-plates-001', { width: 128, height: 64 });
    config.selectedValues = { plateCount: 14 };
    const project = generateProject(config);
    expect(project.primaryWorld.plates.length).toBe(14);
    expect(Math.max(...Array.from(project.primaryWorld.topologyLayers.plates))).toBeLessThan(14);
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

  it('exports structured JSON and simplified SVG', () => {
    const project = generateProject(createDefaultConfig('export-smoke-001', { width: 256, height: 128 }));
    const json = projectToJson(project);
    const parsed = JSON.parse(json);
    expect(parsed.seed).toBe('export-smoke-001');
    expect(parsed.primaryWorld.layers.length).toBeGreaterThan(5);

    const svg = exportSvg(project);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Simplified SVG export');
  });

  it('exports a configurable hex tile map derived from topology facts', () => {
    const project = generateProject(createDefaultConfig('hex-tile-export-001', { width: 128, height: 64 }));
    const tileMap = generateHexTileMap(project, { width: 18, height: 10, enabledFeatures: ['river', 'wet'] });
    const json = JSON.parse(exportHexTileMapJson(project, { width: 18, height: 10, enabledFeatures: ['river', 'wet'] }));
    const svg = exportHexGridSvg(project, { width: 18, height: 10 });

    expect(tileMap.format).toBe('world-forge-hex-tile-map');
    expect(tileMap.profile.id).toBe('civ7-style-default');
    expect(tileMap.tiles.length).toBe(180);
    expect(tileMap.tiles.every((tile) => tile.topologyCell >= 0 && tile.terrainType.length > 0)).toBe(true);
    expect(tileMap.tiles.every((tile) => tile.features.every((feature) => feature === 'river' || feature === 'wet'))).toBe(true);
    expect(json.tiles.length).toBe(tileMap.tiles.length);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<polygon');
  });

  it('aligns same-row hex SVG polygons without horizontal overlap', () => {
    const project = generateProject(createDefaultConfig('hex-alignment-001', { width: 128, height: 64 }));
    const svg = exportHexGridSvg(project, { width: 4, height: 3 });
    const polygons = [...svg.matchAll(/<polygon points="([^"]+)"/g)].map((match) => polygonBounds(match[1]));

    expect(polygons.length).toBe(12);
    expect(Math.abs(polygons[1].minX - polygons[0].maxX)).toBeLessThan(0.01);
    expect(Math.abs(polygons[2].minX - polygons[1].maxX)).toBeLessThan(0.01);
  });

  it('roundtrips a .wforge project package', async () => {
    const project = generateProject(createDefaultConfig('package-smoke-001', { width: 128, height: 64 }));
    const blob = await exportWforge(project);
    const file = new File([blob], 'package-smoke-001.wforge');
    const loaded = await importWforge(file);
    expect(loaded.seed).toBe(project.seed);
    expect(loaded.primaryWorld.layers.elevation.length).toBe(project.primaryWorld.layers.elevation.length);
    expect(loaded.metrics.validation.oceanWithinTolerance).toBe(true);
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

function layerHasSignal(layer: Float32Array): boolean {
  return layer.some((value) => Math.abs(value) > 0.01);
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

function polygonBounds(points: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const coordinates = points.split(' ').map((point) => point.split(',').map(Number));
  return {
    minX: Math.min(...coordinates.map(([x]) => x)),
    maxX: Math.max(...coordinates.map(([x]) => x)),
    minY: Math.min(...coordinates.map(([, y]) => y)),
    maxY: Math.max(...coordinates.map(([, y]) => y))
  };
}
