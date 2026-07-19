import { GenerationGraphRunner } from './runner';
import {
  TopologyConstructionInput,
  TopologyConstructionOutput,
  topologyConstructionNode,
  topologyConstructionNodeId
} from './nodes/topology-construction-node';

const topologyRunner = new GenerationGraphRunner([topologyConstructionNode]);

export function runTopologyConstruction(
  rootSeed: string,
  input: TopologyConstructionInput
): TopologyConstructionOutput {
  const run = topologyRunner.run(
    topologyConstructionNodeId,
    { rootSeed },
    new Map([[topologyConstructionNodeId, input]])
  );
  const execution = run.results.get(topologyConstructionNodeId);
  if (!execution) throw new Error('Topology construction node did not produce a result.');
  if (execution.validation && !execution.validation.valid) {
    const messages = execution.validation.issues.map((issue) => issue.message).join(' ');
    throw new Error(`Topology construction validation failed: ${messages}`);
  }
  return execution.output as TopologyConstructionOutput;
}
