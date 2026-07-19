import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { climateGlaciationNode, climateGlaciationNodeId } from './climate-glaciation-node';
import { crustFieldsNode, crustFieldsNodeId } from './crust-fields-node';
import { hydrologyBiomesNode, hydrologyBiomesNodeId } from './hydrology-biomes-node';
import { plateConstructionNode, plateConstructionNodeId } from './plate-construction-node';
import { primordialTerrainNode, primordialTerrainNodeId } from './primordial-terrain-node';
import { projectionAssemblyNode, projectionAssemblyNodeId } from './projection-assembly-node';
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
    hydrologyBiomesNode,
    projectionAssemblyNode
  ]);
  return {
    measured,
    execution: runner.run(projectionAssemblyNodeId, { rootSeed: seed }, new Map([
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
          findTopologySeaLevelForOceanTarget() { return 0; },
          applyTopologyTerrainAging() {},
          applyTopologyTerrainEnrichment() {}
        }
      }],
      [waterGeologyNodeId, {
        diagnostics,
        operations: {
          assignTopologyWater(water: Uint8Array) { water.fill(1); },
          assignTopologyVolcanism() {}
        }
      }],
      [climateGlaciationNodeId, {
        config,
        values,
        tideInfluence: 0.4,
        diagnostics,
        operations: {
          generateTopologyClimate(temperature: Float32Array, wetness: Float32Array) { temperature.fill(12); wetness.fill(0.5); },
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
          generateTopologyHydrology(river: Float32Array) {
            river[0] = 1;
            return [{ path: [0, 1], terminus: 'ocean' }];
          },
          assignTopologyBiomes(biomes: Uint8Array) { biomes.fill(2); }
        }
      }],
      [projectionAssemblyNodeId, {
        outputResolution: { width: 8, height: 4 },
        diagnostics,
        operations: {
          projectTopologyToEquirectangular(elevation: Float32Array, _platesLayer: Uint16Array, water: Uint8Array, ...rest: any[]) {
            const topologyElevation = rest[11] as Float32Array;
            for (let index = 0; index < elevation.length; index += 1) {
              elevation[index] = topologyElevation[index % topologyElevation.length] ?? 0;
              water[index] = 1;
            }
          },
          projectTopologyFlowToEquirectangular(windX: Float32Array, windY: Float32Array) {
            windX.fill(0.1);
            windY.fill(-0.1);
          },
          projectTopologyRiver() {
            return { id: 'river-1', sourceIndex: 0, mouthIndex: 1, path: [0, 1], terminus: 'ocean' };
          }
        }
      }]
    ])).results.get(projectionAssemblyNodeId)
  };
}

describe('projectionAssemblyNode', () => {
  it('produces validated projected layers and river paths', () => {
    const { execution, measured } = run('projection-assembly-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.layers.elevation.length).toBe(32);
    expect(output.layers.windX.length).toBe(32);
    expect(output.rivers).toHaveLength(1);
    expect(measured).toContain('projection.equirectangular');
    expect(measured).toContain('projection.flow');
  });

  it('is deterministic for the same compatibility stream and operations', () => {
    const first = run('projection-assembly-repeat').execution?.output as any;
    const second = run('projection-assembly-repeat').execution?.output as any;
    expect(Array.from(first.layers.elevation)).toEqual(Array.from(second.layers.elevation));
    expect(first.rivers).toEqual(second.rivers);
  });
});

