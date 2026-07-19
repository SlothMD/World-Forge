import { type WorldProject } from '@world-forge/shared';
import type { DeepTimeProject } from './deepTimePipeline';
export type DeepTimeStageIsolationBaseline = {
    initialSeaLevel: number;
    initialWater: Uint8Array;
};
export type WaterMorphologySummary = {
    waterCellShare: number;
    coastlineCellShare: number;
    landmassCount: number;
    largestLandmassShare: number;
};
export type DeepTimeStageIsolationDiagnostics = {
    modelVersion: 'deep-time-stage-isolation-v1';
    initialSeaLevel: number;
    finalSeaLevel: number;
    seaLevelDelta: number;
    beforeAging: WaterMorphologySummary;
    afterAgingBeforeFinalWater: WaterMorphologySummary;
    afterFinalWater: WaterMorphologySummary;
    agingWaterChangedCells: number;
    reconciliationWaterChangedCells: number;
    agingWaterCellShareDelta: number;
    reconciliationWaterCellShareDelta: number;
    agingCoastlineCellShareDelta: number;
    reconciliationCoastlineCellShareDelta: number;
    agingLandmassCountDelta: number;
    reconciliationLandmassCountDelta: number;
    agingLargestLandmassShareDelta: number;
    reconciliationLargestLandmassShareDelta: number;
};
export declare function captureDeepTimeStageIsolationBaseline(project: WorldProject): DeepTimeStageIsolationBaseline;
export declare function attachDeepTimeStageIsolationDiagnostics(project: DeepTimeProject, baseline: DeepTimeStageIsolationBaseline): DeepTimeStageIsolationDiagnostics;
//# sourceMappingURL=deepTimeStageIsolation.d.ts.map