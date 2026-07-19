import type { StagePermissionSet } from './contracts';
export type ModDependency = {
    id: string;
    version?: string;
};
export type ModStageRegistration = {
    implementationId: string;
    stageId: string;
    replaces?: boolean;
};
export type GenerationModManifest = {
    id: string;
    version: string;
    displayName?: string;
    priority?: number;
    dependsOn?: ModDependency[];
    loadsAfter?: string[];
    loadsBefore?: string[];
    permissions: StagePermissionSet;
    stages?: ModStageRegistration[];
};
export type ResolvedModOrder = {
    ordered: GenerationModManifest[];
    warnings: string[];
};
export declare function resolveModOrder(manifests: readonly GenerationModManifest[]): ResolvedModOrder;
export declare function assertPermissionSubset(requested: StagePermissionSet, granted: StagePermissionSet): void;
//# sourceMappingURL=mods.d.ts.map