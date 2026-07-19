export type GenerationGraphNodeDefinition = {
    id: string;
    stageId: string;
    implementationId: string;
    label: string;
    description: string;
    inputs: string[];
    outputs: string[];
    fidelity: string[];
};
export declare const coreGenerationGraph: GenerationGraphNodeDefinition[];
export declare function generationGraphNodeForStageId(stageId: string): GenerationGraphNodeDefinition | undefined;
//# sourceMappingURL=generationGraph.d.ts.map