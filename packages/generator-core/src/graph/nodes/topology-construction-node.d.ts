import { CubedSphereTopology } from '@world-forge/shared';
import { GenerationNode } from '../types';
export declare const topologyConstructionNodeId = "topology.construct";
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
export declare const topologyConstructionNode: GenerationNode<TopologyConstructionInput, TopologyConstructionOutput>;
export declare function resolveTopologyResolution(input: Readonly<TopologyConstructionInput>): number;
//# sourceMappingURL=topology-construction-node.d.ts.map