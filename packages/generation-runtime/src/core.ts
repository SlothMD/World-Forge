import type { WorldProject } from '@world-forge/shared';
import { ArtifactTypeRegistry } from './artifact-types';
import { legacyGenerateProjectStage } from './legacy';
import { StageRegistry } from './registry';
import type { GenerationWorkflow } from './workflow';

export const legacyWorldWorkflow: GenerationWorkflow = {
  schemaVersion: '0.1.0',
  id: 'core.legacy-world',
  version: '0.1.0',
  displayName: 'Legacy World Generation',
  description: 'Compatibility workflow for the current monolithic generator.',
  defaultFidelity: 'standard',
  stages: [
    {
      id: 'legacy-world',
      stageId: 'legacy.generate-project',
      implementationId: legacyGenerateProjectStage.id,
      bodyKind: 'system',
      parameters: {}
    }
  ]
};

/**
 * Runtime diagnostics measure execution, not generated world identity. Keep them
 * on the artifact payload for inspection, but exclude them from the deterministic
 * content hash so the same seed and configuration produce the same hash.
 */
export function hashableWorldProject(project: WorldProject): Omit<WorldProject, 'diagnostics'> {
  const { diagnostics: _diagnostics, ...stableProject } = project;
  return stableProject;
}

export function createCoreArtifactTypeRegistry(): ArtifactTypeRegistry {
  const registry = new ArtifactTypeRegistry();
  registry.register<WorldProject>({
    type: 'core.world-project',
    version: '1.0.0',
    sourceId: 'core',
    core: true,
    description: 'Compatibility envelope containing the current WorldProject output.',
    hashContent: hashableWorldProject
  });
  return registry;
}

export function createCoreStageRegistry(artifactTypes: ArtifactTypeRegistry = createCoreArtifactTypeRegistry()): StageRegistry {
  const registry = new StageRegistry(artifactTypes);
  registry.register(legacyGenerateProjectStage, { id: 'core', version: '0.1.0', kind: 'core', priority: 0 });
  return registry;
}
