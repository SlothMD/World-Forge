import type { WorldProject } from '@world-forge/shared';
import { ArtifactTypeRegistry } from './artifact-types';
import { StageRegistry } from './registry';
import type { GenerationWorkflow } from './workflow';
export declare const legacyWorldWorkflow: GenerationWorkflow;
/**
 * Runtime diagnostics measure execution, not generated world identity. Keep them
 * on the artifact payload for inspection, but exclude them from the deterministic
 * content hash so the same seed and configuration produce the same hash.
 */
export declare function hashableWorldProject(project: WorldProject): Omit<WorldProject, 'diagnostics'>;
export declare function createCoreArtifactTypeRegistry(): ArtifactTypeRegistry;
export declare function createCoreStageRegistry(artifactTypes?: ArtifactTypeRegistry): StageRegistry;
//# sourceMappingURL=core.d.ts.map