import type { GenerationConfig } from '@world-forge/shared';
import type { PresetTestMode, PresetValidationReport } from './presetValidation';

type WorkerMessage =
  | { type: 'progress'; completed: number; total: number; currentId: string }
  | { type: 'complete'; report: PresetValidationReport }
  | { type: 'cancelled'; completed: number; total: number }
  | { type: 'error'; message: string };

export type PresetValidationRunState = {
  running: boolean;
  completed: number;
  total: number;
  currentId: string;
  message: string;
  report: PresetValidationReport | null;
};

const listeners = new Set<() => void>();
let worker: Worker | null = null;
let state: PresetValidationRunState = {
  running: false,
  completed: 0,
  total: 0,
  currentId: '',
  message: '',
  report: null
};

function expectedCases(mode: PresetTestMode): number {
  if (mode === 'deep') return 1400;
  return mode === 'full' ? 140 : 80;
}

function publish(patch: Partial<PresetValidationRunState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribePresetValidationRun(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPresetValidationRunSnapshot(): PresetValidationRunState {
  return state;
}

export function startPresetValidationRun(mode: PresetTestMode, baseConfig: GenerationConfig): void {
  worker?.terminate();
  worker = new Worker(new URL('./presetValidationWorker.ts', import.meta.url), { type: 'module' });
  publish({
    running: true,
    completed: 0,
    total: expectedCases(mode),
    currentId: 'Preparing matrix',
    message: '',
    report: null
  });

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data;
    if (data.type === 'progress') {
      publish({ completed: data.completed, total: data.total, currentId: data.currentId });
      return;
    }
    if (data.type === 'complete') {
      publish({
        running: false,
        completed: data.report.totalCases,
        total: data.report.totalCases,
        currentId: 'Complete',
        report: data.report
      });
    } else if (data.type === 'cancelled') {
      publish({
        running: false,
        completed: data.completed,
        total: data.total,
        currentId: 'Cancelled',
        message: `Cancelled after ${data.completed} of ${data.total} cases.`
      });
    } else if (data.type === 'error') {
      publish({ running: false, currentId: 'Error', message: data.message });
    }
    worker?.terminate();
    worker = null;
  };

  worker.onerror = (event) => {
    publish({ running: false, currentId: 'Error', message: event.message || 'Preset validation worker failed.' });
    worker?.terminate();
    worker = null;
  };

  worker.postMessage({ type: 'start', mode, baseConfig });
}

export function cancelPresetValidationRun(): void {
  worker?.postMessage({ type: 'cancel' });
}
