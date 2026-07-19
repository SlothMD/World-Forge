export declare class SeededRandom {
    private state;
    constructor(seed: string);
    next(): number;
    range(min: number, max: number): number;
    int(min: number, max: number): number;
    pick<T>(items: T[]): T;
}
export declare function hashSeed(seed: string): number;
//# sourceMappingURL=random.d.ts.map