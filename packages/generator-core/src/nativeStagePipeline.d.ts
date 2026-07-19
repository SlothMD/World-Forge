import type { GenerationConfig, WorldProject } from '@world-forge/shared';
import type { GenerateProjectOptions } from './index';
export declare const nativeGenerationStageIds: readonly ["world.system-orbit", "world.primordial-crust", "world.tectonics-cratons", "world.initial-terrain", "world.deep-time-aging", "world.final-water", "world.present-climate", "world.hydrology", "world.biomes-features", "world.outputs-validation"];
export type NativeGenerationStageId = typeof nativeGenerationStageIds[number];
export type NativeGenerationStagePhase = 'started' | 'progress' | 'completed' | 'warning' | 'failed' | 'skipped';
export type NativeGenerationStageEvent = {
    stageId: NativeGenerationStageId;
    phase: NativeGenerationStagePhase;
    progress: number;
    overallProgress: number;
    label: string;
    startedAt: number;
    timestamp: number;
    elapsedMs?: number;
    message?: string;
    metrics?: Record<string, number | string | boolean>;
};
export type GenerateProjectWithNativeStagesOptions = GenerateProjectOptions & {
    onStageEvent?: (event: NativeGenerationStageEvent) => void;
};
export declare function generateProjectWithNativeStages(input?: Partial<GenerationConfig>, options?: GenerateProjectWithNativeStagesOptions): WorldProject;
//# sourceMappingURL=nativeStagePipeline.d.ts.map