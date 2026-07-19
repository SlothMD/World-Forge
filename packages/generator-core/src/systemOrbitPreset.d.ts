import { type GenerationConfig, type WorldProject } from '@world-forge/shared';
import type { DeepTimeProject } from './deepTimePipeline';
import { type NumericDistribution } from './numericDistribution';
export declare const plateCountDistributionsByPreset: Record<string, NumericDistribution>;
export declare function prepareSystemOrbitConfig(input: GenerationConfig): GenerationConfig;
export declare function reconcileSystemOrbitPresets(project: WorldProject): DeepTimeProject;
//# sourceMappingURL=systemOrbitPreset.d.ts.map