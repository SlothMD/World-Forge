import { type WorldProject } from '@world-forge/shared';
export type PackedGyreDiagnostic = {
    id: number;
    basinId: number;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    rotationSign: number;
    territorySize: number;
};
export type BasinCirculationDiagnostics = {
    modelVersion: 'basin-circulation-v5.1';
    marineBasinCount: number;
    largestBasinShare: number;
    coherentGyreCount: number;
    gyreCandidateCount: number;
    coastalAlignmentScore: number;
    stagnantOceanShare: number;
    meanCurrentSpeed: number;
    windTerrainDeflectionIndex: number;
    stagnantWindShare: number;
    packedGyres: PackedGyreDiagnostic[];
    gyreOwner: Int16Array;
};
export declare function applyBasinAwareCirculation(project: WorldProject): BasinCirculationDiagnostics;
//# sourceMappingURL=basinCirculation.d.ts.map