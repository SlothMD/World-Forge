import type { ArtifactEnvelope, DiagnosticFinding, DiagnosticMetric, EventLedgerEntry, StageProvenance, StageStatus } from './contracts';
import type { StageRegistry } from './registry';
import { type SandboxPolicy, type StageSandboxAdapter } from './sandbox';
import type { ResolvedWorkflow } from './workflow';
export type WorkflowRunOptions = {
    seed: string;
    runId?: string;
    signal?: AbortSignal;
    initialArtifacts?: ArtifactEnvelope[];
};
export type StageRunRecord = {
    nodeId: string;
    stageId: string;
    implementationId: string;
    status: StageStatus;
    iteration?: number;
    metrics: DiagnosticMetric[];
    findings: DiagnosticFinding[];
    provenance?: StageProvenance;
    error?: string;
};
export type WorkflowRunResult = {
    runId: string;
    workflowId: string;
    workflowVersion: string;
    seed: string;
    status: 'passed' | 'warning' | 'failed' | 'cancelled';
    stages: StageRunRecord[];
    artifacts: ArtifactEnvelope[];
    events: EventLedgerEntry[];
    startedAt: string;
    completedAt: string;
    durationMs: number;
};
export declare class WorkflowExecutor {
    private readonly registry;
    private readonly sandbox;
    private readonly sandboxPolicy;
    constructor(registry: StageRegistry, sandbox?: StageSandboxAdapter, sandboxPolicy?: SandboxPolicy);
    run(plan: ResolvedWorkflow, options: WorkflowRunOptions): Promise<WorkflowRunResult>;
    private runIterationGroup;
    private runNode;
}
//# sourceMappingURL=executor.d.ts.map