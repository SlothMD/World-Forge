export declare const surfaceElevationBands: readonly ["lowland", "upland", "highland", "alpine"];
export type SurfaceElevationBand = typeof surfaceElevationBands[number];
export declare const surfaceMorphologies: readonly ["flat", "rolling", "rugged", "mountainous"];
export type SurfaceMorphology = typeof surfaceMorphologies[number];
export type SurfaceReliefCharacter = 'Very flat' | 'Mostly lowland' | 'Rolling' | 'Varied' | 'Rugged' | 'Extreme relief';
export type SurfaceStructureCellInput = {
    water: boolean;
    permanentIce: boolean;
    elevationAboveSeaLevel: number;
    temperatureC: number;
    slope: number;
    localRelief: number;
};
export type SurfaceStructureCell = {
    elevationBand: SurfaceElevationBand;
    morphology: SurfaceMorphology;
    permanentIce: boolean;
    elevationDrivenTreeline: boolean;
    elevationDrivenSnowline: boolean;
};
export type SurfaceStructureInput = {
    seaLevel: number;
    topology: {
        cellCount: number;
        areaWeights: Float32Array;
        neighbors: Int32Array;
    };
    elevation: Float32Array;
    water: Uint8Array;
    temperature: Float32Array;
    ice: Uint8Array;
};
export type SurfaceStructureSummary = {
    modelVersion: 'surface-structure-v1';
    landArea: number;
    elevationBandArea: Record<SurfaceElevationBand, number>;
    morphologyArea: Record<SurfaceMorphology, number>;
    permanentIceLandArea: number;
    elevationDrivenTreelineArea: number;
    elevationDrivenSnowlineArea: number;
    highestCell: number;
    highestElevationAboveSeaLevel: number;
    highestElevationBand: SurfaceElevationBand;
    reliefCharacter: SurfaceReliefCharacter;
};
export type SurfaceStructureClassification = {
    modelVersion: 'surface-structure-v1';
    elevationBandByCell: Uint8Array;
    morphologyByCell: Uint8Array;
    permanentIceByCell: Uint8Array;
    elevationDrivenTreelineByCell: Uint8Array;
    elevationDrivenSnowlineByCell: Uint8Array;
    slopeByCell: Float32Array;
    localReliefByCell: Float32Array;
    summary: SurfaceStructureSummary;
};
export declare function surfaceElevationBandToCode(value: SurfaceElevationBand): number;
export declare function surfaceElevationBandFromCode(value: number): SurfaceElevationBand;
export declare function surfaceMorphologyToCode(value: SurfaceMorphology): number;
export declare function surfaceMorphologyFromCode(value: number): SurfaceMorphology;
export declare function classifySurfaceStructureCell(input: SurfaceStructureCellInput): SurfaceStructureCell;
export declare function buildSurfaceStructureClassification(input: SurfaceStructureInput): SurfaceStructureClassification;
//# sourceMappingURL=surfaceStructure.d.ts.map