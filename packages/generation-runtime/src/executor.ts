import { performance } from 'node:perf_hooks';
import type { ArtifactTypeRegistry } from './artifact-types';
import { ArtifactStore, createArtifact, extendArtifact, tagArtifact } from './artifacts';
import type {
  ArtifactEnvelope,
  ArtifactOutputWriter,
  DiagnosticEmitter,
  DiagnosticFinding,
  DiagnosticMetric,
  EventLedgerEntry,
  EventLedgerWriter,
  StageProvenance,
  StageResult,
  StageStatus
} from './contracts';
import { createStageRandom } from './random';
import type { StageRegistry } from './registry';
import {
  defaultDeveloperSandboxPolicy,
  TrustedDeveloperSandbox,
  type SandboxPolicy,
  type StageSandboxAdapter
} from './sandbox';
import type { ResolvedStageNode, ResolvedWorkflow, WorkflowIterationGroup } from './workflow';

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

class RunArtifactWriter implements ArtifactOutputWriter {
  private sequence = 0;
  readonly written: ArtifactEnvelope[] = [];

  constructor(
    private readonly store: ArtifactStore,
    private readonly artifactTypes: ArtifactTypeRegistry | undefined,
    private readonly stageId: string,
    private readonly implementationId: string,
    private readonly allowedWrites: readonly string[],
    private readonly allowedExtensions: readonly string[],
    private readonly canTag: boolean
  ) {}

  writeCore<T>(type: string, version: string, core: T, options: { id?: string; tags?: string[] } = {}): ArtifactEnvelope<T> {
    if (!this.allowedWrites.includes(type) && !this.allowedWrites.includes('*')) {
      throw new Error(`Stage ${this.stageId} is not permitted to write artifact ${type}.`);
    }
    const hashContent = this.artifactTypes?.projectHashContent(type, version, core) ?? core;
    const artifact = createArtifact({
      id: options.id ?? `${this.stageId}:${type}:${++this.sequence}`,
      type,
      version,
      core,
      hashContent,
      tags: options.tags,
      stageId: this.stageId,
      implementationId: this.implementationId
    });
    this.store.put(artifact);
    this.written.push(artifact);
    return artifact;
  }

  extend<T extends Record<string, unknown>>(artifactId: string, namespace: string, value: T): void {
    if (!this.allowedExtensions.includes(namespace) && !this.allowedExtensions.includes('*')) {
      throw new Error(`Stage ${this.stageId} is not permitted to extend namespace ${namespace}.`);
    }
    const artifact = this.store.getById(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} is missing.`);
    const hashContent = this.artifactTypes?.projectHashContent(artifact.type, artifact.version, artifact.core) ?? artifact.core;
    this.store.replace(extendArtifact(artifact, namespace, value, hashContent));
  }

  addTag(artifactId: string, namespace: string, tag: string): void {
    if (!this.canTag) throw new Error(`Stage ${this.stageId} is not permitted to emit tags.`);
    const artifact = this.store.getById(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} is missing.`);
    const hashContent = this.artifactTypes?.projectHashContent(artifact.type, artifact.version, artifact.core) ?? artifact.core;
    this.store.replace(tagArtifact(artifact, namespace, tag, hashContent));
  }
}

function createAbortSignal(signal?: AbortSignal): AbortSignal {
  return signal ?? new AbortController().signal;
}

function resolveStatus(records: readonly StageRunRecord[]): WorkflowRunResult['status'] {
  if (records.some((record) => record.status === 'failed')) return 'failed';
  if (records.some((record) => record.status === 'cancelled')) return 'cancelled';
  if (records.some((record) => record.status === 'warning')) return 'warning';
  return 'passed';
}

function signalsWithinTolerance(
  group: WorkflowIterationGroup,
  previous: ReadonlyMap<string, number>,
  current: ReadonlyMap<string, number>
): boolean {
  if (!group.convergence?.length) return false;
  return group.convergence.every((rule) => {
    const prior = previous.get(rule.signal);
    const next = current.get(rule.signal);
    return prior !== undefined && next !== undefined && Math.abs(next - prior) <= rule.deltaBelow;
  });
}

export class WorkflowExecutor {
  constructor(
    private readonly registry: StageRegistry,
    private readonly sandbox: StageSandboxAdapter = new TrustedDeveloperSandbox(),
    private readonly sandboxPolicy: SandboxPolicy = defaultDeveloperSandboxPolicy
  ) {}

