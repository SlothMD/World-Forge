import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/generator-core';
import type { WorldProject } from '@world-forge/shared';
import { projectGeneratorMismatch } from './DiagnosticsPanels';

describe('projectGeneratorMismatch', () => {
  it('does not warn when generated seed metadata uses a labeled world seed fallback', () => {
    const config = createDefaultConfig('9776542', { width: 2048, height: 1024 });
    const projectConfig = {
      ...config,
      seeds: { star: '9776542', world: 'world:9776542' }
    };
    const project = {
      seed: 'world:9776542',
      config: projectConfig,
      primaryWorld: {
        mapModel: { resolution: { width: 2048, height: 1024 } },
        topology: { resolution: config.topologyResolution }
      }
    } as unknown as WorldProject;

    expect(projectGeneratorMismatch(project, {
      ...config,
      seeds: { star: '9776542', world: '9776542' }
    } as typeof config)).toBeNull();
  });
});
