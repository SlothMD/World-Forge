import { CubedSphereTopology, River } from '@world-forge/shared';
import { GenerationNode } from '../types';
import { TopologyRiverPath } from './hydrology-biomes-node';
export declare const projectionAssemblyNodeId = "projection.equirectangular-assembly";
export type ProjectionAssemblyDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
};
export type ProjectionAssemblyOperations = {
    projectTopologyToEquirectangular(elevation: Float32Array, platesLayer: Uint16Array, water: Uint8Array, temperature: Float32Array, wetness: Float32Array, climateMoisture: Float32Array, climatePrecipitation: Float32Array, climateWetnessDelta: Float32Array, biomes: Uint8Array, ice: Uint8Array, river: Float32Array, lakes: Uint8Array, topologyElevation: Float32Array, topologyPlates: Uint16Array, topologyWater: Uint8Array, topologyTemperature: Float32Array, topologyWetness: Float32Array, topologyClimateMoisture: Float32Array, topologyClimatePrecipitation: Float32Array, topologyClimateWetnessDelta: Float32Array, topologyBiomes: Uint8Array, topologyIce: Uint8Array, topologyRiver: Float32Array, topologyLakes: Uint8Array, topology: CubedSphereTopology, width: number, height: number): void;
    projectTopologyFlowToEquirectangular(windX: Float32Array, windY: Float32Array, currentX: Float32Array, currentY: Float32Array, topologyWindX: Float32Array, topologyWindY: Float32Array, topologyCurrentX: Float32Array, topologyCurrentY: Float32Array, topology: CubedSphereTopology, width: number, height: number): void;
    projectTopologyRiver(river: TopologyRiverPath, topology: CubedSphereTopology, width: number, height: number, index: number): River;
};
export type ProjectionAssemblyInput = {
    outputResolution: {
        width: number;
        height: number;
    };
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
export declare const projectionAssemblyNode: GenerationNode<ProjectionAssemblyInput, ProjectionAssemblyOutput>;
//# sourceMappingURL=projection-assembly-node.d.ts.map