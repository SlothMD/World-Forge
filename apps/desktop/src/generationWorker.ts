import { GenerationPreviewFrame, generateProject } from '@world-forge/generator-core';
import { GenerationConfig, WorldProject } from '@world-forge/shared';

type WorkerMessenger = {
  postMessage(message: GenerateResponse, transfer?: Transferable[]): void;
};

type GenerateRequest = {
  type: 'generate';
  id: string;
  config: GenerationConfig;
};

type GenerateResponse =
  | {
      type: 'progress';
      id: string;
      preview: GenerationPreviewFrame;
    }
  | {
      type: 'complete';
      id: string;
      project: WorldProject;
    }
  | {
      type: 'error';
      id: string;
      message: string;
    };

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  if (event.data.type !== 'generate') return;
  try {
    const previewWidth = Math.min(1024, Math.max(256, Math.round(event.data.config.outputResolution.width / 2)));
    const previewHeight = Math.min(512, Math.max(128, Math.round(event.data.config.outputResolution.height / 2)));
    const project = generateProject(event.data.config, {
      previewResolution: {
        width: previewWidth,
        height: previewHeight
      },
      onProgress: (preview) => {
        (self as unknown as WorkerMessenger).postMessage({ type: 'progress', id: event.data.id, preview } satisfies GenerateResponse, [preview.rgba.buffer]);
      }
    });
    self.postMessage({ type: 'complete', id: event.data.id, project } satisfies GenerateResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: event.data.id,
      message: error instanceof Error ? error.message : String(error)
    } satisfies GenerateResponse);
  }
};
