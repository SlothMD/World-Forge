import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { crustFieldsNode, crustFieldsNodeId } from './crust-fields-node';
import { plateConstructionNode, plateConstructionNodeId } from './plate-construction-node';
import { primordialTerrainNode, primordialTerrainNodeId } from './primordial-terrain-node';
import { topologyConstructionNode, topologyConstructionNodeId } from './topology-construction-node';
import { topologyElevationNode, topologyElevationNodeId } from './topology-elevation-node';

const values = {
  systemAgeGy: 4.6,
  oceanPercentage: 68,
  averageTemperatureC: 14,
  aridity: 0.45,
  seaLevel: 0,
  axialTiltDeg: 23.4,
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

function run(seed: string) {
  const rng = new SeededRandom(seed);
  const config = createDefaultConfig(seed);
  const runner = new GenerationGraphRunner([
    topologyConstructionNode,
    primordialTerrainNode,
    plateConstructionNode,
    crustFieldsNode,
    topologyElevationNode
  ]);
  return runner.run(topologyElevationNodeId, { rootSeed: seed }, new Map([
    [topologyConstructionNodeId, { outputResolution: config.outputResolution, topologyResolution: 16 }],
    [primordialTerrainNodeId, { values, rng }],
    [plateConstructionNodeId, { requestedPlateCount: values.plateCount, rng }],
    [crustFieldsNodeId, { values, rng }],
    [topologyElevationNodeId, { values }]
  ])).results.get(topologyElevationNodeId);
}

describe('topologyElevationNode', () => {
  it('produces a validated finite layer matching topology size', () => {
    const execution = run('topology-elevation-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.elevation.length).toBe(16 * 16 * 6);
    expect(Array.from(output.elevation).every(Number.isFinite)).toBe(true);
  });

  it('is deterministic for the same compatibility stream', () => {
    const first = (run('topology-elevation-repeat')?.output as any).elevation;
    const second = (run('topology-elevation-repeat')?.output as any).elevation;
    expect(Array.from(first)).toEqual(Array.from(second));
  });
});
