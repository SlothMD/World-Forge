import {
  GenerationGraphRun,
  GenerationGraphNodeRunEvent,
  GenerationNode,
  GenerationNodeContext,
  GenerationNodeExecution,
  GenerationNodeId
} from './types';

type RegisteredNode = GenerationNode<any, any>;

export class GenerationGraphRunner {
  private readonly nodes = new Map<GenerationNodeId, RegisteredNode>();

  constructor(nodes: readonly RegisteredNode[] = []) {
    for (const node of nodes) this.register(node);
  }

  register<TInput, TOutput>(node: GenerationNode<TInput, TOutput>): this {
    if (this.nodes.has(node.id)) throw new Error(`Generation node already registered: ${node.id}`);
    this.nodes.set(node.id, node);
    return this;
  }

  run(
    targetNodeId: GenerationNodeId,
    context: GenerationNodeContext,
    inputs: ReadonlyMap<GenerationNodeId, unknown>,
    onNodeEvent?: (event: GenerationGraphNodeRunEvent) => void
  ): GenerationGraphRun {
    const results = new Map<GenerationNodeId, GenerationNodeExecution<unknown>>();
    const visiting = new Set<GenerationNodeId>();

    const executeNode = (nodeId: GenerationNodeId): GenerationNodeExecution<unknown> => {
      const existing = results.get(nodeId);
      if (existing) return existing;
      if (visiting.has(nodeId)) throw new Error(`Generation graph cycle detected at node: ${nodeId}`);

      const node = this.nodes.get(nodeId);
      if (!node) throw new Error(`Generation node is not registered: ${nodeId}`);
      if (!inputs.has(nodeId)) throw new Error(`Generation node input is missing: ${nodeId}`);

      visiting.add(nodeId);
      const dependencyOutputs = new Map<GenerationNodeId, unknown>();
      for (const dependencyId of node.dependencies) {
        dependencyOutputs.set(dependencyId, executeNode(dependencyId).output);
      }

      const input = inputs.get(nodeId) as any;
      const startedAt = nowMs();
      onNodeEvent?.({
        nodeId,
        version: node.version,
        dependencies: node.dependencies,
        phase: 'started',
        startedAt,
        timestamp: startedAt
      });
      let output: unknown;
      try {
        output = node.execute(context, input, dependencyOutputs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const timestamp = nowMs();
        onNodeEvent?.({
          nodeId,
          version: node.version,
          dependencies: node.dependencies,
          phase: 'failed',
          startedAt,
          timestamp,
          durationMs: timestamp - startedAt,
          error: message
        });
        throw new Error(`Generation node ${nodeId} failed: ${message}`, { cause: error });
      } finally {
        visiting.delete(nodeId);
      }
      const finishedAt = nowMs();
      const validation = node.validate?.(input, output);

      const execution: GenerationNodeExecution<unknown> = {
        nodeId,
        version: node.version,
        output,
        durationMs: finishedAt - startedAt,
        validation
      };

      results.set(nodeId, execution);
      onNodeEvent?.({
        nodeId,
        version: node.version,
        dependencies: node.dependencies,
        phase: 'completed',
        startedAt,
        timestamp: finishedAt,
        durationMs: execution.durationMs,
        validation
      });
      return execution;
    };

    executeNode(targetNodeId);
    return { targetNodeId, results };
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
