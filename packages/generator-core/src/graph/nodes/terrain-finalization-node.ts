import { CubedSphereTopology, SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode, NodeValidationResult } from '../types';
import { TopologyConstructionOutput, topologyConstructionNodeId } from './topology-construction-node';
import { TopologyElevationOutput, topologyElevationNodeId } from './topology-elevation-node';

export const terrainFinalizationNodeId = 'terrain.finalization';

export type TerrainFinalizationDiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
};

export type TerrainFinalizationOperations = {
  findTopologySeaLevelForOceanTarget(elevation: Float32Array, areaWeights: Float32Array, oceanTarget: number, adjustment: number): number;
  applyTopologyTerrainAging(
    elevation: Float32Array,
    topology: CubedSphereTopology,
    systemAgeGy: number,
    impactFrequency: number,
    seaLevel: number,
    rng: SeededRandom,
    diagnostics: TerrainFinalizationDiagnosticsRecorder
  ): void;
  applyTopologyTerrainEnrichment(elevation: Float32Array, topology: CubedSphereTopology, values: SelectedValues, rng: SeededRandom): void;
};

export type TerrainFinalizationInput = {
  values: SelectedValues;
  rng: SeededRandom;
  diagnostics: TerrainFinalizationDiagnosticsRecorder;
  operations: TerrainFinalizationOperations;
};

export type TerrainFinalizationOutput = {
  elevation: Float32Array;
  preAgingSeaLevel: number;
  seaLevel: number;
};

export const terrainFinalizationNode: GenerationNode<TerrainFinalizationInput, TerrainFinalizationOutput> = {
  id: terrainFinalizationNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, topologyElevationNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const elevationOutput = dependencies.get(topologyElevationNodeId) as TopologyElevationOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!elevationOutput) throw new Error(`Missing dependency output: ${topologyElevationNodeId}`);

    const topology = topologyOutput.topology;
    const elevation = new Float32Array(elevationOutput.elevation);
    const preAgingSeaLevel = input.diagnostics.measure('topology.water.sea-level.pre-aging', () =>
      input.operations.findTopologySeaLevelForOceanTarget(elevation, topology.areaWeights, input.values.oceanPercentage, input.values.seaLevel)
    );
    input.diagnostics.measure('topology.terrain.aging', () =>
      input.operations.applyTopologyTerrainAging(elevation, topology, input.values.systemAgeGy, input.values.impactFrequency, preAgingSeaLevel, input.rng, input.diagnostics)
    );
    input.diagnostics.measure('topology.terrain.enrichment', () =>
      input.operations.applyTopologyTerrainEnrichment(elevation, topology, input.values, input.rng)
    );
    const seaLevel = input.diagnostics.measure('topology.water.sea-level.final', () =>
      input.operations.findTopologySeaLevelForOceanTarget(elevation, topology.areaWeights, input.values.oceanPercentage, input.values.seaLevel)
    );

    return { elevation, preAgingSeaLevel, seaLevel };
  },
  validate(_input, output) {
    return validateTerrainFinalization(output);
  }
};

function validateTerrainFinalization(output: TerrainFinalizationOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  if (output.elevation.length === 0) issues.push({ severity: 'error', message: 'Finalized terrain contains no cells.' });
  if (!Number.isFinite(output.preAgingSeaLevel)) issues.push({ severity: 'error', message: 'Pre-aging sea level is not finite.' });
  if (!Number.isFinite(output.seaLevel)) issues.push({ severity: 'error', message: 'Final sea level is not finite.' });
  for (const value of output.elevation) {
    if (!Number.isFinite(value)) {
      issues.push({ severity: 'error', message: 'Finalized terrain contains a non-finite elevation.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

