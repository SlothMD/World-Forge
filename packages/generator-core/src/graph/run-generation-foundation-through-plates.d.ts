import { SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../random';
import { PlateConstructionOutput } from './nodes/plate-construction-node';
import { PrimordialTerrainOutput } from './nodes/primordial-terrain-node';
import { TopologyConstructionInput, TopologyConstructionOutput } from './nodes/topology-construction-node';
export type GenerationFoundationThroughPlatesInput = {
    topology: TopologyConstructionInput;
    values: SelectedValues;
    rng: SeededRandom;
};
export type GenerationFoundationThroughPlatesOutput = {
    topology: TopologyConstructionOutput;
    primordial: PrimordialTerrainOutput;
    plates: PlateConstructionOutput;
    timings: {
        topologyMs: number;
        primordialMs: number;
        plateConstructionMs: number;
    };
};
/**
 * Temporary QA bisect entry point. It intentionally stops before terrain.crust-fields
 * so the shared RNG remains at the exact legacy boundary after plate construction.
 */
export declare function runGenerationFoundationThroughPlates(rootSeed: string, input: GenerationFoundationThroughPlatesInput): GenerationFoundationThroughPlatesOutput;
//# sourceMappingURL=run-generation-foundation-through-plates.d.ts.map