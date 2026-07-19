import { RefObject } from 'react';
import { GenerationConfig, WorldProject } from '@world-forge/shared';
export { generationStageTelemetryEvent, generationTelemetryEvent } from './generationEvents';
export type { GenerationStageTelemetryDetail, GenerationTelemetryDetail } from './generationEvents';
export type GenerationLaunchSource = 'generator' | 'dev-graph';
type UseGenerationWorkflowOptions = {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    previousProject: WorldProject | null;
    onProjectGenerated: (project: WorldProject) => void;
};
type GenerateOptions = {
    startNodeId?: string | null;
    source?: GenerationLaunchSource;
};
export type GenerationNodeProgress = {
    nodeId: string;
    label: string;
    progress: number;
    status: 'waiting' | 'running' | 'complete' | 'failed';
    elapsedMs?: number;
};
export declare function useGenerationWorkflow({ canvasRef, previousProject, onProjectGenerated }: UseGenerationWorkflowOptions): {
    isGenerating: boolean;
    launchSource: GenerationLaunchSource | null;
    generationProgress: number;
    generationStage: string;
    generationNodeProgress: GenerationNodeProgress[];
    generate: (effectiveConfig: GenerationConfig, options?: GenerateOptions) => void;
};
