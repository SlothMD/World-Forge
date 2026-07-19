import { type GenerationConfig } from '@world-forge/shared';
import { type DeepTimeProgress, type DeepTimeProject } from './deepTimePipeline';
import { type GenerateProjectOptions } from './index';
export type { DeepTimeProgress, DeepTimeProject } from './deepTimePipeline';
export declare function generateProjectWithMotionAwareDeepTime(input?: Partial<GenerationConfig>, options?: GenerateProjectOptions, onDeepTimeProgress?: (progress: DeepTimeProgress) => void): DeepTimeProject;
//# sourceMappingURL=plateMotionPipeline.d.ts.map