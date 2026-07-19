import { SelectedValues } from '@world-forge/shared';
import { SeededRandom } from '../random';
import { GenerationGraphRunner } from './runner';
import {
  PlateConstructionOutput,
  plateConstructionNode,
  plateConstructionNodeId
} from './nodes/plate-construction-node';
import {
  PrimordialTerrainOutput,
  primordialTerrainNode,
  primordialTerrainNodeId
} from './nodes/primordial-terrain-node';
import {
  TopologyConstructionInput,
  TopologyConstructionOutput,
  topologyConstructionNode,
  topologyConstructionNodeId
} from './nodes/topology-construction-node';

export type GenerationFoundationThroughPlatesInput = {
  topology: TopologyConstructionInput;
  values: SelectedValues;
  rng: SeededRandom;
};

export type GenerationFoundationThroughPlatesOutput = {
  topology: TopologyConstructionOutput;
  primordial: PrimordialTerrainOutput;
  plates: PlateConstructionOutput;
  timings: {
    topologyMs: number;
    primordialMs: number;
    plateConstructionMs: number;
  };
};

/**
 * Temporary QA bisect entry point. It intentionally stops before terrain.crust-fields
 * so the shared RNG remains at the exact legacy boundary after plate construction.
 */
export function runGenerationFoundationThroughPlates(
  rootSeed: string,
  input: GenerationFoundationThroughPlatesInput
): GenerationFoundationThroughPlatesOutput {
  const runner = new GenerationGraphRunner([
    topologyConstructionNode,
    primordialTerrainNode,
    plateConstructionNode
  ]);
  const inputs = new Map<string, unknown>([
    [topologyConstructionNodeId, input.topology],
    [primordialTerrainNodeId, { values: input.values, rng: input.rng }],
    [plateConstructionNodeId, { requestedPlateCount: input.values.plateCount, rng: input.rng }]
  ]);
  const run = runner.run(plateConstructionNodeId, { rootSeed }, inputs);
  const topologyExecution = run.results.get(topologyConstructionNodeId);
  const primordialExecution = run.results.get(primordialTerrainNodeId);
  const plateExecution = run.results.get(plateConstructionNodeId);
  const topology = topologyExecution?.output as TopologyConstructionOutput | undefined;
  const primordial = primordialExecution?.output as PrimordialTerrainOutput | undefined;
  const plates = plateExecution?.output as PlateConstructionOutput | undefined;

  if (!topology || !primordial || !plates || !topologyExecution || !primordialExecution || !plateExecution) {
    throw new Error('Generation foundation through plates did not produce all required outputs.');
  }

  return {
    topology,
    primordial,
    plates,
    timings: {
      topologyMs: topologyExecution.durationMs,
      primordialMs: primordialExecution.durationMs,
      plateConstructionMs: plateExecution.durationMs
    }
  };
}
