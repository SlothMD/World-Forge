import { CubedSphereTopology, SelectedValues } from '@world-forge/shared';
import { GenerationNode } from '../types';
import { CrustFieldsOutput, TerrainPhases } from './crust-fields-node';
import { TopologyPlate } from './plate-construction-node';
import { PrimordialTerrainOutput } from './primordial-terrain-node';
export declare const topologyElevationNodeId = "terrain.topology-elevation";
export type TopologyElevationInput = {
    values: SelectedValues;
};
export type TopologyElevationOutput = {
    elevation: Float32Array;
};
export declare const topologyElevationNode: GenerationNode<TopologyElevationInput, TopologyElevationOutput>;
export declare function generateTopologyElevation(plateLayer: Uint16Array, plates: readonly TopologyPlate[], topology: CubedSphereTopology, values: SelectedValues, primordial: PrimordialTerrainOutput, crust: CrustFieldsOutput['crust'], phases: TerrainPhases): Float32Array;
//# sourceMappingURL=topology-elevation-node.d.ts.map