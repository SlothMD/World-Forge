import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { crustFieldsNode, crustFieldsNodeId } from './crust-fields-node';
import { plateConstructionNode, plateConstructionNodeId } from './plate-construction-node';
import { primordialTerrainNode, primordialTerrainNodeId } from './primordial-terrain-node';
import { terrainFinalizationNode, terrainFinalizationNodeId } from './terrain-finalization-node';
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
  const measured: string[] = [];
  const runner = new GenerationGraphRunner([
    topologyConstructionNode,
    primordialTerrainNode,
    plateConstructionNode,
    crustFieldsNode,
    topologyElevationNode,
    terrainFinalizationNode
  ]);
  return {
    measured,
    execution: runner.run(terrainFinalizationNodeId, { rootSeed: seed }, new Map([
      [topologyConstructionNodeId, { outputResolution: config.outputResolution, topologyResolution: 16 }],
      [primordialTerrainNodeId, { values, rng }],
      [plateConstructionNodeId, { requestedPlateCount: values.plateCount, rng }],
      [crustFieldsNodeId, { values, rng }],
      [topologyElevationNodeId, { values }],
      [terrainFinalizationNodeId, {
        values,
        rng,
        diagnostics: {
          measure<T>(name: string, fn: () => T): T {
            measured.push(name);
            return fn();
          }
        },
        operations: {
          findTopologySeaLevelForOceanTarget(elevation: Float32Array) {
            const sorted = Array.from(elevation).sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.5)] ?? 0;
          },
          applyTopologyTerrainAging(elevation: Float32Array) {
            for (let index = 0; index < elevation.length; index += 1) elevation[index] -= 0.001;
          },
          applyTopologyTerrainEnrichment(elevation: Float32Array) {
            for (let index = 0; index < elevation.length; index += 1) elevation[index] += index % 2 === 0 ? 0.002 : -0.002;
          }
        }
      }]
    ])).results.get(terrainFinalizationNodeId)
  };
}

describe('terrainFinalizationNode', () => {
  it('runs terrain aging and enrichment behind a validated graph node', () => {
    const { execution, measured } = run('terrain-finalization-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.elevation.length).toBe(16 * 16 * 6);
    expect(Number.isFinite(output.preAgingSeaLevel)).toBe(true);
    expect(Number.isFinite(output.seaLevel)).toBe(true);
    expect(measured).toEqual([
      'topology.water.sea-level.pre-aging',
      'topology.terrain.aging',
      'topology.terrain.enrichment',
      'topology.water.sea-level.final'
    ]);
  });

  it('is deterministic for the same compatibility stream and operations', () => {
    const first = (run('terrain-finalization-repeat').execution?.output as any).elevation;
    const second = (run('terrain-finalization-repeat').execution?.output as any).elevation;
    expect(Array.from(first)).toEqual(Array.from(second));
  });
});

