import { GenerationGraphRun, GenerationGraphNodeRunEvent, GenerationNode, GenerationNodeContext, GenerationNodeId } from './types';
type RegisteredNode = GenerationNode<any, any>;
export declare class GenerationGraphRunner {
    private readonly nodes;
    constructor(nodes?: readonly RegisteredNode[]);
    register<TInput, TOutput>(node: GenerationNode<TInput, TOutput>): this;
    run(targetNodeId: GenerationNodeId, context: GenerationNodeContext, inputs: ReadonlyMap<GenerationNodeId, unknown>, onNodeEvent?: (event: GenerationGraphNodeRunEvent) => void): GenerationGraphRun;
}
export {};
//# sourceMappingURL=runner.d.ts.map