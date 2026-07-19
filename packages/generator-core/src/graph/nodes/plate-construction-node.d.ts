import { CubedSphereTopology, Plate } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode } from '../types';
import { PrimordialTerrainOutput } from './primordial-terrain-node';
export declare const plateConstructionNodeId = "plates.construct";
export type TopologyPlate = Plate & {
    centerCell: number;
    centerX3: number;
    centerY3: number;
    centerZ3: number;
    age: number;
    density: number;
};
export type PlateConstructionInput = {
    requestedPlateCount: number;
    /**
     * Compatibility input while the legacy generator still uses one shared random stream.
     * Node-scoped seed derivation will be introduced separately after equivalence is locked.
     */
    rng: SeededRandom;
};
export type PlateConstructionOutput = {
    plates: TopologyPlate[];
    plateLayer: Uint16Array;
};
export declare const plateConstructionNode: GenerationNode<PlateConstructionInput, PlateConstructionOutput>;
export declare function createTopologyPlates(topology: CubedSphereTopology, requestedPlateCount: number, rng: SeededRandom, primordial: PrimordialTerrainOutput): TopologyPlate[];
export declare function assignTopologyPlateLayer(topology: CubedSphereTopology, plates: readonly TopologyPlate[]): Uint16Array;
//# sourceMappingURL=plate-construction-node.d.ts.map