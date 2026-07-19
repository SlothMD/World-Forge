import { ClimatePipelineOutput, CubedSphereTopology, GenerationConfig, SelectedValues } from '@world-forge/shared';
import { GenerationNode } from '../types';
export declare const climateGlaciationNodeId = "climate.glaciation";
export type ClimateGlaciationDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
};
export type ClimateGlaciationOperations = {
    generateTopologyClimate(temperature: Float32Array, wetness: Float32Array, windX: Float32Array, windY: Float32Array, currentX: Float32Array, currentY: Float32Array, elevation: Float32Array, water: Uint8Array, topology: CubedSphereTopology, values: SelectedValues, tideInfluence: number): void;
    generateTopologyClimateMoistureCandidate(climateMoisture: Float32Array, climatePrecipitation: Float32Array, climateWetnessDelta: Float32Array, elevation: Float32Array, water: Uint8Array, temperature: Float32Array, wetness: Float32Array, windX: Float32Array, windY: Float32Array, currentX: Float32Array, currentY: Float32Array, topology: CubedSphereTopology, values: SelectedValues, seaLevel: number): void;
    assignTopologyIce(ice: Uint8Array, elevation: Float32Array, temperature: Float32Array, wetness: Float32Array, topology: CubedSphereTopology, seaLevel: number): void;
    generateClimatePipelinePreview(config: GenerationConfig, values: SelectedValues, topology: CubedSphereTopology, elevation: Float32Array, water: Uint8Array, temperature: Float32Array, ice: Uint8Array, wetness: Float32Array, windX: Float32Array, windY: Float32Array, currentX: Float32Array, currentY: Float32Array, climateMoisture: Float32Array, climatePrecipitation: Float32Array, climateWetnessDelta: Float32Array, seaLevel: number): ClimatePipelineOutput;
};
export type ClimateGlaciationInput = {
    config: GenerationConfig;
    values: SelectedValues;
    tideInfluence: number;
    diagnostics: ClimateGlaciationDiagnosticsRecorder;
    operations: ClimateGlaciationOperations;
};
export type ClimateGlaciationOutput = {
    temperature: Float32Array;
    wetness: Float32Array;
    climateMoisture: Float32Array;
    climatePrecipitation: Float32Array;
    climateWetnessDelta: Float32Array;
    ice: Uint8Array;
    windX: Float32Array;
    windY: Float32Array;
    currentX: Float32Array;
    currentY: Float32Array;
    climate: ClimatePipelineOutput;
};
export declare const climateGlaciationNode: GenerationNode<ClimateGlaciationInput, ClimateGlaciationOutput>;
//# sourceMappingURL=climate-glaciation-node.d.ts.map