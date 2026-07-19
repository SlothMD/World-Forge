import { CubedSphereTopology } from '@world-forge/shared';
import { GenerationNode } from '../types';
import { PlateConstructionOutput } from './plate-construction-node';
export declare const waterGeologyNodeId = "terrain.water-geology";
export type WaterGeologyDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
};
export type WaterGeologyOperations = {
    assignTopologyWater(water: Uint8Array, elevation: Float32Array, seaLevel: number): void;
    assignTopologyVolcanism(volcanism: Float32Array, elevation: Float32Array, plates: Uint16Array, plateData: PlateConstructionOutput['plates'], topology: CubedSphereTopology, seaLevel: number): void;
};
export type WaterGeologyInput = {
    diagnostics: WaterGeologyDiagnosticsRecorder;
    operations: WaterGeologyOperations;
};
export type WaterGeologyOutput = {
    water: Uint8Array;
    volcanism: Float32Array;
};
export declare const waterGeologyNode: GenerationNode<WaterGeologyInput, WaterGeologyOutput>;
//# sourceMappingURL=water-geology-node.d.ts.map