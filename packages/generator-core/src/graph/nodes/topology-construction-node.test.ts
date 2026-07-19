import { describe, expect, it } from 'vitest';
import { GenerationGraphRunner } from '../runner';
import {
  resolveTopologyResolution,
  topologyConstructionNode,
  topologyConstructionNodeId
} from './topology-construction-node';

describe('topologyConstructionNode', () => {
  it('honors explicit topology resolution and enforces the current minimum', () => {
    expect(resolveTopologyResolution({ outputResolution: { width: 256, height: 128 }, topologyResolution: 24 })).toBe(24);
    expect(resolveTopologyResolution({ outputResolution: { width: 256, height: 128 }, topologyResolution: 4 })).toBe(16);
  });

  it('produces stable topology metadata for identical input', () => {
    const input = { outputResolution: { width: 256, height: 128 }, topologyResolution: 24 };
    const runner = new GenerationGraphRunner([topologyConstructionNode]);
    const first = runner.run(topologyConstructionNodeId, { rootSeed: 'seed-a' }, new Map([[topologyConstructionNodeId, input]]));
    const second = runner.run(topologyConstructionNodeId, { rootSeed: 'seed-b' }, new Map([[topologyConstructionNodeId, input]]));
    const firstOutput = first.results.get(topologyConstructionNodeId)?.output as ReturnType<typeof topologyConstructionNode.execute>;
    const secondOutput = second.results.get(topologyConstructionNodeId)?.output as ReturnType<typeof topologyConstructionNode.execute>;

    expect(firstOutput.resolvedResolution).toBe(24);
    expect(secondOutput.resolvedResolution).toBe(24);
    expect(firstOutput.topology.kind).toBe(secondOutput.topology.kind);
    expect(firstOutput.topology.cellCount).toBe(secondOutput.topology.cellCount);
    expect(Array.from(firstOutput.topology.latitudes)).toEqual(Array.from(secondOutput.topology.latitudes));
    expect(first.results.get(topologyConstructionNodeId)?.validation?.valid).toBe(true);
  });

  it('does not mutate its input', () => {
    const input = { outputResolution: { width: 128, height: 64 }, topologyResolution: 20 };
    const before = JSON.stringify(input);
    topologyConstructionNode.execute({ rootSeed: 'seed' }, input, new Map());
    expect(JSON.stringify(input)).toBe(before);
  });
});
