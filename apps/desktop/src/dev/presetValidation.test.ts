import { describe, expect, it } from 'vitest';
import { buildTestCases, deepReferenceSeeds, referenceSeeds, validationWorldPresets } from './presetValidation';

describe('preset validation matrices', () => {
  it('keeps the quick reference seed set stable', () => {
    expect(referenceSeeds).toHaveLength(10);
    expect(referenceSeeds[0]).toBe('1000997');
    expect(referenceSeeds[9]).toBe('1001006');
  });

  it('builds the short and full matrices at their expected sizes', () => {
    expect(buildTestCases('short')).toHaveLength(80);
    expect(buildTestCases('full')).toHaveLength(140);
  });

  it('builds a 100-seed full deep walk', () => {
    const cases = buildTestCases('deep');
    expect(deepReferenceSeeds).toHaveLength(100);
    expect(cases).toHaveLength(1400);
    expect(new Set(cases.map((item) => item.seed)).size).toBe(100);
    expect(new Set(cases.map((item) => item.worldPresetId))).toEqual(new Set(Object.keys(validationWorldPresets)));
  });

  it('keeps a stable Earthlike baseline for every deep seed', () => {
    const cases = buildTestCases('deep');
    for (const seed of deepReferenceSeeds) {
      const baselineId = `${seed}:sol-like:Earthlike`;
      expect(cases.some((item) => item.id === baselineId && item.baselineId === baselineId)).toBe(true);
    }
  });
});
