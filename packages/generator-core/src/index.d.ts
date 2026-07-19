import { GenerationConfig, PrimaryWorld, SelectedValues, WorldMetrics, WorldProject, createDefaultConfig, defaultParameterRanges } from '@world-forge/shared';
import { SeededRandom } from './random';
import type { GenerationGraphNodeRunEvent } from './graph/types';
export { SeededRandom, createDefaultConfig, defaultParameterRanges };
export type GenerationPreviewStage = 'primordial' | 'plates' | 'elevation' | 'aged' | 'water' | 'climate' | 'hydrology' | 'biomes';
export type GenerationPreviewFrame = {
    stage: GenerationPreviewStage;
    label: string;
    progress: number;
    width: number;
    height: number;
    rgba: Uint8ClampedArray<ArrayBuffer>;
};
export type GenerationProgressCallback = (frame: GenerationPreviewFrame) => void;
export type GenerateProjectOptions = {
    onProgress?: GenerationProgressCallback;
    onGraphNodeEvent?: (event: GenerationGraphNodeRunEvent) => void;
    appVersion?: string;
    previewResolution?: {
        width: number;
        height: number;
    };
};
export declare function generateProject(input?: Partial<GenerationConfig>, options?: GenerateProjectOptions): WorldProject;
export declare function calculateMetrics(world: PrimaryWorld, values: SelectedValues): WorldMetrics;
//# sourceMappingURL=index.d.ts.map