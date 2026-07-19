import { describe, expect, it } from 'vitest';
import { SeededRandom } from './random';
import { sampleNumericDistribution } from './numericDistribution';

describe('numeric distributions', () => {
  it('samples deterministically for a seed', () => {
    const definition = { kind: 'normal', median: 18, standardDeviation: 3, hardMin: 4, hardMax: 60 } as const;
    const first = new SeededRandom('plate-seed');
    const second = new SeededRandom('plate-seed');
    const a = Array.from({ length: 20 }, () => sampleNumericDistribution(definition, first));
    const b = Array.from({ length: 20 }, () => sampleNumericDistribution(definition, second));
    expect(a).toEqual(b);
  });

  it('lets the distribution cluster naturally while respecting extreme hard limits', () => {
    const definition = { kind: 'normal', median: 18, standardDeviation: 3, hardMin: 4, hardMax: 60 } as const;
    const rng = new SeededRandom('plate-population');
    const samples = Array.from({ length: 4000 }, () => sampleNumericDistribution(definition, rng));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
    expect(mean).toBeGreaterThan(17.7);
    expect(mean).toBeLessThan(18.3);
    expect(Math.sqrt(variance)).toBeGreaterThan(2.7);
    expect(Math.sqrt(variance)).toBeLessThan(3.3);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...samples)).toBeLessThanOrEqual(60);
  });

  it('supports uniform, log-normal, and beta families', () => {
    const rng = new SeededRandom('distribution-families');
    const uniform = sampleNumericDistribution({ kind: 'uniform', min: 3, max: 68 }, rng);
    const logNormal = sampleNumericDistribution({ kind: 'log-normal', median: 4, sigma: 0.5, hardMin: 0.01, hardMax: 100 }, rng);
    const beta = sampleNumericDistribution({ kind: 'beta', alpha: 2, beta: 5, hardMin: 0, hardMax: 1 }, rng);
    expect(uniform).toBeGreaterThanOrEqual(3);
    expect(uniform).toBeLessThanOrEqual(68);
    expect(logNormal).toBeGreaterThan(0);
    expect(beta).toBeGreaterThanOrEqual(0);
    expect(beta).toBeLessThanOrEqual(1);
  });
});
