import type { ArtifactDeclaration, ArtifactRequirement } from './contracts';
export type ArtifactTypeDefinition<T = unknown> = {
    type: string;
    version: string;
    sourceId: string;
    core: boolean;
    description?: string;
    /**
     * Projects an artifact payload to the deterministic content used for hashing.
     * Runtime telemetry, timestamps, and other volatile metadata should be omitted.
     */
    hashContent?: (value: T) => unknown;
};
export declare class ArtifactTypeRegistry {
    private readonly definitions;
    register<T>(definition: ArtifactTypeDefinition<T>): void;
    get<T = unknown>(type: string, version: string): ArtifactTypeDefinition<T> | undefined;
    list(type?: string): ArtifactTypeDefinition[];
    projectHashContent<T>(type: string, version: string, value: T): unknown;
    validateDeclaration(declaration: ArtifactDeclaration, sourceId: string): void;
    validateRequirement(requirement: ArtifactRequirement): void;
    private key;
}
//# sourceMappingURL=artifact-types.d.ts.map