  async run(plan: ResolvedWorkflow, options: WorkflowRunOptions): Promise<WorkflowRunResult> {
    const startedAtDate = new Date();
    const startedMs = performance.now();
    const runId = options.runId ?? `${plan.workflow.id}:${options.seed}:${startedAtDate.getTime()}`;
    const store = new ArtifactStore();
    for (const artifact of options.initialArtifacts ?? []) store.put(artifact);
    const events: EventLedgerEntry[] = [];
    const records: StageRunRecord[] = [];
    const abortSignal = createAbortSignal(options.signal);
    const groups = new Map((plan.workflow.iterationGroups ?? []).map((group) => [group.id, group]));
    const groupNodes = new Map<string, ResolvedStageNode[]>();
    for (const node of plan.stages) {
      if (node.iterationGroup) groupNodes.set(node.iterationGroup, [...(groupNodes.get(node.iterationGroup) ?? []), node]);
    }

    const executedGroups = new Set<string>();
    for (const node of plan.stages) {
      if (abortSignal.aborted) break;
      if (node.iterationGroup) {
        if (executedGroups.has(node.iterationGroup)) continue;
        executedGroups.add(node.iterationGroup);
        const group = groups.get(node.iterationGroup);
        if (!group) throw new Error(`Resolved node ${node.id} refers to missing iteration group ${node.iterationGroup}.`);
        await this.runIterationGroup(plan, group, groupNodes.get(group.id) ?? [], options.seed, runId, store, events, records, abortSignal);
      } else {
        await this.runNode(plan, node, options.seed, runId, store, events, records, abortSignal);
      }
      if (records.at(-1)?.status === 'failed' && !node.optional) break;
    }

    if (abortSignal.aborted && !records.some((record) => record.status === 'cancelled')) {
      records.push({ nodeId: 'workflow', stageId: 'workflow', implementationId: 'workflow', status: 'cancelled', metrics: [], findings: [] });
    }

    const completedAtDate = new Date();
    return {
      runId,
      workflowId: plan.workflow.id,
      workflowVersion: plan.workflow.version,
      seed: options.seed,
      status: resolveStatus(records),
      stages: records,
      artifacts: store.values(),
      events,
      startedAt: startedAtDate.toISOString(),
      completedAt: completedAtDate.toISOString(),
      durationMs: Math.round((performance.now() - startedMs) * 1000) / 1000
    };
  }

  private async runIterationGroup(
    plan: ResolvedWorkflow,
    group: WorkflowIterationGroup,
    nodes: ResolvedStageNode[],
    seed: string,
    runId: string,
    store: ArtifactStore,
    events: EventLedgerEntry[],
    records: StageRunRecord[],
    signal: AbortSignal
  ): Promise<void> {
    let previousSignals = new Map<string, number>();
    let stableIterations = 0;
    const minimum = group.minIterations ?? 1;
    const requiredStable = group.stableForIterations ?? 1;

    for (let iteration = 1; iteration <= group.maxIterations; iteration += 1) {
      if (signal.aborted) return;
      const currentSignals = new Map<string, number>();
      for (const node of nodes) {
        const result = await this.runNode(plan, node, seed, runId, store, events, records, signal, iteration);
        for (const convergence of result?.convergenceSignals ?? []) currentSignals.set(convergence.id, convergence.value);
        if (result?.status === 'failed' && !node.optional) return;
      }

      stableIterations = signalsWithinTolerance(group, previousSignals, currentSignals) ? stableIterations + 1 : 0;
      previousSignals = currentSignals;
      if (iteration >= minimum && stableIterations >= requiredStable) return;
    }

    const lastRecord = records.at(-1);
    if (!lastRecord) return;
    if (group.onFailure === 'accept-best-and-warn') {
      lastRecord.status = 'warning';
      lastRecord.findings.push({
        id: `${group.id}.not-converged`,
        severity: 'warn',
        title: 'Iteration group did not converge',
        detail: `${group.id} reached ${group.maxIterations} iterations and accepted the final state.`
      });
    } else {
      lastRecord.status = 'failed';
      lastRecord.error = `Iteration group ${group.id} did not converge within ${group.maxIterations} iterations.`;
    }
  }

