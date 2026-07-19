import { CubedSphereTopology, SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode } from '../types';
export declare const terrainFinalizationNodeId = "terrain.finalization";
export type TerrainFinalizationDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
};
export type TerrainFinalizationOperations = {
    findTopologySeaLevelForOceanTarget(elevation: Float32Array, areaWeights: Float32Array, oceanTarget: number, adjustment: number): number;
    applyTopologyTerrainAging(elevation: Float32Array, topology: CubedSphereTopology, systemAgeGy: number, impactFrequency: number, seaLevel: number, rng: SeededRandom, diagnostics: TerrainFinalizationDiagnosticsRecorder): void;
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
export declare const terrainFinalizationNode: GenerationNode<TerrainFinalizationInput, TerrainFinalizationOutput>;
//# sourceMappingURL=terrain-finalization-node.d.ts.map