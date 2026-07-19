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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function standardNormal(rng: RandomSource): number {
  const u1 = Math.max(Number.EPSILON, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function gamma(shape: number, rng: RandomSource): number {
  if (shape <= 0) return 0;
  if (shape < 1) {
    return gamma(shape + 1, rng) * Math.pow(Math.max(Number.EPSILON, rng.next()), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const x = standardNormal(rng);
    const vBase = 1 + c * x;
    if (vBase <= 0) continue;
    const v = vBase ** 3;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(Math.max(Number.EPSILON, u)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return shape;
}

export function sampleNumericDistribution(distribution: NumericDistribution, rng: RandomSource): number {
  if (distribution.kind === 'uniform') return rng.range(distribution.min, distribution.max);

  if (distribution.kind === 'normal') {
    const sample = distribution.median + standardNormal(rng) * Math.max(0, distribution.standardDeviation);
    return clamp(sample, distribution.hardMin, distribution.hardMax);
  }

  if (distribution.kind === 'log-normal') {
    const median = Math.max(Number.EPSILON, distribution.median);
    const sample = Math.exp(Math.log(median) + standardNormal(rng) * Math.max(0, distribution.sigma));
    return clamp(sample, distribution.hardMin, distribution.hardMax);
  }

  const x = gamma(distribution.alpha, rng);
  const y = gamma(distribution.beta, rng);
  const normalized = x + y > 0 ? x / (x + y) : 0.5;
  return distribution.hardMin + normalized * (distribution.hardMax - distribution.hardMin);
}

export function distributionCenter(distribution: NumericDistribution): number {
  if (distribution.kind === 'uniform') return (distribution.min + distribution.max) / 2;
  if (distribution.kind === 'beta') {
    const normalized = distribution.alpha / Math.max(Number.EPSILON, distribution.alpha + distribution.beta);
    return distribution.hardMin + normalized * (distribution.hardMax - distribution.hardMin);
  }
  return distribution.median;
}

export function distributionSpread(distribution: NumericDistribution): number {
  if (distribution.kind === 'normal') return distribution.standardDeviation;
  if (distribution.kind === 'uniform') return (distribution.max - distribution.min) / Math.sqrt(12);
  if (distribution.kind === 'log-normal') return distribution.sigma;
  const total = distribution.alpha + distribution.beta;
  const normalizedVariance = distribution.alpha * distribution.beta / Math.max(Number.EPSILON, total * total * (total + 1));
  return Math.sqrt(normalizedVariance) * (distribution.hardMax - distribution.hardMin);
}
