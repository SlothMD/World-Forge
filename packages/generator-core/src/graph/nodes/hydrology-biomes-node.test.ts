import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { climateGlaciationNode, climateGlaciationNodeId } from './climate-glaciation-node';
import { crustFieldsNode, crustFieldsNodeId } from './crust-fields-node';
import { hydrologyBiomesNode, hydrologyBiomesNodeId } from './hydrology-biomes-node';
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
    waterGeologyNode,
    climateGlaciationNode,
    hydrologyBiomesNode
  ]);
  return {
    measured,
    execution: runner.run(hydrologyBiomesNodeId, { rootSeed: seed }, new Map([
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
          assignTopologyVolcanism() {}
        }
      }],
      [climateGlaciationNodeId, {
        config,
        values,
        tideInfluence: 0.4,
        diagnostics,
        operations: {
          generateTopologyClimate(temperature: Float32Array, wetness: Float32Array) {
            temperature.fill(12);
            wetness.fill(0.5);
          },
          generateTopologyClimateMoistureCandidate(climateMoisture: Float32Array, climatePrecipitation: Float32Array, climateWetnessDelta: Float32Array) {
            climateMoisture.fill(0.5);
            climatePrecipitation.fill(0.4);
            climateWetnessDelta.fill(0);
          },
          assignTopologyIce() {},
          generateClimatePipelinePreview() {
            return { pipelineVersion: 'test-climate', fidelity: 'preview', metadata: {} as any, calendar: {} as any, energyBudget: {} as any, seasonalFrames: [], circulation: {} as any, moisture: {} as any, diagnostics: {} as any, notes: [] };
          }
        }
      }],
      [hydrologyBiomesNodeId, {
        values,
        diagnostics,
        operations: {
          generateTopologyHydrology(river: Float32Array, lakes: Uint8Array) {
            river[0] = 1;
            lakes[1] = 1;
            return [{ path: [0, 1], terminus: 'lake' }];
          },
          assignTopologyBiomes(biomes: Uint8Array, ice: Uint8Array, _elevation: Float32Array, water: Uint8Array) {
            for (let index = 0; index < biomes.length; index += 1) biomes[index] = water[index] ? 0 : ice[index] ? 1 : 4;
          }
        }
      }]
    ])).results.get(hydrologyBiomesNodeId)
  };
}

describe('hydrologyBiomesNode', () => {
  it('produces validated hydrology and biome layers', () => {
    const { execution, measured } = run('hydrology-biomes-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.river.length).toBe(16 * 16 * 6);
    expect(output.lakes.length).toBe(output.river.length);
    expect(output.biomes.length).toBe(output.river.length);
    expect(output.topologyRivers).toEqual([{ path: [0, 1], terminus: 'lake' }]);
    expect(measured).toContain('topology.hydrology');
    expect(measured).toContain('topology.biomes');
  });

  it('is deterministic for the same compatibility stream and operations', () => {
    const first = run('hydrology-biomes-repeat').execution?.output as any;
    const second = run('hydrology-biomes-repeat').execution?.output as any;
    expect(Array.from(first.river)).toEqual(Array.from(second.river));
    expect(Array.from(first.biomes)).toEqual(Array.from(second.biomes));
  });
});

