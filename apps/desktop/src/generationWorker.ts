import { GenerationPreviewFrame } from '@world-forge/generator-core';
import {
  generateProjectWithNativeStages,
  type NativeGenerationStageEvent
} from '@world-forge/generator-core/nativeStagePipeline';
import type { GenerationGraphNodeRunEvent } from '@world-forge/generator-core/graph/types';
import { prepareSystemOrbitConfig, reconcileSystemOrbitPresets } from '@world-forge/generator-core/systemOrbitPreset';
import { coreGenerationGraph, generationGraphNodeForStageId } from '@world-forge/generation-runtime/graph/generationGraph';
import { GenerationConfig, WorldProject } from '@world-forge/shared';
import type { GenerationStageTelemetryDetail } from './generation/generationEvents';
import { APP_VERSION } from './appVersion';

type WorkerMessenger = { postMessage(message: GenerateResponse, transfer?: Transferable[]): void };
type GenerateRequest = { type: 'generate'; id: string; config: GenerationConfig };
type GenerateResponse =
  | { type: 'progress'; id: string; preview: GenerationPreviewFrame }
  | { type: 'stage'; id: string; stage: GenerationStageTelemetryDetail }
  | { type: 'complete'; id: string; project: WorldProject }
  | { type: 'error'; id: string; message: string };

type SeededGenerationConfig = GenerationConfig & { seeds?: { star?: string; world?: string } };

function desktopStageEvent(taskId: string, event: NativeGenerationStageEvent): GenerationStageTelemetryDetail {
  const definition = generationGraphNodeForStageId(event.stageId);
  const graphNode = definition?.id === 'system.orbit' || definition?.id === 'world.deep-time-aging' || definition?.id === 'world.outputs-validation';
  return {
    taskId,
    nodeId: definition?.id ?? event.stageId,
    stageId: event.stageId,
    phase: event.phase,
    progress: event.progress,
    overallProgress: event.overallProgress,
    label: event.label,
    startedAt: event.startedAt,
    timestamp: event.timestamp,
    elapsedMs: event.elapsedMs,
    measured: true,
    graphNode,
    message: event.message,
    metrics: event.metrics
  };
}

function desktopGraphNodeEvent(taskId: string, event: GenerationGraphNodeRunEvent): GenerationStageTelemetryDetail {
  const definition = generationGraphNodeForStageId(event.nodeId);
  const index = Math.max(0, coreGenerationGraph.findIndex((node) => node.id === event.nodeId));
  const localProgress = event.phase === 'completed' ? 1 : event.phase === 'failed' ? 1 : 0.02;
  return {
    taskId,
    nodeId: event.nodeId,
    stageId: event.nodeId,
    phase: event.phase === 'failed' ? 'failed' : event.phase,
    progress: localProgress,
    overallProgress: Math.min(0.995, (index + localProgress) / Math.max(1, coreGenerationGraph.length)),
    label: definition?.label ?? event.nodeId,
    startedAt: event.startedAt,
    timestamp: event.timestamp,
    elapsedMs: event.durationMs,
    measured: true,
    graphNode: true,
    dependencies: [...event.dependencies],
    version: event.version,
    message: event.error,
    metrics: event.validation ? {
      validationValid: event.validation.valid,
      validationIssueCount: event.validation.issues.length
    } : undefined
  };
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  if (event.data.type !== 'generate') return;
  const taskId = event.data.id;
  const messenger = self as unknown as WorkerMessenger;

  try {
    const config = prepareSystemOrbitConfig(event.data.config);
    const previewWidth = Math.min(1024, Math.max(256, Math.round(config.outputResolution.width / 2)));
    const previewHeight = Math.min(512, Math.max(128, Math.round(config.outputResolution.height / 2)));
    const generatedProject = generateProjectWithNativeStages(config, {
      appVersion: APP_VERSION,
      previewResolution: { width: previewWidth, height: previewHeight },
      onProgress: (preview) => {
        messenger.postMessage({ type: 'progress', id: taskId, preview } satisfies GenerateResponse, [preview.rgba.buffer]);
      },
      onStageEvent: (stageEvent) => {
        messenger.postMessage({ type: 'stage', id: taskId, stage: desktopStageEvent(taskId, stageEvent) } satisfies GenerateResponse);
      },
      onGraphNodeEvent: (graphNodeEvent) => {
        messenger.postMessage({ type: 'stage', id: taskId, stage: desktopGraphNodeEvent(taskId, graphNodeEvent) } satisfies GenerateResponse);
      }
    });
    const seededConfig = generatedProject.config as SeededGenerationConfig;
    const requestedSeeds = (event.data.config as SeededGenerationConfig).seeds;
    seededConfig.seeds = {
      ...seededConfig.seeds,
      star: seededConfig.seeds?.star ?? requestedSeeds?.star ?? event.data.config.seed,
      world: seededConfig.seeds?.world ?? requestedSeeds?.world ?? event.data.config.seed
    };
    const project = reconcileSystemOrbitPresets(generatedProject);
    messenger.postMessage({ type: 'complete', id: taskId, project } satisfies GenerateResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    messenger.postMessage({ type: 'error', id: taskId, message } satisfies GenerateResponse);
  }
};
