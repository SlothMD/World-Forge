import type { DeepTimeProject } from './deepTimePipeline';
export type TerminalPhaseAlignmentDiagnostics = {
    presetId: string;
    evaluatedCandidates: number;
    searchCycleYears: number;
    sampleStepYears: number;
    initialAdvanceYears: number;
    selectedAdvanceYears: number;
    initialGlaciationPressure: number;
    selectedGlaciationPressure: number;
    targetGlaciationPressure: number;
    temperatureBeforeC: number;
    temperatureAfterC: number;
    targetTemperatureC: number;
    appliedTemperatureOffsetC: number;
    iceCellsAdded: number;
    iceCellsCleared: number;
    alignmentImprovement: number;
    advanced: boolean;
};
export declare function alignTerminalOrbitalPhase(project: DeepTimeProject): TerminalPhaseAlignmentDiagnostics;
//# sourceMappingURL=deepTimePhaseAlignment.d.ts.map