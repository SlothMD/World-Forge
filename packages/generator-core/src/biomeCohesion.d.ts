import { type Biome, type WorldProject } from '@world-forge/shared';
export type CollapsedBiomeDetail = {
    originalBiome: Biome;
    replacementBiome: Biome;
    cells: number[];
    areaCells: number;
    meanTemperatureC: number;
    meanWetness: number;
    meanPrecipitation: number;
    elevationRange: [number, number];
    climateSupport: number;
    hydrologySupport: number;
    collapseReason: string;
};
export declare function applyBiomeCohesion(project: WorldProject): number;
//# sourceMappingURL=biomeCohesion.d.ts.map