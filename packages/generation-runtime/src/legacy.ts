import { generateProject } from '@world-forge/generator-core';
import type { GenerationConfig } from '@world-forge/shared';
import type { StageImplementation } from './contracts';

export const legacyGenerateProjectStage: StageImplementation = {
  id: 'core.legacy.generate-project',
  version: '0.1.0',
  stageId: 'legacy.generate-project',
  sourceId: 'core',
  definition: {
    id: 'legacy.generate-project',
    version: '0.1.0',
    displayName: 'Legacy project generator',
    description: 'Compatibility adapter around the pre-graph generateProject orchestration path.',
    bodyKinds: ['system'],
    inputs: [],
    outputs: [{ type: 'core.world-project', version: '1.0.0', core: true }],
    supportedFidelity: ['preview', 'standard', 'high', 'diagnostic'],
    deterministic: true,
    resumable: false,
    permissions: {
      readArtifacts: [],
      writeArtifacts: ['core.world-project'],
      extendMetadata: [],
      emitTags: false,
      emitEvents: false,
      filesystem: false,
      network: false,
      clock: false
    }
  },
  execute(context) {
    const config = {
      ...(context.parameters as Partial<GenerationConfig>),
      seed: String(context.parameters.seed ?? context.random.seedPath)
    };
    const project = generateProject(config);
    const artifact = context.output.writeCore('core.world-project', '1.0.0', project, {
      id: `world-project:${project.projectId}`
    });
    context.diagnostics.metric({ id: 'legacy.total-ms', value: project.diagnostics?.totalMs ?? 0, unit: 'ms' });
    context.diagnostics.metric({ id: 'legacy.ocean-percentage', value: project.metrics.oceanPercentage, unit: '%' });
    return { status: 'passed', artifacts: [artifact], metrics: [], findings: [] };
  }
};
