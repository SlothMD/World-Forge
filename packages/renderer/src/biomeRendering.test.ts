import { describe, expect, it } from 'vitest';
import { landElevationPercentileRange, naturalSnowTintStrength } from './index';

describe('biome rendering elevation and snow semantics', () => {
  it('normalizes natural land elevation without ocean cells', () => {
    const elevation = new Float32Array([-0.8, -0.4, 0.1, 0.2, 0.4]);
    const water = new Uint8Array([1, 1, 0, 0, 0]);
    const [low, high] = landElevationPercentileRange(elevation, water, 0, 1);

    expect(low).toBeCloseTo(0.1, 5);
    expect(high).toBeCloseTo(0.4, 5);
  });

  it('does not whiten warm highlands as snow', () => {
    expect(naturalSnowTintStrength({
      ice: false,
      temperatureC: 18,
      landElevation01: 0.98,
      altitudeAboveSeaLevel: 0.62,
      slope: 0.34
    })).toBe(0);
  });

  it('allows cold exposed highlands to carry bounded snow tone', () => {
    const strength = naturalSnowTintStrength({
      ice: false,
      temperatureC: -8,
      landElevation01: 0.96,
      altitudeAboveSeaLevel: 0.58,
      slope: 0.31
    });

    expect(strength).toBeGreaterThan(0.9);
    expect(strength).toBeLessThanOrEqual(1);
  });

  it('keeps decorative snowline display below permanent ice strength', () => {
    const displayTint = naturalSnowTintStrength({
      ice: false,
      temperatureC: -8,
      landElevation01: 0.96,
      altitudeAboveSeaLevel: 0.58,
      slope: 0.31
    }) * 0.28;

    expect(displayTint).toBeGreaterThan(0.2);
    expect(displayTint).toBeLessThan(0.35);
  });

  it('keeps the explicit ice mask authoritative', () => {
    expect(naturalSnowTintStrength({
      ice: true,
      temperatureC: 20,
      landElevation01: 0.1,
      altitudeAboveSeaLevel: 0.01,
      slope: 0
    })).toBe(1);
  });
});
