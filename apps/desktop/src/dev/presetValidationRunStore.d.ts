import type { GenerationConfig } from '@world-forge/shared';
import type { PresetTestMode, PresetValidationReport } from './presetValidation';
export type PresetValidationRunState = {
    running: boolean;
    completed: number;
    total: number;
    currentId: string;
    message: string;
    report: PresetValidationReport | null;
};
export declare function subscribePresetValidationRun(listener: () => void): () => void;
export declare function getPresetValidationRunSnapshot(): PresetValidationRunState;
export declare function startPresetValidationRun(mode: PresetTestMode, baseConfig: GenerationConfig): void;
export declare function cancelPresetValidationRun(): void;
