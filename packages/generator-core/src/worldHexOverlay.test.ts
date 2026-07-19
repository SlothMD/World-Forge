import { describe, expect, it } from 'vitest';
import { buildFlatWorldHexOverlay, hexCoverageForLatLonBounds } from './worldHexOverlay';

describe('flat world hex overlay', () => {
  it('defines deterministic RPG-scale hex levels without materializing every cell', () => {
    const overlay = buildFlatWorldHexOverlay(1);
    const overview = overlay.levels.find((level) => level.id === 'world-500mi');
    const world = overlay.levels.find((level) => level.id === 'world-60mi');
    const regional = overlay.levels.find((level) => level.id === 'regional-24mi');
    const local = overlay.levels.find((level) => level.id === 'local-6mi');
    const detail = overlay.levels.find((level) => level.id === 'local-1mi');

    expect(overlay.modelVersion).toBe('flat-equirectangular-hex-overlay-v1');
    expect(overlay.scheme).toBe('flat-equirectangular-pointy-odd-r');
    expect(overview?.nominalHexWidthMiles).toBe(500);
    expect(overview?.childLevelId).toBe('world-60mi');
    expect(world?.nominalHexWidthMiles).toBe(60);
    expect(world?.parentLevelId).toBe('world-500mi');
    expect(world?.dimensions.columns).toBeGreaterThan(350);
    expect(world?.dimensions.rows).toBeGreaterThan(190);
    expect(regional?.parentLevelId).toBe('world-60mi');
    expect(regional?.childLevelId).toBe('local-6mi');
    expect(local?.parentLevelId).toBe('regional-24mi');
    expect(local?.childLevelId).toBe('local-1mi');
    expect(detail?.parentLevelId).toBe('local-6mi');
    expect(detail?.childLevelId).toBeUndefined();
  });

  it('maps lat/lon bounds to coarse hex coverage ranges', () => {
    const overlay = buildFlatWorldHexOverlay(1);
    const coverage = hexCoverageForLatLonBounds(overlay, {
      minLatitude: -10,
      maxLatitude: 10,
      minLongitude: -20,
      maxLongitude: 20
    });

    expect(coverage.levelId).toBe('world-60mi');
    expect(coverage.qMin).toBeLessThan(coverage.qMax);
    expect(coverage.rMin).toBeLessThan(coverage.rMax);
    expect(coverage.wrapsLongitude).toBe(false);
  });
});
