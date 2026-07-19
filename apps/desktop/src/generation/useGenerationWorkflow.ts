import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { GenerationPreviewFrame } from '@world-forge/generator-core';
import {
  generateProjectWithNativeStages,
  type NativeGenerationStageEvent
} from '@world-forge/generator-core/nativeStagePipeline';
import { prepareSystemOrbitConfig, reconcileSystemOrbitPresets } from '@world-forge/generator-core/systemOrbitPreset';
import type { GenerationGraphNodeRunEvent } from '@world-forge/generator-core/graph/types';
import { coreGenerationGraph, generationGraphNodeForStageId } from '@world-forge/generation-runtime/graph/generationGraph';
import { GenerationConfig, WorldProject } from '@world-forge/shared';
import { APP_VERSION } from '../appVersion';
import { loadWorkspaceSettings } from '../sync';
import {
  developerGenerationRunEvent,
  generationStageTelemetryEvent,
  generationTelemetryEvent,
  type DeveloperGenerationRunDetail,
  type GenerationStageTelemetryDetail,
  type GenerationTelemetryDetail
} from './generationEvents';

export { generationStageTelemetryEvent, generationTelemetryEvent } from './generationEvents';
export type { GenerationStageTelemetryDetail, GenerationTelemetryDetail } from './generationEvents';

export type GenerationLaunchSource = 'generator' | 'dev-graph';

type GenerationWorkerMessage = {
  type: 'progress' | 'stage' | 'complete' | 'error';
  id: string;
  preview?: GenerationPreviewFrame;
  stage?: GenerationStageTelemetryDetail;
  project?: WorldProject;
  message?: string;
};

type UseGenerationWorkflowOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previousProject: WorldProject | null;
  onProjectGenerated: (project: WorldProject) => void;
};

type GenerateOptions = { startNodeId?: string | null; source?: GenerationLaunchSource };
export type GenerationNodeProgress = {
  nodeId: string;
  label: string;
  progress: number;
  status: 'waiting' | 'running' | 'complete' | 'failed';
  elapsedMs?: number;
};

function emitGenerationTelemetry(detail: GenerationTelemetryDetail): void {
  window.dispatchEvent(new CustomEvent<GenerationTelemetryDetail>(generationTelemetryEvent, { detail }));
}

function emitGenerationStageTelemetry(detail: GenerationStageTelemetryDetail): void {
  window.dispatchEvent(new CustomEvent<GenerationStageTelemetryDetail>(generationStageTelemetryEvent, { detail }));
}

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

