import { describe, expect, it } from 'vitest';
import { classifySurfaceStructureCell } from './surfaceStructure';

describe('canonical surface structure classification', () => {
  it('keeps permanent polar ice independent from elevation-driven climate lines', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: true,
      elevationAboveSeaLevel: 0.03,
      temperatureC: -18,
      slope: 0.01,
      localRelief: 0.02
    });

    expect(result.permanentIce).toBe(true);
    expect(result.elevationDrivenTreeline).toBe(false);
    expect(result.elevationDrivenSnowline).toBe(false);
  });

  it('keeps cold polar uplands out of elevation-driven snowline when sea-level climate is also cold', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: false,
      elevationAboveSeaLevel: 0.26,
      temperatureC: -4,
      slope: 0.08,
      localRelief: 0.22
    });

    expect(result.elevationDrivenTreeline).toBe(false);
    expect(result.elevationDrivenSnowline).toBe(false);
  });

  it('keeps elevation-driven snowline terrain inside the treeline mask', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: false,
      elevationAboveSeaLevel: 0.62,
      temperatureC: -5,
      slope: 0.16,
      localRelief: 0.31
    });

    expect(result.elevationDrivenSnowline).toBe(true);
    expect(result.elevationDrivenTreeline).toBe(true);
  });

  it('recognizes cold highlands above a locally warm snow line', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: false,
      elevationAboveSeaLevel: 0.34,
      temperatureC: 1,
      slope: 0.09,
      localRelief: 0.24
    });

    expect(result.elevationDrivenTreeline).toBe(true);
    expect(result.elevationDrivenSnowline).toBe(true);
  });

  it('allows high plateaus to be alpine in elevation but flat in morphology', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: false,
      elevationAboveSeaLevel: 0.58,
      temperatureC: 16,
      slope: 0.008,
      localRelief: 0.03
    });

    expect(result.elevationBand).toBe('alpine');
    expect(result.morphology).toBe('flat');
    expect(result.elevationDrivenTreeline).toBe(false);
  });

  it('allows rugged lowlands without mislabeling them as high terrain', () => {
    const result = classifySurfaceStructureCell({
      water: false,
      permanentIce: false,
      elevationAboveSeaLevel: 0.08,
      temperatureC: 14,
      slope: 0.12,
      localRelief: 0.32
    });

    expect(result.elevationBand).toBe('lowland');
    expect(result.morphology).toBe('rugged');
  });

  it('never emits snowline without treeline across representative inputs', () => {
    for (const elevationAboveSeaLevel of [0, 0.1, 0.2, 0.35, 0.5, 0.8]) {
      for (const temperatureC of [-20, -8, -3, 2, 7, 14]) {
        const result = classifySurfaceStructureCell({
          water: false,
          permanentIce: false,
          elevationAboveSeaLevel,
          temperatureC,
          slope: 0.1,
          localRelief: 0.2
        });
        if (result.elevationDrivenSnowline) expect(result.elevationDrivenTreeline).toBe(true);
      }
    }
  });
});
