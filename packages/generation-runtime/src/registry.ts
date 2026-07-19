import type { ArtifactTypeRegistry } from './artifact-types';
import type { BodyKind, FidelityLevel, StageImplementation } from './contracts';

export type StageRegistrationSource = {
  id: string;
  version: string;
  kind: 'core' | 'developer' | 'mod';
  priority?: number;
};

export type RegisteredImplementation = {
  implementation: StageImplementation;
  source: StageRegistrationSource;
};

export type ImplementationRequest = {
  stageId: string;
  bodyKind?: BodyKind;
  fidelity: FidelityLevel;
  preferredImplementationId?: string;
  allowedSourceIds?: string[];
};

export class StageRegistry {
  private readonly implementations = new Map<string, RegisteredImplementation>();
  private readonly byStage = new Map<string, string[]>();

  constructor(private readonly artifactTypes?: ArtifactTypeRegistry) {}

  get artifactTypeRegistry(): ArtifactTypeRegistry | undefined {
    return this.artifactTypes;
  }

  register(implementation: StageImplementation, source: StageRegistrationSource): void {
    if (this.implementations.has(implementation.id)) {
      throw new Error(`Stage implementation ${implementation.id} is already registered.`);
    }
    if (implementation.stageId !== implementation.definition.id) {
      throw new Error(`Implementation ${implementation.id} targets ${implementation.stageId}, but its definition declares ${implementation.definition.id}.`);
    }
    if (implementation.sourceId !== source.id) {
      throw new Error(`Implementation ${implementation.id} source ${implementation.sourceId} does not match registration source ${source.id}.`);
    }
    for (const input of implementation.definition.inputs) this.artifactTypes?.validateRequirement(input);
    for (const output of implementation.definition.outputs) this.artifactTypes?.validateDeclaration(output, source.id);
    this.implementations.set(implementation.id, { implementation, source });
    this.byStage.set(implementation.stageId, [...(this.byStage.get(implementation.stageId) ?? []), implementation.id]);
  }

  get(implementationId: string): RegisteredImplementation | undefined {
    return this.implementations.get(implementationId);
  }

  list(stageId?: string): RegisteredImplementation[] {
    if (!stageId) return [...this.implementations.values()];
    return (this.byStage.get(stageId) ?? []).map((id) => this.implementations.get(id)!).filter(Boolean);
  }

  resolve(request: ImplementationRequest): RegisteredImplementation {
    const candidates = this.list(request.stageId)
      .filter(({ implementation, source }) => {
        if (request.preferredImplementationId && implementation.id !== request.preferredImplementationId) return false;
        if (request.allowedSourceIds && !request.allowedSourceIds.includes(source.id)) return false;
        if (!implementation.definition.supportedFidelity.includes(request.fidelity)) return false;
        if (request.bodyKind && !implementation.definition.bodyKinds.includes(request.bodyKind)) return false;
        return true;
      })
      .sort((left, right) => {
        const sourceRank = (value: StageRegistrationSource['kind']) => value === 'core' ? 0 : value === 'developer' ? 1 : 2;
        return (right.source.priority ?? 0) - (left.source.priority ?? 0)
          || sourceRank(left.source.kind) - sourceRank(right.source.kind)
          || right.implementation.version.localeCompare(left.implementation.version)
          || left.implementation.id.localeCompare(right.implementation.id);
      });

    const selected = candidates[0];
    if (!selected) {
      const details = [request.bodyKind ? `body ${request.bodyKind}` : undefined, `fidelity ${request.fidelity}`].filter(Boolean).join(', ');
      throw new Error(`No compatible implementation found for stage ${request.stageId} (${details}).`);
    }
    return selected;
  }
}
