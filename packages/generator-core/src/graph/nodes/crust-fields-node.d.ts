import { CubedSphereTopology, SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode } from '../types';
export declare const crustFieldsNodeId = "terrain.crust-fields";
export type TerrainPhases = {
    phaseA: number;
    phaseB: number;
    continentPhase: number;
};
export type CrustFields = {
    continental: Float32Array;
    thickness: Float32Array;
    shelf: Float32Array;
};
export type CrustFieldsInput = {
    values: SelectedValues;
    /**
     * Compatibility input while the legacy generator still uses one shared random stream.
     * The plate dependency preserves the existing RNG consumption order.
     */
    rng: SeededRandom;
};
export type CrustFieldsOutput = {
    phases: TerrainPhases;
    crust: CrustFields;
    timings: {
        phasesMs: number;
        crustMs: number;
    };
};
export declare const crustFieldsNode: GenerationNode<CrustFieldsInput, CrustFieldsOutput>;
export declare function createTerrainPhases(rng: SeededRandom): TerrainPhases;
export declare function generateCrustFields(topology: CubedSphereTopology, values: SelectedValues, phaseA: number, phaseB: number, phaseC: number): CrustFields;
export declare function coherentSphericalNoise(x: number, y: number, z: number): number;
//# sourceMappingURL=crust-fields-node.d.ts.map