import { BiomeClassificationRule, CubedSphereTopology, River, SelectedValues } from '@world-forge/shared';
import { GenerationNode } from '../types';
export declare const hydrologyBiomesNodeId = "ecology.hydrology-biomes";
export type TopologyRiverPath = {
    path: number[];
    terminus: River['terminus'];
};
export type HydrologyBiomesDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
};
export type HydrologyBiomesOperations = {
    generateTopologyHydrology(river: Float32Array, lakes: Uint8Array, elevation: Float32Array, water: Uint8Array, wetness: Float32Array, topology: CubedSphereTopology, seaLevel: number, riverDensity: number): TopologyRiverPath[];
    assignTopologyBiomes(biomes: Uint8Array, ice: Uint8Array, elevation: Float32Array, water: Uint8Array, temperature: Float32Array, wetness: Float32Array, river: Float32Array, lakes: Uint8Array, topology: CubedSphereTopology, seaLevel: number, biomeRules?: BiomeClassificationRule[]): void;
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
export declare const hydrologyBiomesNode: GenerationNode<HydrologyBiomesInput, HydrologyBiomesOutput>;
//# sourceMappingURL=hydrology-biomes-node.d.ts.map