import type { RandomStream } from './contracts';
export declare function deriveSeedPath(rootSeed: string, ...parts: Array<string | number | undefined>): string;
export declare class DeterministicRandomStream implements RandomStream {
    readonly seedPath: string;
    private state;
    constructor(seedPath: string);
    next(): number;
    int(min: number, max: number): number;
    range(min: number, max: number): number;
    pick<T>(values: readonly T[]): T;
    child(name: string): RandomStream;
}
export declare function createStageRandom(rootSeed: string, workflowId: string, stageId: string, implementationId: string, bodyId?: string, iteration?: number): RandomStream;
//# sourceMappingURL=random.d.ts.map