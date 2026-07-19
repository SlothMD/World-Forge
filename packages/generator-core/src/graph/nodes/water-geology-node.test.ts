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
import { waterGeologyNode, waterGeologyNodeId } from './water-geology-node';

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
  const diagnostics = {
    measure<T>(name: string, fn: () => T): T {
      measured.push(name);
      return fn();
    }
  };
  const runner = new GenerationGraphRunner([
    topologyConstructionNode,
    primordialTerrainNode,
    plateConstructionNode,
    crustFieldsNode,
    topologyElevationNode,
    terrainFinalizationNode,
    waterGeologyNode
  ]);
  return {
    measured,
    execution: runner.run(waterGeologyNodeId, { rootSeed: seed }, new Map([
      [topologyConstructionNodeId, { outputResolution: config.outputResolution, topologyResolution: 16 }],
      [primordialTerrainNodeId, { values, rng }],
      [plateConstructionNodeId, { requestedPlateCount: values.plateCount, rng }],
      [crustFieldsNodeId, { values, rng }],
      [topologyElevationNodeId, { values }],
      [terrainFinalizationNodeId, {
        values,
        rng,
        diagnostics,
        operations: {
          findTopologySeaLevelForOceanTarget(elevation: Float32Array) {
            return Array.from(elevation).sort((a, b) => a - b)[Math.floor(elevation.length * 0.5)] ?? 0;
          },
          applyTopologyTerrainAging() {},
          applyTopologyTerrainEnrichment() {}
        }
      }],
      [waterGeologyNodeId, {
        diagnostics,
        operations: {
          assignTopologyWater(water: Uint8Array, elevation: Float32Array, seaLevel: number) {
            for (let index = 0; index < water.length; index += 1) water[index] = elevation[index] <= seaLevel ? 1 : 0;
          },
          assignTopologyVolcanism(volcanism: Float32Array, elevation: Float32Array) {
            for (let index = 0; index < volcanism.length; index += 1) volcanism[index] = Math.max(0, elevation[index]) * 0.1;
          }
        }
      }]
    ])).results.get(waterGeologyNodeId)
  };
}

describe('waterGeologyNode', () => {
  it('produces validated water and volcanism layers', () => {
    const { execution, measured } = run('water-geology-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.water.length).toBe(16 * 16 * 6);
    expect(output.volcanism.length).toBe(output.water.length);
    expect(measured).toContain('topology.water.mask');
    expect(measured).toContain('topology.volcanism');
  });

  it('is deterministic for the same compatibility stream and operations', () => {
    const first = run('water-geology-repeat').execution?.output as any;
    const second = run('water-geology-repeat').execution?.output as any;
    expect(Array.from(first.water)).toEqual(Array.from(second.water));
    expect(Array.from(first.volcanism)).toEqual(Array.from(second.volcanism));
  });
});

