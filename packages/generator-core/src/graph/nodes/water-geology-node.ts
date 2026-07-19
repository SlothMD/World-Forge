import { CubedSphereTopology } from '@world-forge/shared';
import { GenerationNode, NodeValidationResult } from '../types';
import { PlateConstructionOutput, plateConstructionNodeId } from './plate-construction-node';
import { TerrainFinalizationOutput, terrainFinalizationNodeId } from './terrain-finalization-node';
import { TopologyConstructionOutput, topologyConstructionNodeId } from './topology-construction-node';

export const waterGeologyNodeId = 'terrain.water-geology';

export type WaterGeologyDiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
};

export type WaterGeologyOperations = {
  assignTopologyWater(water: Uint8Array, elevation: Float32Array, seaLevel: number): void;
  assignTopologyVolcanism(
    volcanism: Float32Array,
    elevation: Float32Array,
    plates: Uint16Array,
    plateData: PlateConstructionOutput['plates'],
    topology: CubedSphereTopology,
    seaLevel: number
  ): void;
};

export type WaterGeologyInput = {
  diagnostics: WaterGeologyDiagnosticsRecorder;
  operations: WaterGeologyOperations;
};

export type WaterGeologyOutput = {
  water: Uint8Array;
  volcanism: Float32Array;
};

export const waterGeologyNode: GenerationNode<WaterGeologyInput, WaterGeologyOutput> = {
  id: waterGeologyNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, plateConstructionNodeId, terrainFinalizationNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const plates = dependencies.get(plateConstructionNodeId) as PlateConstructionOutput | undefined;
    const terrain = dependencies.get(terrainFinalizationNodeId) as TerrainFinalizationOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!plates) throw new Error(`Missing dependency output: ${plateConstructionNodeId}`);
    if (!terrain) throw new Error(`Missing dependency output: ${terrainFinalizationNodeId}`);

    const water = new Uint8Array(topologyOutput.topology.cellCount);
    const volcanism = new Float32Array(topologyOutput.topology.cellCount);
    input.diagnostics.measure('topology.water.mask', () =>
      input.operations.assignTopologyWater(water, terrain.elevation, terrain.seaLevel)
    );
    input.diagnostics.measure('topology.volcanism', () =>
      input.operations.assignTopologyVolcanism(volcanism, terrain.elevation, plates.plateLayer, plates.plates, topologyOutput.topology, terrain.seaLevel)
    );
    return { water, volcanism };
  },
  validate(_input, output) {
    return validateWaterGeology(output);
  }
};

function validateWaterGeology(output: WaterGeologyOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  if (output.water.length === 0) issues.push({ severity: 'error', message: 'Water layer contains no cells.' });
  if (output.volcanism.length !== output.water.length) issues.push({ severity: 'error', message: 'Water and volcanism layer lengths do not match.' });
  for (const value of output.water) {
    if (value !== 0 && value !== 1) {
      issues.push({ severity: 'error', message: 'Water layer contains a non-binary value.' });
      break;
    }
  }
  for (const value of output.volcanism) {
    if (!Number.isFinite(value)) {
      issues.push({ severity: 'error', message: 'Volcanism layer contains a non-finite value.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

