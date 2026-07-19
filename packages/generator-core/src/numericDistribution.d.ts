export type RandomSource = {
    next(): number;
    range(min: number, max: number): number;
};
export type NormalDistribution = {
    kind: 'normal';
    median: number;
    standardDeviation: number;
    hardMin: number;
    hardMax: number;
};
export type LogNormalDistribution = {
    kind: 'log-normal';
    median: number;
    sigma: number;
    hardMin: number;
    hardMax: number;
};
export type BetaDistribution = {
    kind: 'beta';
    alpha: number;
    beta: number;
    hardMin: number;
    hardMax: number;
};
export type UniformDistribution = {
    kind: 'uniform';
    min: number;
    max: number;
};
export type NumericDistribution = NormalDistribution | LogNormalDistribution | BetaDistribution | UniformDistribution;
export declare function sampleNumericDistribution(distribution: NumericDistribution, rng: RandomSource): number;
export declare function distributionCenter(distribution: NumericDistribution): number;
export declare function distributionSpread(distribution: NumericDistribution): number;
//# sourceMappingURL=numericDistribution.d.ts.map