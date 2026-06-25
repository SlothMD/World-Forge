import { generateProject } from '@world-forge/generator-core';
import { GenerationConfig, WorldProject } from '@world-forge/shared';

type GenerateRequest = {
  type: 'generate';
  id: string;
  config: GenerationConfig;
};

type GenerateResponse =
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
    const project = generateProject(event.data.config);
    self.postMessage({ type: 'complete', id: event.data.id, project } satisfies GenerateResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: event.data.id,
      message: error instanceof Error ? error.message : String(error)
    } satisfies GenerateResponse);
  }
};