  private async runNode(
    plan: ResolvedWorkflow,
    node: ResolvedStageNode,
    seed: string,
    runId: string,
    store: ArtifactStore,
    events: EventLedgerEntry[],
    records: StageRunRecord[],
    signal: AbortSignal,
    iteration?: number
  ): Promise<StageResult | undefined> {
    const registered = this.registry.get(node.implementationId);
    if (!registered) throw new Error(`Implementation ${node.implementationId} is no longer registered.`);
    const { implementation } = registered;
    const started = new Date();
    const startedMs = performance.now();
    const metrics: DiagnosticMetric[] = [];
    const findings: DiagnosticFinding[] = [];
    const inputArtifactHashes = implementation.definition.inputs.flatMap((input) => store.getAll(input.type).map((artifact) => artifact.hash));
    const random = createStageRandom(seed, plan.workflow.id, node.stageId, implementation.id, node.bodyKind, iteration);

    const eventWriter: EventLedgerWriter = {
      append: (entry) => {
        if (!implementation.definition.permissions.emitEvents) throw new Error(`Stage ${node.stageId} is not permitted to emit events.`);
        const created: EventLedgerEntry = { ...entry, id: `${node.id}:event:${events.length + 1}`, sourceStageId: node.stageId };
        events.push(created);
        return created;
      }
    };
    const diagnostics: DiagnosticEmitter = {
      metric: (metric) => metrics.push(metric),
      finding: (finding) => findings.push(finding)
    };
    const writer = new RunArtifactWriter(
      store,
      this.registry.artifactTypeRegistry,
      node.stageId,
      implementation.id,
      implementation.definition.permissions.writeArtifacts,
      implementation.definition.permissions.extendMetadata,
      implementation.definition.permissions.emitTags
    );

    if (signal.aborted) {
      records.push({ nodeId: node.id, stageId: node.stageId, implementationId: implementation.id, status: 'cancelled', iteration, metrics, findings });
      return undefined;
    }

    try {
      for (const requirement of implementation.definition.inputs) {
        const available = store.getAll(requirement.type);
        if (!requirement.optional && !available.length) throw new Error(`Stage ${node.stageId} requires artifact ${requirement.type}.`);
        if (!requirement.multiple && available.length > 1) {
          findings.push({
            id: `${node.id}.${requirement.type}.multiple`,
            severity: 'info',
            title: 'Multiple artifacts available',
            detail: `Stage ${node.stageId} will receive the latest ${requirement.type} artifact.`
          });
        }
      }

      const sandboxResult = await this.sandbox.run({
        implementation,
        policy: this.sandboxPolicy,
        context: {
          runId,
          workflowId: plan.workflow.id,
          workflowVersion: plan.workflow.version,
          stageId: node.stageId,
          implementationId: implementation.id,
          sourceId: implementation.sourceId,
          fidelity: node.fidelity,
          parameters: Object.freeze({ ...(node.parameters ?? {}) }),
          artifacts: store,
          output: writer,
          random,
          diagnostics,
          events: eventWriter,
          signal,
          iteration
        }
      });

      const returned = sandboxResult.result;
      const result: StageResult = returned ?? { status: 'passed', artifacts: [], metrics: [], findings: [] };
      if (!result.artifacts.length && writer.written.length) result.artifacts.push(...writer.written);
      result.metrics.push(...metrics);
      result.findings.push(...findings);
      const completed = new Date();
      const provenance: StageProvenance = {
        runId,
        workflowId: plan.workflow.id,
        workflowVersion: plan.workflow.version,
        stageId: node.stageId,
        implementationId: implementation.id,
        implementationVersion: implementation.version,
        sourceId: implementation.sourceId,
        seedPath: random.seedPath,
        inputArtifactHashes,
        outputArtifactHashes: result.artifacts.map((artifact) => artifact.hash),
        startedAt: started.toISOString(),
        completedAt: completed.toISOString(),
        durationMs: Math.round((performance.now() - startedMs) * 1000) / 1000,
        fidelity: node.fidelity,
        iteration
      };
      result.provenance = provenance;
      records.push({
        nodeId: node.id,
        stageId: node.stageId,
        implementationId: implementation.id,
        status: result.status,
        iteration,
        metrics: result.metrics,
        findings: result.findings,
        provenance
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      records.push({
        nodeId: node.id,
        stageId: node.stageId,
        implementationId: implementation.id,
        status: signal.aborted ? 'cancelled' : 'failed',
        iteration,
        metrics,
        findings,
        error: message
      });
      return {
        status: 'failed',
        artifacts: [],
        metrics,
        findings: [...findings, { id: `${node.id}.failed`, severity: 'error', title: 'Stage failed', detail: message }]
      };
    }
  }
}