export function useGenerationWorkflow({ canvasRef, previousProject, onProjectGenerated }: UseGenerationWorkflowOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [generationNodeProgress, setGenerationNodeProgress] = useState<GenerationNodeProgress[]>(() => initialNodeProgress());
  const [launchSource, setLaunchSource] = useState<GenerationLaunchSource | null>(null);
  const generationEstimateRef = useRef(24000);
  const generationStartedAtRef = useRef(0);
  const generationTaskIdRef = useRef('');
  const generationSeedRef = useRef('');
  const generationStartNodeIdRef = useRef<string | null>(null);
  const generationLaunchSourceRef = useRef<GenerationLaunchSource>('generator');
  const workerRef = useRef<Worker | null>(null);
  const generationPreviewRef = useRef<GenerationPreviewFrame | null>(null);
  const generationPreviewFrameRef = useRef(0);
  const previousProjectRef = useRef(previousProject);
  const onProjectGeneratedRef = useRef(onProjectGenerated);

  useEffect(() => { previousProjectRef.current = previousProject; }, [previousProject]);
  useEffect(() => { onProjectGeneratedRef.current = onProjectGenerated; }, [onProjectGenerated]);

  useEffect(() => {
    const root = document.documentElement;
    if (isGenerating && launchSource) root.dataset.generationSource = launchSource;
    else delete root.dataset.generationSource;
    return () => { if (root.dataset.generationSource === launchSource) delete root.dataset.generationSource; };
  }, [isGenerating, launchSource]);

  const drawGenerationPreview = useCallback(() => {
    if (generationLaunchSourceRef.current === 'dev-graph') return;
    const preview = generationPreviewRef.current;
    const canvas = canvasRef.current;
    if (!preview || !canvas) return;
    canvas.width = preview.width;
    canvas.height = preview.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba.buffer as ArrayBuffer), preview.width, preview.height), 0, 0);
  }, [canvasRef]);

  const scheduleGenerationPreviewPaint = useCallback(() => {
    if (generationPreviewFrameRef.current || generationLaunchSourceRef.current === 'dev-graph') return;
    generationPreviewFrameRef.current = window.requestAnimationFrame(() => {
      generationPreviewFrameRef.current = 0;
      drawGenerationPreview();
    });
  }, [drawGenerationPreview]);

  const finishGeneration = useCallback(() => {
    setGenerationProgress(1);
    setGenerationStage('');
    setIsGenerating(false);
    setLaunchSource(null);
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../generationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<GenerationWorkerMessage>) => {
      if (event.data.id !== generationTaskIdRef.current) return;
      if (event.data.type === 'stage' && event.data.stage) {
        const stage = event.data.stage;
        emitGenerationStageTelemetry(stage);
        if (stage.graphNode) {
          setGenerationNodeProgress((current) => updateNodeProgress(current, stage));
        }
        if (stage.phase === 'started' || stage.phase === 'progress' || stage.graphNode) {
          setGenerationStage(stage.message || stage.label);
          setGenerationProgress(localStageProgress(stage));
        }
        return;
      }
      if (event.data.type === 'progress' && event.data.preview) {
        generationPreviewRef.current = event.data.preview;
        emitGenerationTelemetry({
          phase: 'progress', taskId: event.data.id, progress: event.data.preview.progress, label: event.data.preview.label,
          seed: generationSeedRef.current, startNodeId: generationStartNodeIdRef.current,
          startedAt: generationStartedAtRef.current, timestamp: performance.now()
        });
        scheduleGenerationPreviewPaint();
        return;
      }
      if (event.data.type === 'complete' && event.data.project) {
        generationPreviewRef.current = null;
        onProjectGeneratedRef.current(event.data.project);
        generationEstimateRef.current = Math.max(3000, event.data.project.diagnostics?.totalMs ?? generationEstimateRef.current);
        emitGenerationTelemetry({
          phase: 'completed', taskId: event.data.id, progress: 1, label: 'World project complete',
          seed: generationSeedRef.current, startNodeId: generationStartNodeIdRef.current,
          startedAt: generationStartedAtRef.current, timestamp: performance.now(), project: event.data.project
        });
      } else if (event.data.type === 'error') {
        const message = event.data.message ?? 'Generation failed';
        console.error(message);
        emitGenerationTelemetry({
          phase: 'failed', taskId: event.data.id, progress: 1, label: 'Generation failed', seed: generationSeedRef.current,
          startNodeId: generationStartNodeIdRef.current, startedAt: generationStartedAtRef.current,
          timestamp: performance.now(), error: message
        });
      }
      finishGeneration();
    };
    worker.onerror = (event) => {
      console.error(event.message);
      emitGenerationTelemetry({
        phase: 'failed', taskId: generationTaskIdRef.current, progress: 1, label: 'Generation worker failed',
        seed: generationSeedRef.current, startNodeId: generationStartNodeIdRef.current,
        startedAt: generationStartedAtRef.current, timestamp: performance.now(), error: event.message
      });
      setGenerationStage('');
      setIsGenerating(false);
      setLaunchSource(null);
    };
    return () => {
      if (generationPreviewFrameRef.current) window.cancelAnimationFrame(generationPreviewFrameRef.current);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [finishGeneration, scheduleGenerationPreviewPaint]);

  useEffect(() => {
    if (!isGenerating) { setGenerationProgress(0); return; }
    const timer = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(current, 0.98));
    }, 150);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const generate = useCallback((effectiveConfig: GenerationConfig, options: GenerateOptions = {}) => {
    const taskId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const source = options.source ?? 'generator';
    generationTaskIdRef.current = taskId;
    generationSeedRef.current = effectiveConfig.seed;
    generationStartNodeIdRef.current = options.startNodeId ?? null;
    generationLaunchSourceRef.current = source;
    generationStartedAtRef.current = performance.now();
    generationEstimateRef.current = Math.max(3000, previousProjectRef.current?.diagnostics?.totalMs ?? generationEstimateRef.current);
    generationPreviewRef.current = null;
    setGenerationStage('Starting generation...');
    setGenerationProgress(0.02);
    setGenerationNodeProgress(initialNodeProgress());
    setLaunchSource(source);
    setIsGenerating(true);
    emitGenerationTelemetry({
      phase: 'started', taskId, progress: 0.02, label: 'Starting generation...', seed: effectiveConfig.seed,
      startNodeId: generationStartNodeIdRef.current, startedAt: generationStartedAtRef.current,
      timestamp: generationStartedAtRef.current
    });

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'generate', id: taskId, config: effectiveConfig });
      return;
    }

    window.setTimeout(() => {
      try {
        const preparedConfig = prepareSystemOrbitConfig(effectiveConfig);
        const generatedProject = generateProjectWithNativeStages(preparedConfig, {
          appVersion: APP_VERSION,
          onStageEvent: (event) => {
            const stage = desktopStageEvent(taskId, event);
            emitGenerationStageTelemetry(stage);
            if (stage.phase === 'started' || stage.phase === 'progress') {
              setGenerationStage(stage.message || stage.label);
              setGenerationProgress(localStageProgress(stage));
            }
          },
          onGraphNodeEvent: (event) => {
            const stage = desktopGraphNodeEvent(taskId, event);
            emitGenerationStageTelemetry(stage);
            setGenerationNodeProgress((current) => updateNodeProgress(current, stage));
            if (stage.phase === 'started') setGenerationStage(stage.label);
            setGenerationProgress(localStageProgress(stage));
          }
        });
        const nextProject = reconcileSystemOrbitPresets(generatedProject);
        if (generationTaskIdRef.current !== taskId) return;
        onProjectGeneratedRef.current(nextProject);
        generationEstimateRef.current = Math.max(3000, nextProject.diagnostics?.totalMs ?? generationEstimateRef.current);
        emitGenerationTelemetry({
          phase: 'completed', taskId, progress: 1, label: 'World project complete', seed: effectiveConfig.seed,
          startNodeId: generationStartNodeIdRef.current, startedAt: generationStartedAtRef.current,
          timestamp: performance.now(), project: nextProject
        });
        finishGeneration();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitGenerationTelemetry({
          phase: 'failed', taskId, progress: 1, label: 'Generation failed', seed: effectiveConfig.seed,
          startNodeId: generationStartNodeIdRef.current, startedAt: generationStartedAtRef.current,
          timestamp: performance.now(), error: message
        });
        setGenerationStage('');
        setIsGenerating(false);
        setLaunchSource(null);
      }
    }, 20);
  }, [finishGeneration]);

  useEffect(() => {
    const handleDeveloperRun = (event: Event) => {
      if (isGenerating) return;
      const detail = (event as CustomEvent<DeveloperGenerationRunDetail>).detail;
      const storedConfig = loadWorkspaceSettings().config;
      const sourceConfig = storedConfig ?? previousProjectRef.current?.config;
      if (!sourceConfig) {
        window.alert('No generator configuration is available. Open the Generator tab once before running the graph.');
        return;
      }
      generate({ ...sourceConfig, seed: detail.seed || sourceConfig.seed }, { startNodeId: detail.startNodeId, source: 'dev-graph' });
    };
    window.addEventListener(developerGenerationRunEvent, handleDeveloperRun);
    return () => window.removeEventListener(developerGenerationRunEvent, handleDeveloperRun);
  }, [generate, isGenerating]);

  return { isGenerating, launchSource, generationProgress, generationStage, generationNodeProgress, generate };
}

