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

export function validateWorkflow(workflow: GenerationWorkflow): WorkflowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set<string>();
  const groupIds = new Set((workflow.iterationGroups ?? []).map((group) => group.id));

  if (!workflow.id) errors.push('Workflow ID is required.');
  if (!workflow.version) errors.push('Workflow version is required.');
  if (!workflow.stages.length) errors.push('Workflow must contain at least one stage.');

  for (const node of workflow.stages) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate workflow node ID ${node.id}.`);
    nodeIds.add(node.id);
    if (!node.stageId) errors.push(`Workflow node ${node.id} is missing stageId.`);
    if (node.iterationGroup && !groupIds.has(node.iterationGroup)) errors.push(`Workflow node ${node.id} refers to missing iteration group ${node.iterationGroup}.`);
  }

  for (const node of workflow.stages) {
    for (const dependency of node.dependsOn ?? []) {
      if (!nodeIds.has(dependency)) errors.push(`Workflow node ${node.id} depends on missing node ${dependency}.`);
      if (dependency === node.id) errors.push(`Workflow node ${node.id} cannot depend on itself.`);
    }
  }

  for (const group of workflow.iterationGroups ?? []) {
    if (group.maxIterations < 1) errors.push(`Iteration group ${group.id} must allow at least one iteration.`);
    if ((group.minIterations ?? 1) > group.maxIterations) errors.push(`Iteration group ${group.id} has minIterations greater than maxIterations.`);
    if ((group.stableForIterations ?? 1) < 1) errors.push(`Iteration group ${group.id} must require at least one stable iteration.`);
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const byId = new Map(workflow.stages.map((node) => [node.id, node]));
  const visit = (nodeId: string, stack: string[]) => {
    const state = visitState.get(nodeId);
    if (state === 'visited') return;
    if (state === 'visiting') {
      const cycle = [...stack, nodeId];
      const cycleNodes = cycle.map((id) => byId.get(id)).filter(Boolean) as WorkflowStageNode[];
      const groups = new Set(cycleNodes.map((node) => node.iterationGroup).filter(Boolean));
      if (groups.size !== 1 || cycleNodes.some((node) => !node.iterationGroup)) errors.push(`Undeclared workflow cycle detected: ${cycle.join(' -> ')}.`);
      return;
    }
    visitState.set(nodeId, 'visiting');
    const node = byId.get(nodeId);
    for (const dependency of node?.dependsOn ?? []) visit(dependency, [...stack, nodeId]);
    visitState.set(nodeId, 'visited');
  };
  for (const node of workflow.stages) visit(node.id, []);

  if (workflow.stages.some((node) => node.enabled === false)) warnings.push('Disabled stages will be omitted from the resolved execution plan.');
  return { valid: errors.length === 0, errors, warnings };
}

export function resolveWorkflow(workflow: GenerationWorkflow, registry: StageRegistry): ResolvedWorkflow {
  const validation = validateWorkflow(workflow);
  if (!validation.valid) throw new Error(`Invalid workflow:\n${validation.errors.join('\n')}`);

  const enabled = workflow.stages.filter((node) => node.enabled !== false);
  const enabledIds = new Set(enabled.map((node) => node.id));
  for (const node of enabled) {
    const disabledDependency = (node.dependsOn ?? []).find((dependency) => !enabledIds.has(dependency));
    if (disabledDependency && !node.optional) throw new Error(`Enabled node ${node.id} depends on disabled node ${disabledDependency}.`);
  }

  const indegree = new Map(enabled.map((node) => [node.id, 0]));
  const outgoing = new Map(enabled.map((node) => [node.id, [] as string[]]));
  for (const node of enabled) {
    for (const dependency of node.dependsOn ?? []) {
      if (!enabledIds.has(dependency)) continue;
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
      outgoing.get(dependency)!.push(node.id);
    }
  }

  const ready = enabled.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.id.localeCompare(b.id));
  const ordered: WorkflowStageNode[] = [];
  while (ready.length) {
    const next = ready.shift()!;
    ordered.push(next);
    for (const target of outgoing.get(next.id) ?? []) {
      const remaining = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) {
        ready.push(enabled.find((node) => node.id === target)!);
        ready.sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }

  if (ordered.length !== enabled.length) {
    const cyclic = enabled.filter((node) => !ordered.includes(node));
    const undeclared = cyclic.filter((node) => !node.iterationGroup);
    if (undeclared.length) throw new Error(`Cannot resolve workflow order; undeclared cycle contains ${undeclared.map((node) => node.id).join(', ')}.`);
    for (const node of cyclic.sort((a, b) => a.id.localeCompare(b.id))) ordered.push(node);
  }

  const stages = ordered.map((node, order) => {
    const fidelity = node.fidelity ?? workflow.defaultFidelity;
    const selected = registry.resolve({
      stageId: node.stageId,
      bodyKind: node.bodyKind,
      fidelity,
      preferredImplementationId: node.implementationId
    });
    return {
      ...node,
      implementationId: selected.implementation.id,
      sourceId: selected.source.id,
      implementationVersion: selected.implementation.version,
      fidelity,
      order
    } satisfies ResolvedStageNode;
  });

  return { workflow, stages, warnings: validation.warnings };
}
