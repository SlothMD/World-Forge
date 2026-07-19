import {
  CubedSphereTopology,
  buildCubedSphereTopology,
  topologyResolutionForOutput
} from '@world-forge/shared';
import { GenerationNode, NodeValidationResult } from '../types';

export const topologyConstructionNodeId = 'topology.construct';

export type TopologyConstructionInput = {
  outputResolution: {
    width: number;
    height: number;
  };
  topologyResolution?: number;
};

export type TopologyConstructionOutput = {
  topology: CubedSphereTopology;
  resolvedResolution: number;
};

export const topologyConstructionNode: GenerationNode<TopologyConstructionInput, TopologyConstructionOutput> = {
  id: topologyConstructionNodeId,
  version: '1',
  dependencies: [],
  execute(_context, input) {
    const resolvedResolution = resolveTopologyResolution(input);
    return {
      topology: buildCubedSphereTopology(resolvedResolution),
      resolvedResolution
    };
  },
  validate(input, output) {
    return validateTopologyConstruction(input, output);
  }
};

export function resolveTopologyResolution(input: Readonly<TopologyConstructionInput>): number {
  return Math.max(
    16,
    Math.round(input.topologyResolution ?? topologyResolutionForOutput(input.outputResolution))
  );
}

function validateTopologyConstruction(
  input: Readonly<TopologyConstructionInput>,
  output: TopologyConstructionOutput
): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const expectedResolution = resolveTopologyResolution(input);
  const { topology } = output;

  if (output.resolvedResolution !== expectedResolution) {
    issues.push({ severity: 'error', message: 'Resolved topology resolution does not match the node input.' });
  }
  if (topology.resolution !== expectedResolution) {
    issues.push({ severity: 'error', message: 'Topology metadata resolution does not match the resolved resolution.' });
  }
  if (topology.cellCount <= 0) {
    issues.push({ severity: 'error', message: 'Topology contains no cells.' });
  }
  if (topology.latitudes.length !== topology.cellCount) {
    issues.push({ severity: 'error', message: 'Topology latitude array length does not match cell count.' });
  }
  if (topology.longitudes.length !== topology.cellCount) {
    issues.push({ severity: 'error', message: 'Topology longitude array length does not match cell count.' });
  }
  if (topology.areaWeights.length !== topology.cellCount) {
    issues.push({ severity: 'error', message: 'Topology area-weight array length does not match cell count.' });
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}
