import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { climateGlaciationNode, climateGlaciationNodeId } from './climate-glaciation-node';
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
    waterGeologyNode,
    climateGlaciationNode
  ]);
  return {
    measured,
    execution: runner.run(climateGlaciationNodeId, { rootSeed: seed }, new Map([
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
          generateTopologyClimate(temperature: Float32Array, wetness: Float32Array, windX: Float32Array, windY: Float32Array, currentX: Float32Array, currentY: Float32Array) {
            for (let index = 0; index < temperature.length; index += 1) {
              temperature[index] = 12 + (index % 7);
              wetness[index] = (index % 5) / 5;
              windX[index] = 0.1;
              windY[index] = -0.1;
              currentX[index] = 0.02;
              currentY[index] = -0.02;
            }
          },
          generateTopologyClimateMoistureCandidate(climateMoisture: Float32Array, climatePrecipitation: Float32Array, climateWetnessDelta: Float32Array, _elevation: Float32Array, _water: Uint8Array, _temperature: Float32Array, wetness: Float32Array) {
            for (let index = 0; index < climateMoisture.length; index += 1) {
              climateMoisture[index] = wetness[index] * 0.9;
              climatePrecipitation[index] = wetness[index] * 0.8;
              climateWetnessDelta[index] = climateMoisture[index] - wetness[index];
            }
          },
          assignTopologyIce(ice: Uint8Array, _elevation: Float32Array, temperature: Float32Array) {
            for (let index = 0; index < ice.length; index += 1) ice[index] = temperature[index] < 13 ? 1 : 0;
          },
          generateClimatePipelinePreview() {
            return {
              pipelineVersion: 'test-climate',
              fidelity: 'preview',
              metadata: { pipelineVersion: 'test-climate', stageId: 'test', fidelity: 'preview', seed },
              calendar: {
                yearLengthDays: 365,
                seasonalFrameCount: 4,
                axialTiltDeg: values.axialTiltDeg,
                orbitalEccentricity: values.orbitalEccentricity,
                periapsisSeasonOffset: 0.13
              },
              energyBudget: {
                stellarFlux: 1,
                greenhouseHeatRetention: 0.52,
                surfaceAlbedoBase: 0.31,
                oceanHeatStorage: 0.78,
                landHeatResponse: 1,
                iceAlbedoFeedback: 0.65
              },
              seasonalFrames: [],
              circulation: {} as any,
              moisture: {} as any,
              diagnostics: {} as any,
              notes: []
            };
          }
        }
      }]
    ])).results.get(climateGlaciationNodeId)
  };
}

describe('climateGlaciationNode', () => {
  it('produces validated climate, moisture, ice, flow, and summary outputs', () => {
    const { execution, measured } = run('climate-glaciation-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.temperature.length).toBe(16 * 16 * 6);
    expect(output.ice.length).toBe(output.temperature.length);
    expect(output.climate.pipelineVersion).toBe('test-climate');
    expect(measured).toContain('topology.climate');
    expect(measured).toContain('topology.climate.moisture-candidate');
    expect(measured).toContain('topology.glaciation');
    expect(measured).toContain('topology.climate.pipeline.preview');
  });

  it('is deterministic for the same compatibility stream and operations', () => {
    const first = run('climate-glaciation-repeat').execution?.output as any;
    const second = run('climate-glaciation-repeat').execution?.output as any;
    expect(Array.from(first.temperature)).toEqual(Array.from(second.temperature));
    expect(Array.from(first.climateMoisture)).toEqual(Array.from(second.climateMoisture));
    expect(Array.from(first.ice)).toEqual(Array.from(second.ice));
  });
});
