import { CubedSphereTopology, River } from '@world-forge/shared';
import { ClimateGlaciationOutput, climateGlaciationNodeId } from './climate-glaciation-node';
import { GenerationNode, NodeValidationResult } from '../types';
import { HydrologyBiomesOutput, hydrologyBiomesNodeId, TopologyRiverPath } from './hydrology-biomes-node';
import { PlateConstructionOutput, plateConstructionNodeId } from './plate-construction-node';
import { TerrainFinalizationOutput, terrainFinalizationNodeId } from './terrain-finalization-node';
import { TopologyConstructionOutput, topologyConstructionNodeId } from './topology-construction-node';
import { WaterGeologyOutput, waterGeologyNodeId } from './water-geology-node';

export const projectionAssemblyNodeId = 'projection.equirectangular-assembly';

export type ProjectionAssemblyDiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
};

export type ProjectionAssemblyOperations = {
  projectTopologyToEquirectangular(
    elevation: Float32Array,
    platesLayer: Uint16Array,
    water: Uint8Array,
    temperature: Float32Array,
    wetness: Float32Array,
    climateMoisture: Float32Array,
    climatePrecipitation: Float32Array,
    climateWetnessDelta: Float32Array,
    biomes: Uint8Array,
    ice: Uint8Array,
    river: Float32Array,
    lakes: Uint8Array,
    topologyElevation: Float32Array,
    topologyPlates: Uint16Array,
    topologyWater: Uint8Array,
    topologyTemperature: Float32Array,
    topologyWetness: Float32Array,
    topologyClimateMoisture: Float32Array,
    topologyClimatePrecipitation: Float32Array,
    topologyClimateWetnessDelta: Float32Array,
    topologyBiomes: Uint8Array,
    topologyIce: Uint8Array,
    topologyRiver: Float32Array,
    topologyLakes: Uint8Array,
    topology: CubedSphereTopology,
    width: number,
    height: number
  ): void;
  projectTopologyFlowToEquirectangular(
    windX: Float32Array,
    windY: Float32Array,
    currentX: Float32Array,
    currentY: Float32Array,
    topologyWindX: Float32Array,
    topologyWindY: Float32Array,
    topologyCurrentX: Float32Array,
    topologyCurrentY: Float32Array,
    topology: CubedSphereTopology,
    width: number,
    height: number
  ): void;
  projectTopologyRiver(river: TopologyRiverPath, topology: CubedSphereTopology, width: number, height: number, index: number): River;
};

export type ProjectionAssemblyInput = {
  outputResolution: { width: number; height: number };
  diagnostics: ProjectionAssemblyDiagnosticsRecorder;
  operations: ProjectionAssemblyOperations;
};

export type ProjectionAssemblyOutput = {
  layers: {
    elevation: Float32Array;
    water: Uint8Array;
    plates: Uint16Array;
    temperature: Float32Array;
    wetness: Float32Array;
    climateMoisture: Float32Array;
    climatePrecipitation: Float32Array;
    climateWetnessDelta: Float32Array;
    biomes: Uint8Array;
    ice: Uint8Array;
    river: Float32Array;
    lakes: Uint8Array;
    windX: Float32Array;
    windY: Float32Array;
    currentX: Float32Array;
    currentY: Float32Array;
  };
  rivers: River[];
};

