import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './index';
import { generateProjectWithDeepTime } from './deepTimePipeline';

function testConfig(seed: string, overrides: Record<string, number> = {}) {
  const config = createDefaultConfig(seed, { width: 64, height: 32 });
  return {
    ...config,
    topologyResolution: 16,
    outputResolution: { width: 64, height: 32 },
    selectedValues: {
      ...(config.selectedValues ?? {}),
      systemAgeGy: 4.6,
      oceanPercentage: 68,
      averageTemperatureC: 14,
      axialTiltDeg: 23.4,
      orbitalEccentricity: 0.02,
      riverDensity: 1.6,
      oceanTolerancePercentagePoints: 5,
      ...overrides
    }
  };
}

describe('deep-time generator-core pipeline', () => {
  it('is deterministic for the same seed and configuration', () => {
    const first = generateProjectWithDeepTime(testConfig('deep-time-determinism'));
    const second = generateProjectWithDeepTime(testConfig('deep-time-determinism'));

    expect(first.primaryWorld.seaLevel).toBe(second.primaryWorld.seaLevel);
    expect(Array.from(first.primaryWorld.topologyLayers.elevation)).toEqual(Array.from(second.primaryWorld.topologyLayers.elevation));
    expect(Array.from(first.primaryWorld.layers.water)).toEqual(Array.from(second.primaryWorld.layers.water));
    expect(first.primaryWorld.rivers).toEqual(second.primaryWorld.rivers);
    expect(first.primaryWorld.deepTime).toEqual(second.primaryWorld.deepTime);
  });

  it('rebuilds final layers from aged topology', () => {
    const project = generateProjectWithDeepTime(testConfig('deep-time-consistency'));
    const world = project.primaryWorld;

    expect(world.deepTime.modelVersion).toBe('deep-time-foundation-v3');
    expect(world.deepTime.fragmentHistory?.modelVersion).toBe('fragment-history-diagnostics-v13');
    expect('legacyTectonicKeyframeCount' in (world.deepTime.fragmentHistory ?? {})).toBe(false);
    expect(world.deepTime.epochs.length).toBeGreaterThan(0);
    expect(world.deepTime.consistency.climateCellsRefreshed).toBe(world.topology.cellCount);
    expect(world.deepTime.consistency.hydrologyCellsRebuilt).toBe(world.topology.cellCount);
    expect(world.deepTime.consistency.projectedCellsRefreshed).toBe(world.layers.water.length);
    expect(project.metrics.oceanPercentage).toBeCloseTo(world.oceanPercentage, 5);

    for (let index = 0; index < world.layers.water.length; index += 1) {
      if (world.layers.water[index]) {
        expect(world.layers.ice[index]).toBe(0);
        expect(world.layers.river[index]).toBe(0);
      }
    }

    expect(project.metrics.validation.riverPathsValid).toBe(true);
    expect(world.rivers.every((river) => river.path.length > 1)).toBe(true);
  });

  it('keeps persistent polar ice on a cold controlled world', () => {
    const project = generateProjectWithDeepTime(testConfig('deep-time-polar-ice', {
      oceanPercentage: 52,
      averageTemperatureC: 5,
      axialTiltDeg: 20
    }));
    const iceCells = Array.from(project.primaryWorld.layers.ice).filter(Boolean).length;

    expect(project.primaryWorld.deepTime.persistentIceCells).toBeGreaterThan(0);
    expect(iceCells).toBeGreaterThan(0);
  });
});
