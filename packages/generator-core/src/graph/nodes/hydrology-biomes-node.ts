import { BiomeClassificationRule, CubedSphereTopology, River, SelectedValues } from '@world-forge/shared';
import { ClimateGlaciationOutput, climateGlaciationNodeId } from './climate-glaciation-node';
import { GenerationNode, NodeValidationResult } from '../types';
import { TerrainFinalizationOutput, terrainFinalizationNodeId } from './terrain-finalization-node';
import { TopologyConstructionOutput, topologyConstructionNodeId } from './topology-construction-node';
import { WaterGeologyOutput, waterGeologyNodeId } from './water-geology-node';

export const hydrologyBiomesNodeId = 'ecology.hydrology-biomes';

export type TopologyRiverPath = {
  path: number[];
  terminus: River['terminus'];
};

export type HydrologyBiomesDiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
};

export type HydrologyBiomesOperations = {
  generateTopologyHydrology(
    river: Float32Array,
    lakes: Uint8Array,
    elevation: Float32Array,
    water: Uint8Array,
    wetness: Float32Array,
    topology: CubedSphereTopology,
    seaLevel: number,
    riverDensity: number
  ): TopologyRiverPath[];
  assignTopologyBiomes(
    biomes: Uint8Array,
    ice: Uint8Array,
    elevation: Float32Array,
    water: Uint8Array,
    temperature: Float32Array,
    wetness: Float32Array,
    river: Float32Array,
    lakes: Uint8Array,
    topology: CubedSphereTopology,
    seaLevel: number,
    biomeRules?: BiomeClassificationRule[]
  ): void;
};

export type HydrologyBiomesInput = {
  values: SelectedValues;
  biomeRules?: BiomeClassificationRule[];
  diagnostics: HydrologyBiomesDiagnosticsRecorder;
  operations: HydrologyBiomesOperations;
};

export type HydrologyBiomesOutput = {
  river: Float32Array;
  lakes: Uint8Array;
  biomes: Uint8Array;
  topologyRivers: TopologyRiverPath[];
};

export const hydrologyBiomesNode: GenerationNode<HydrologyBiomesInput, HydrologyBiomesOutput> = {
  id: hydrologyBiomesNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, terrainFinalizationNodeId, waterGeologyNodeId, climateGlaciationNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const terrain = dependencies.get(terrainFinalizationNodeId) as TerrainFinalizationOutput | undefined;
    const waterGeology = dependencies.get(waterGeologyNodeId) as WaterGeologyOutput | undefined;
    const climate = dependencies.get(climateGlaciationNodeId) as ClimateGlaciationOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!terrain) throw new Error(`Missing dependency output: ${terrainFinalizationNodeId}`);
    if (!waterGeology) throw new Error(`Missing dependency output: ${waterGeologyNodeId}`);
    if (!climate) throw new Error(`Missing dependency output: ${climateGlaciationNodeId}`);

    const river = new Float32Array(topologyOutput.topology.cellCount);
    const lakes = new Uint8Array(topologyOutput.topology.cellCount);
    const biomes = new Uint8Array(topologyOutput.topology.cellCount);
    const topologyRivers = input.diagnostics.measure('topology.hydrology', () =>
      input.operations.generateTopologyHydrology(
        river,
        lakes,
        terrain.elevation,
        waterGeology.water,
        climate.climateMoisture,
        topologyOutput.topology,
        terrain.seaLevel,
        input.values.riverDensity
      )
    );
    input.diagnostics.measure('topology.biomes', () =>
      input.operations.assignTopologyBiomes(
        biomes,
        climate.ice,
        terrain.elevation,
        waterGeology.water,
        climate.temperature,
        climate.climateMoisture,
        river,
        lakes,
        topologyOutput.topology,
        terrain.seaLevel,
        input.biomeRules
      )
    );
    return { river, lakes, biomes, topologyRivers };
  },
  validate(_input, output) {
    return validateHydrologyBiomes(output);
  }
};

function validateHydrologyBiomes(output: HydrologyBiomesOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const length = output.river.length;
  if (length === 0) issues.push({ severity: 'error', message: 'Hydrology layer contains no cells.' });
  if (output.lakes.length !== length || output.biomes.length !== length) {
    issues.push({ severity: 'error', message: 'Hydrology and biome layer lengths do not match.' });
  }
  for (const layer of [output.river]) {
    for (const value of layer) {
      if (!Number.isFinite(value)) {
        issues.push({ severity: 'error', message: 'Hydrology output contains a non-finite value.' });
        break;
      }
    }
  }
  for (const river of output.topologyRivers) {
    if (!Array.isArray(river.path) || river.path.some((cell) => cell < 0 || cell >= length)) {
      issues.push({ severity: 'error', message: 'Topology river path contains an out-of-range cell.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

