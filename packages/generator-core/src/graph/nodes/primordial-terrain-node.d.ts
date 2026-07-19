import { CubedSphereTopology, SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode } from '../types';
export declare const primordialTerrainNodeId = "terrain.primordial";
export type PrimordialTerrainInput = {
    values: SelectedValues;
    /**
     * Compatibility input while the legacy generator still uses one shared random stream.
     * Node-scoped seed derivation will be introduced separately after output equivalence is locked.
     */
    rng: SeededRandom;
};
export type PrimordialTerrainOutput = {
    elevation: Float32Array;
    crustAge: Float32Array;
    crustThickness: Float32Array;
    basin: Float32Array;
    impact: Float32Array;
};
export declare const primordialTerrainNode: GenerationNode<PrimordialTerrainInput, PrimordialTerrainOutput>;
export declare function generatePrimordialTerrain(topology: CubedSphereTopology, values: SelectedValues, rng: SeededRandom): PrimordialTerrainOutput;
//# sourceMappingURL=primordial-terrain-node.d.ts.map