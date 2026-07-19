import { describe, expect, it } from 'vitest';
import { Biome, TopologyLayers, biomeToCode, buildCubedSphereTopology } from '@world-forge/shared';
import { buildFlatWorldHexOverlay } from './worldHexOverlay';
import { buildWorldRegions } from './worldRegions';

describe('world region scaffold', () => {
  it('summarizes stable topology regions for later regional detail generation', () => {
    const topology = buildCubedSphereTopology(4);
    const layers = testLayers(topology.cellCount);
    const regions = buildWorldRegions(topology, layers, 3, 6, buildFlatWorldHexOverlay(1));

    expect(regions.modelVersion).toBe('world-regions-v1');
    expect(regions.regions).toHaveLength(18);
    expect(regions.regions[0].id).toBe('region-r01-c01');
    expect(regions.regions.every((region) => region.level === 'region')).toBe(true);
    expect(regions.regions.every((region) => region.subdivision.childLevel === 'subregion')).toBe(true);
    expect(regions.regions.reduce((sum, region) => sum + region.topologyCellCount, 0)).toBe(topology.cellCount);
    expect(regions.regions.some((region) => region.highestPoint)).toBe(true);
    expect(regions.regions.some((region) => region.largestRiver)).toBe(true);
    expect(regions.regions.every((region) => region.hexCoverage?.[0]?.levelId === 'world-60mi')).toBe(true);
    expect(regions.crossRegionEntities).toEqual([]);
  });
});

function testLayers(cellCount: number): TopologyLayers {
  const elevation = new Float32Array(cellCount);
  const plates = new Uint16Array(cellCount);
  const water = new Uint8Array(cellCount);
  const temperature = new Float32Array(cellCount);
  const wetness = new Float32Array(cellCount);
  const climateMoisture = new Float32Array(cellCount);
  const climatePrecipitation = new Float32Array(cellCount);
  const climateWetnessDelta = new Float32Array(cellCount);
  const biomes = new Uint8Array(cellCount);
  const ice = new Uint8Array(cellCount);
  const river = new Float32Array(cellCount);
  const lakes = new Uint8Array(cellCount);
  const volcanism = new Float32Array(cellCount);

  for (let cell = 0; cell < cellCount; cell += 1) {
    const land = cell % 3 !== 0;
    elevation[cell] = land ? cell / cellCount : -0.25;
    water[cell] = land ? 0 : 1;
    biomes[cell] = biomeToCode((land ? 'forest' : 'ocean') as Biome);
    river[cell] = land && cell % 17 === 0 ? 0.8 : 0;
  }

  return {
    elevation,
    plates,
    water,
    temperature,
    wetness,
    climateMoisture,
    climatePrecipitation,
    climateWetnessDelta,
    biomes,
    ice,
    river,
    lakes,
    volcanism
  };
}
