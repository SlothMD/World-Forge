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
export declare class StageRegistry {
    private readonly artifactTypes?;
    private readonly implementations;
    private readonly byStage;
    constructor(artifactTypes?: ArtifactTypeRegistry | undefined);
    get artifactTypeRegistry(): ArtifactTypeRegistry | undefined;
    register(implementation: StageImplementation, source: StageRegistrationSource): void;
    get(implementationId: string): RegisteredImplementation | undefined;
    list(stageId?: string): RegisteredImplementation[];
    resolve(request: ImplementationRequest): RegisteredImplementation;
}
//# sourceMappingURL=registry.d.ts.map