export const projectionAssemblyNode: GenerationNode<ProjectionAssemblyInput, ProjectionAssemblyOutput> = {
  id: projectionAssemblyNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, plateConstructionNodeId, terrainFinalizationNodeId, waterGeologyNodeId, climateGlaciationNodeId, hydrologyBiomesNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const plates = dependencies.get(plateConstructionNodeId) as PlateConstructionOutput | undefined;
    const terrain = dependencies.get(terrainFinalizationNodeId) as TerrainFinalizationOutput | undefined;
    const waterGeology = dependencies.get(waterGeologyNodeId) as WaterGeologyOutput | undefined;
    const climate = dependencies.get(climateGlaciationNodeId) as ClimateGlaciationOutput | undefined;
    const hydrology = dependencies.get(hydrologyBiomesNodeId) as HydrologyBiomesOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!plates) throw new Error(`Missing dependency output: ${plateConstructionNodeId}`);
    if (!terrain) throw new Error(`Missing dependency output: ${terrainFinalizationNodeId}`);
    if (!waterGeology) throw new Error(`Missing dependency output: ${waterGeologyNodeId}`);
    if (!climate) throw new Error(`Missing dependency output: ${climateGlaciationNodeId}`);
    if (!hydrology) throw new Error(`Missing dependency output: ${hydrologyBiomesNodeId}`);

    const { width, height } = input.outputResolution;
    const cellCount = width * height;
    const layers = {
      elevation: new Float32Array(cellCount),
      water: new Uint8Array(cellCount),
      plates: new Uint16Array(cellCount),
      temperature: new Float32Array(cellCount),
      wetness: new Float32Array(cellCount),
      climateMoisture: new Float32Array(cellCount),
      climatePrecipitation: new Float32Array(cellCount),
      climateWetnessDelta: new Float32Array(cellCount),
      biomes: new Uint8Array(cellCount),
      ice: new Uint8Array(cellCount),
      river: new Float32Array(cellCount),
      lakes: new Uint8Array(cellCount),
      windX: new Float32Array(cellCount),
      windY: new Float32Array(cellCount),
      currentX: new Float32Array(cellCount),
      currentY: new Float32Array(cellCount)
    };

    input.diagnostics.measure('projection.equirectangular', () =>
      input.operations.projectTopologyToEquirectangular(
        layers.elevation,
        layers.plates,
        layers.water,
        layers.temperature,
        layers.wetness,
        layers.climateMoisture,
        layers.climatePrecipitation,
        layers.climateWetnessDelta,
        layers.biomes,
        layers.ice,
        layers.river,
        layers.lakes,
        terrain.elevation,
        plates.plateLayer,
        waterGeology.water,
        climate.temperature,
        climate.wetness,
        climate.climateMoisture,
        climate.climatePrecipitation,
        climate.climateWetnessDelta,
        hydrology.biomes,
        climate.ice,
        hydrology.river,
        hydrology.lakes,
        topologyOutput.topology,
        width,
        height
      )
    );
    input.diagnostics.measure('projection.flow', () =>
      input.operations.projectTopologyFlowToEquirectangular(
        layers.windX,
        layers.windY,
        layers.currentX,
        layers.currentY,
        climate.windX,
        climate.windY,
        climate.currentX,
        climate.currentY,
        topologyOutput.topology,
        width,
        height
      )
    );
    const rivers = hydrology.topologyRivers.map((river, index) =>
      input.operations.projectTopologyRiver(river, topologyOutput.topology, width, height, index)
    );

    return { layers, rivers };
  },
  validate(input, output) {
    return validateProjectionAssembly(input, output);
  }
};

function validateProjectionAssembly(input: ProjectionAssemblyInput, output: ProjectionAssemblyOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const expectedLength = input.outputResolution.width * input.outputResolution.height;
  const layers = Object.values(output.layers);
  if (expectedLength <= 0) issues.push({ severity: 'error', message: 'Projection output resolution is empty.' });
  if (layers.some((layer) => layer.length !== expectedLength)) {
    issues.push({ severity: 'error', message: 'Projected layer lengths do not match output resolution.' });
  }
  for (const layer of [output.layers.elevation, output.layers.temperature, output.layers.wetness, output.layers.climateMoisture, output.layers.climatePrecipitation, output.layers.climateWetnessDelta, output.layers.river, output.layers.windX, output.layers.windY, output.layers.currentX, output.layers.currentY]) {
    for (const value of layer) {
      if (!Number.isFinite(value)) {
        issues.push({ severity: 'error', message: 'Projected layer contains a non-finite value.' });
        return { valid: false, issues };
      }
    }
  }
  for (const river of output.rivers) {
    if (river.path.some((index) => index < 0 || index >= expectedLength)) {
      issues.push({ severity: 'error', message: 'Projected river path contains an out-of-range cell.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

