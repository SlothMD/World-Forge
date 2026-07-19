import type { BodyKind, FidelityLevel } from './contracts';
import type { StageRegistry } from './registry';
export type WorkflowStageNode = {
    id: string;
    stageId: string;
    implementationId?: string;
    bodyKind?: BodyKind;
    dependsOn?: string[];
    parameters?: Record<string, unknown>;
    fidelity?: FidelityLevel;
    optional?: boolean;
    enabled?: boolean;
    iterationGroup?: string;
};
export type WorkflowIterationGroup = {
    id: string;
    minIterations?: number;
    maxIterations: number;
    stableForIterations?: number;
    convergence?: Array<{
        signal: string;
        deltaBelow: number;
    }>;
    onFailure?: 'fail' | 'accept-best-and-warn';
};
export type GenerationWorkflow = {
    schemaVersion: '0.1.0';
    id: string;
    version: string;
    displayName: string;
    description?: string;
    defaultFidelity: FidelityLevel;
    stages: WorkflowStageNode[];
    iterationGroups?: WorkflowIterationGroup[];
};
export type ResolvedStageNode = WorkflowStageNode & {
    implementationId: string;
    sourceId: string;
    implementationVersion: string;
    fidelity: FidelityLevel;
    order: number;
};
export type ResolvedWorkflow = {
    workflow: GenerationWorkflow;
    stages: ResolvedStageNode[];
    warnings: string[];
};
export type WorkflowValidation = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
export declare function validateWorkflow(workflow: GenerationWorkflow): WorkflowValidation;
export declare function resolveWorkflow(workflow: GenerationWorkflow, registry: StageRegistry): ResolvedWorkflow;
//# sourceMappingURL=workflow.d.ts.map