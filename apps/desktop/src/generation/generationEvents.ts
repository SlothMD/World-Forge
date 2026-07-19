import type { WorldProject } from '@world-forge/shared';

export const generationTelemetryEvent = 'world-forge:generation-telemetry';
export const generationStageTelemetryEvent = 'world-forge:generation-stage-telemetry';
export const developerGenerationRunEvent = 'world-forge:developer-generation-run';

export type GenerationTelemetryDetail = {
  phase: 'started' | 'progress' | 'completed' | 'failed';
  taskId: string;
  progress: number;
  label: string;
  seed: string;
  startNodeId: string | null;
  startedAt: number;
  timestamp: number;
  project?: WorldProject;
  error?: string;
};

export type GenerationStageTelemetryDetail = {
  taskId: string;
  nodeId: string;
  stageId: string;
  phase: 'started' | 'progress' | 'completed' | 'warning' | 'failed' | 'skipped';
  progress: number;
  overallProgress: number;
  label: string;
  startedAt: number;
  timestamp: number;
  elapsedMs?: number;
  measured: boolean;
  graphNode?: boolean;
  dependencies?: string[];
  version?: string;
  message?: string;
  metrics?: Record<string, number | string | boolean>;
};

export type DeveloperGenerationRunDetail = {
  seed: string;
  startNodeId: string | null;
};
