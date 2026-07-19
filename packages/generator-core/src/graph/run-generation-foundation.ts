import { SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../random';
import { GenerationGraphRunner } from './runner';
import type { GenerationDiagnostics } from '@world-forge/shared';
import type { GenerationGraphNodeRunEvent } from './types';
import {
  CrustFieldsOutput,
  crustFieldsNode,
  crustFieldsNodeId
} from './nodes/crust-fields-node';
import {
  PlateConstructionOutput,
  plateConstructionNode,
  plateConstructionNodeId
} from './nodes/plate-construction-node';
import {
  PrimordialTerrainOutput,
  primordialTerrainNode,
  primordialTerrainNodeId
} from './nodes/primordial-terrain-node';
import {
  TopologyConstructionInput,
  TopologyConstructionOutput,
  topologyConstructionNode,
  topologyConstructionNodeId
} from './nodes/topology-construction-node';
import {
  TopologyElevationOutput,
  topologyElevationNode,
  topologyElevationNodeId
} from './nodes/topology-elevation-node';
import {
  TerrainFinalizationInput,
  TerrainFinalizationOutput,
  terrainFinalizationNode,
  terrainFinalizationNodeId
} from './nodes/terrain-finalization-node';
import {
  WaterGeologyInput,
  WaterGeologyOutput,
  waterGeologyNode,
  waterGeologyNodeId
} from './nodes/water-geology-node';
import {
  ClimateGlaciationInput,
  ClimateGlaciationOutput,
  climateGlaciationNode,
  climateGlaciationNodeId
} from './nodes/climate-glaciation-node';
import {
  HydrologyBiomesInput,
  HydrologyBiomesOutput,
  hydrologyBiomesNode,
  hydrologyBiomesNodeId
} from './nodes/hydrology-biomes-node';
import {
  ProjectionAssemblyInput,
  ProjectionAssemblyOutput,
  projectionAssemblyNode,
  projectionAssemblyNodeId
} from './nodes/projection-assembly-node';

export type GenerationFoundationInput = {
  topology: TopologyConstructionInput;
  values: SelectedValues;
  rng: SeededRandom;
  terrainFinalization?: TerrainFinalizationInput;
  waterGeology?: WaterGeologyInput;
  climateGlaciation?: ClimateGlaciationInput;
  hydrologyBiomes?: HydrologyBiomesInput;
  projectionAssembly?: ProjectionAssemblyInput;
  onNodeEvent?: (event: GenerationGraphNodeRunEvent) => void;
};

export type GenerationFoundationOutput = {
  topology: TopologyConstructionOutput;
  primordial: PrimordialTerrainOutput;
  plates: PlateConstructionOutput;
  crust: CrustFieldsOutput;
  elevation: TopologyElevationOutput;
  terrain?: TerrainFinalizationOutput;
  waterGeology?: WaterGeologyOutput;
  climateGlaciation?: ClimateGlaciationOutput;
  hydrologyBiomes?: HydrologyBiomesOutput;
  projectionAssembly?: ProjectionAssemblyOutput;
  timings: {
    topologyMs: number;
    primordialMs: number;
    plateConstructionMs: number;
    terrainPhasesMs: number;
    crustFieldsMs: number;
    topologyElevationMs: number;
    terrainFinalizationMs?: number;
    waterGeologyMs?: number;
    climateGlaciationMs?: number;
    hydrologyBiomesMs?: number;
    projectionAssemblyMs?: number;
  };
  graph: NonNullable<GenerationDiagnostics['graph']>;
};

export function runGenerationFoundation(
  rootSeed: string,
  input: GenerationFoundationInput
): GenerationFoundationOutput {
  const nodes = [
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
  ] as const;
  const runner = new GenerationGraphRunner(nodes);
  const inputs = new Map<string, unknown>([
    [topologyConstructionNodeId, input.topology],
    [primordialTerrainNodeId, { values: input.values, rng: input.rng }],
    [plateConstructionNodeId, { requestedPlateCount: input.values.plateCount, rng: input.rng }],
    [crustFieldsNodeId, { values: input.values, rng: input.rng }],
    [topologyElevationNodeId, { values: input.values }]
  ]);
  if (input.terrainFinalization) inputs.set(terrainFinalizationNodeId, input.terrainFinalization);
  if (input.waterGeology) inputs.set(waterGeologyNodeId, input.waterGeology);
  if (input.climateGlaciation) inputs.set(climateGlaciationNodeId, input.climateGlaciation);
  if (input.hydrologyBiomes) inputs.set(hydrologyBiomesNodeId, input.hydrologyBiomes);
  if (input.projectionAssembly) inputs.set(projectionAssemblyNodeId, input.projectionAssembly);
  const targetNodeId = input.projectionAssembly ? projectionAssemblyNodeId : input.hydrologyBiomes ? hydrologyBiomesNodeId : input.climateGlaciation ? climateGlaciationNodeId : input.waterGeology ? waterGeologyNodeId : input.terrainFinalization ? terrainFinalizationNodeId : topologyElevationNodeId;
  const run = runner.run(targetNodeId, { rootSeed }, inputs, input.onNodeEvent);
  const topologyExecution = run.results.get(topologyConstructionNodeId);
  const primordialExecution = run.results.get(primordialTerrainNodeId);
  const plateExecution = run.results.get(plateConstructionNodeId);
  const crustExecution = run.results.get(crustFieldsNodeId);
  const elevationExecution = run.results.get(topologyElevationNodeId);
  const terrainExecution = run.results.get(terrainFinalizationNodeId);
  const waterGeologyExecution = run.results.get(waterGeologyNodeId);
  const climateGlaciationExecution = run.results.get(climateGlaciationNodeId);
  const hydrologyBiomesExecution = run.results.get(hydrologyBiomesNodeId);
  const projectionAssemblyExecution = run.results.get(projectionAssemblyNodeId);
  const topology = topologyExecution?.output as TopologyConstructionOutput | undefined;
  const primordial = primordialExecution?.output as PrimordialTerrainOutput | undefined;
  const plates = plateExecution?.output as PlateConstructionOutput | undefined;
  const crust = crustExecution?.output as CrustFieldsOutput | undefined;
  const elevation = elevationExecution?.output as TopologyElevationOutput | undefined;
  const terrain = terrainExecution?.output as TerrainFinalizationOutput | undefined;
  const waterGeology = waterGeologyExecution?.output as WaterGeologyOutput | undefined;
  const climateGlaciation = climateGlaciationExecution?.output as ClimateGlaciationOutput | undefined;
  const hydrologyBiomes = hydrologyBiomesExecution?.output as HydrologyBiomesOutput | undefined;
  const projectionAssembly = projectionAssemblyExecution?.output as ProjectionAssemblyOutput | undefined;

  if (!topology || !primordial || !plates || !crust || !elevation || !topologyExecution || !primordialExecution || !plateExecution || !crustExecution || !elevationExecution) {
    throw new Error('Generation foundation did not produce all required outputs.');
  }

  return {
    topology,
    primordial,
    plates,
    crust,
    elevation,
    terrain,
    waterGeology,
    climateGlaciation,
    hydrologyBiomes,
    projectionAssembly,
    timings: {
      topologyMs: topologyExecution.durationMs,
      primordialMs: primordialExecution.durationMs,
      plateConstructionMs: plateExecution.durationMs,
      terrainPhasesMs: crust.timings.phasesMs,
      crustFieldsMs: crust.timings.crustMs,
      topologyElevationMs: elevationExecution.durationMs,
      terrainFinalizationMs: terrainExecution?.durationMs,
      waterGeologyMs: waterGeologyExecution?.durationMs,
      climateGlaciationMs: climateGlaciationExecution?.durationMs,
      hydrologyBiomesMs: hydrologyBiomesExecution?.durationMs,
      projectionAssemblyMs: projectionAssemblyExecution?.durationMs
    },
    graph: {
      targetNodeId: run.targetNodeId,
      nodes: Array.from(run.results.values()).map((execution) => {
        const node = nodes.find((candidate) => candidate.id === execution.nodeId);
        return {
          nodeId: execution.nodeId,
          version: execution.version,
          dependencies: [...(node?.dependencies ?? [])],
          durationMs: round(execution.durationMs),
          validation: execution.validation,
          outputs: summarizeNodeOutput(execution.nodeId, execution.output)
        };
      })
    }
  };
}

function summarizeNodeOutput(nodeId: string, output: unknown): string[] {
  if (nodeId === topologyConstructionNodeId) {
    const value = output as TopologyConstructionOutput;
    return [
      `${value.topology.cellCount.toLocaleString()} topology cells`,
      `resolution ${value.resolvedResolution}`
    ];
  }
  if (nodeId === primordialTerrainNodeId) {
    const value = output as PrimordialTerrainOutput;
    return [
      `${value.elevation.length.toLocaleString()} elevation cells`,
      `${value.impact.length.toLocaleString()} impact samples`
    ];
  }
  if (nodeId === plateConstructionNodeId) {
    const value = output as PlateConstructionOutput;
    return [
      `${value.plates.length} plates`,
      `${value.plateLayer.length.toLocaleString()} plate assignments`
    ];
  }
  if (nodeId === crustFieldsNodeId) {
    const value = output as CrustFieldsOutput;
    return [
      `${value.crust.continental.length.toLocaleString()} crust cells`,
      `${round(value.timings.phasesMs)} ms phase seeds`,
      `${round(value.timings.crustMs)} ms crust fields`
    ];
  }
  if (nodeId === topologyElevationNodeId) {
    const value = output as TopologyElevationOutput;
    return [`${value.elevation.length.toLocaleString()} topology elevation cells`];
  }
  if (nodeId === terrainFinalizationNodeId) {
    const value = output as TerrainFinalizationOutput;
    return [
      `${value.elevation.length.toLocaleString()} finalized terrain cells`,
      `sea level ${round(value.seaLevel, 5)}`,
      `pre-aging sea level ${round(value.preAgingSeaLevel, 5)}`
    ];
  }
  if (nodeId === waterGeologyNodeId) {
    const value = output as WaterGeologyOutput;
    return [
      `${value.water.length.toLocaleString()} water cells`,
      `${value.volcanism.length.toLocaleString()} volcanism samples`
    ];
  }
  if (nodeId === climateGlaciationNodeId) {
    const value = output as ClimateGlaciationOutput;
    return [
      `${value.temperature.length.toLocaleString()} climate cells`,
      `${value.climate.pipelineVersion} pipeline`,
      `${value.ice.length.toLocaleString()} ice samples`
    ];
  }
  if (nodeId === hydrologyBiomesNodeId) {
    const value = output as HydrologyBiomesOutput;
    return [
      `${value.topologyRivers.length} topology rivers`,
      `${value.biomes.length.toLocaleString()} biome cells`
    ];
  }
  if (nodeId === projectionAssemblyNodeId) {
    const value = output as ProjectionAssemblyOutput;
    return [
      `${value.layers.elevation.length.toLocaleString()} projected samples`,
      `${value.rivers.length} projected rivers`
    ];
  }
  return [];
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
