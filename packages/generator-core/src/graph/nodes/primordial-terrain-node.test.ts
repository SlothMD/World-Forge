import { describe, expect, it } from 'vitest';
import { SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import {
  primordialTerrainNode,
  primordialTerrainNodeId,
  PrimordialTerrainOutput
} from './primordial-terrain-node';
import {
  topologyConstructionNode,
  topologyConstructionNodeId
} from './topology-construction-node';

const values: SelectedValues = {
  systemAgeGy: 4.6,
  oceanPercentage: 67,
  averageTemperatureC: 15,
  aridity: 0.42,
  seaLevel: 0,
  axialTiltDeg: 23.5,
  orbitalEccentricity: 0.017,
  sizeClass: 1,
  moonCount: 1,
  impactFrequency: 1,
  plateCount: 18,
  riverDensity: 1.6,
  continentCount: 5,
  continentScale: 0.55,
  islandDensity: 0.4,
  oceanTolerancePercentagePoints: 5
};

describe('primordialTerrainNode', () => {
  it('executes after topology construction and returns matching layer lengths', () => {
    const run = runPrimordial('primordial-node-test');
    const topology = run.results.get(topologyConstructionNodeId)?.output as { topology: { cellCount: number } };
    const primordial = run.results.get(primordialTerrainNodeId)?.output as PrimordialTerrainOutput;

    expect(primordial.elevation.length).toBe(topology.topology.cellCount);
    expect(primordial.crustAge.length).toBe(topology.topology.cellCount);
    expect(primordial.crustThickness.length).toBe(topology.topology.cellCount);
    expect(primordial.basin.length).toBe(topology.topology.cellCount);
    expect(primordial.impact.length).toBe(topology.topology.cellCount);
    expect(run.results.get(primordialTerrainNodeId)?.validation?.valid).toBe(true);
  });

  it('is deterministic when starting from the same RNG state', () => {
    const first = runPrimordial('fixed-seed').results.get(primordialTerrainNodeId)?.output as PrimordialTerrainOutput;
    const second = runPrimordial('fixed-seed').results.get(primordialTerrainNodeId)?.output as PrimordialTerrainOutput;

    expect(Array.from(first.elevation)).toEqual(Array.from(second.elevation));
    expect(Array.from(first.crustAge)).toEqual(Array.from(second.crustAge));
    expect(Array.from(first.crustThickness)).toEqual(Array.from(second.crustThickness));
    expect(Array.from(first.basin)).toEqual(Array.from(second.basin));
    expect(Array.from(first.impact)).toEqual(Array.from(second.impact));
  });

  it('advances the supplied compatibility RNG rather than creating a hidden stream', () => {
    const rng = new SeededRandom('shared-stream');
    const control = new SeededRandom('shared-stream');
    const runner = new GenerationGraphRunner([topologyConstructionNode, primordialTerrainNode]);
    runner.run(
      primordialTerrainNodeId,
      { rootSeed: 'shared-stream' },
      new Map([
        [topologyConstructionNodeId, { outputResolution: { width: 64, height: 32 }, topologyResolution: 16 }],
        [primordialTerrainNodeId, { values, rng }]
      ])
    );

    expect(rng.next()).not.toBe(control.next());
  });
});

function runPrimordial(seed: string) {
  const runner = new GenerationGraphRunner([topologyConstructionNode, primordialTerrainNode]);
  return runner.run(
    primordialTerrainNodeId,
    { rootSeed: seed },
    new Map([
      [topologyConstructionNodeId, { outputResolution: { width: 64, height: 32 }, topologyResolution: 16 }],
      [primordialTerrainNodeId, { values, rng: new SeededRandom(seed) }]
    ])
  );
}
