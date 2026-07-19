import type { ArtifactEnvelope, ArtifactExtensions, ReadonlyArtifactAccess } from './contracts';
export declare function hashArtifact(type: string, version: string, hashContent: unknown, extensions?: ArtifactExtensions, tags?: readonly string[]): string;
export declare class ArtifactStore implements ReadonlyArtifactAccess {
    private readonly byId;
    private readonly byType;
    put<T>(artifact: ArtifactEnvelope<T>): ArtifactEnvelope<T>;
    replace<T>(artifact: ArtifactEnvelope<T>): ArtifactEnvelope<T>;
    get<T = unknown>(type: string): ArtifactEnvelope<T> | undefined;
    getById<T = unknown>(id: string): ArtifactEnvelope<T> | undefined;
    getAll<T = unknown>(type: string): ArtifactEnvelope<T>[];
    require<T = unknown>(type: string): ArtifactEnvelope<T>;
    values(): ArtifactEnvelope[];
}
export declare function createArtifact<T>(input: {
    id: string;
    type: string;
    version: string;
    core: T;
    hashContent?: unknown;
    stageId: string;
    implementationId: string;
    extensions?: ArtifactExtensions;
    tags?: string[];
}): ArtifactEnvelope<T>;
export declare function extendArtifact<T>(artifact: ArtifactEnvelope<T>, namespace: string, value: Record<string, unknown>, hashContent?: unknown): ArtifactEnvelope<T>;
export declare function tagArtifact<T>(artifact: ArtifactEnvelope<T>, namespace: string, tag: string, hashContent?: unknown): ArtifactEnvelope<T>;
//# sourceMappingURL=artifacts.d.ts.map