function initialNodeProgress(): GenerationNodeProgress[] {
  return coreGenerationGraph.map((node) => ({ nodeId: node.id, label: node.label, progress: 0, status: 'waiting' }));
}

function updateNodeProgress(current: GenerationNodeProgress[], stage: GenerationStageTelemetryDetail): GenerationNodeProgress[] {
  return current.map((node) => {
    if (stage.nodeId === 'world.deep-time-aging' && node.nodeId === 'world.motion-coupling') {
      return { ...node, progress: 1, status: 'complete' };
    }
    if (stage.nodeId === 'world.outputs-validation' && node.nodeId === 'world.deep-time-aging' && node.status !== 'failed') {
      return { ...node, progress: 1, status: 'complete' };
    }
    if (node.nodeId !== stage.nodeId) return node;
    return {
      ...node,
      progress: stage.phase === 'completed' ? 1 : stage.phase === 'failed' ? 1 : Math.max(0.02, Math.min(0.98, stage.progress)),
      status: stage.phase === 'completed' ? 'complete' : stage.phase === 'failed' ? 'failed' : 'running',
      elapsedMs: stage.elapsedMs
    };
  });
}

function localStageProgress(stage: GenerationStageTelemetryDetail): number {
  if (stage.phase === 'completed') return 1;
  if (stage.phase === 'failed') return 1;
  return Math.max(0.02, Math.min(0.98, stage.progress));
}
