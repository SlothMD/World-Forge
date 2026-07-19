import { describe, expect, it } from 'vitest';
import { createDefaultConfig, generateProject } from './index';
import { exportHexGridSvg, exportHexTileMapJson, exportSvg, exportVttGridSvg, exportVttMetadata, exportWforge, generateHexTileMap, importWforge, projectToJson } from '@world-forge/exporters';
import { hexTileMapPresets } from '../../shared/src/index';

describe('world export integrations', () => {
  it('exports structured JSON and simplified SVG', () => {
    const project = generateProject(createDefaultConfig('export-smoke-001', { width: 256, height: 128 }));
    const json = projectToJson(project);
    const parsed = JSON.parse(json);
    expect(parsed.seed).toBe('export-smoke-001');
    expect(parsed.primaryWorld.layers.length).toBeGreaterThan(5);

    const svg = exportSvg(project);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Simplified SVG export');
  });

  it('exports a configurable hex tile map derived from topology facts', () => {
    const project = generateProject(createDefaultConfig('hex-tile-export-001', { width: 128, height: 64 }));
    const tileMap = generateHexTileMap(project, { width: 18, height: 10, enabledFeatures: ['minor-river', 'navigable-river', 'wet'] });
    const json = JSON.parse(exportHexTileMapJson(project, { width: 18, height: 10, enabledFeatures: ['minor-river', 'navigable-river', 'wet'] }));
    const svg = exportHexGridSvg(project, { width: 18, height: 10 });

    expect(tileMap.format).toBe('world-forge-hex-tile-map');
    expect(tileMap.profile.id).toBe('civ7-style-default');
    expect(tileMap.config.classificationRules?.biomeRules.length).toBeGreaterThan(0);
    expect(tileMap.tiles.length).toBe(180);
    expect(tileMap.tiles.every((tile) => tile.topologyCell >= 0 && tile.terrainType.length > 0)).toBe(true);
    expect(tileMap.tiles.every((tile) => Array.isArray(tile.minorRiverEdges) && typeof tile.navigableRiverCenter === 'boolean' && typeof tile.riverStrength === 'number')).toBe(true);
    expect(tileMap.tiles.every((tile) => Array.isArray(tile.featureDetails) && Array.isArray(tile.navigableRiverEdges) && Array.isArray(tile.ridgeEdges))).toBe(true);
    expect(tileMap.tiles.every((tile) => tile.features.every((feature) => feature === 'minor-river' || feature === 'navigable-river' || feature === 'wet'))).toBe(true);
    expect(json.tiles.length).toBe(tileMap.tiles.length);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<title>');
    expect(svg).toContain('Features:');
    expect(svg).toContain('Elevation:');
    expect(svg).toContain('Minor river edges:');
    expect(svg).toContain('Navigable river edges:');
    expect(svg).toContain('Ridges:');
  });

  it('uses verified Civ 7-style map size presets', () => {
    expect(hexTileMapPresets.map((preset) => [preset.label, preset.width, preset.height])).toEqual([
      ['Civ 7 Tiny', 60, 38],
      ['Civ 7 Small', 74, 46],
      ['Civ 7 Standard', 84, 54],
      ['Civ 7 Large', 96, 60],
      ['Civ 7 Huge', 106, 66]
    ]);
  });

  it('aligns same-row hex SVG polygons without horizontal overlap', () => {
    const project = generateProject(createDefaultConfig('hex-alignment-001', { width: 128, height: 64 }));
    const svg = exportHexGridSvg(project, { width: 4, height: 3 });
    const polygons = [...svg.matchAll(/<polygon points="([^"]+)" fill="[^"]+" stroke="#1c292b"/g)].map((match) => polygonBounds(match[1]));

    expect(polygons.length).toBe(12);
    expect(Math.abs(polygons[1].minX - polygons[0].maxX)).toBeLessThan(0.01);
    expect(Math.abs(polygons[2].minX - polygons[1].maxX)).toBeLessThan(0.01);
  });

  it('keeps hex tile fill colors tied to biome while overlaying terrain symbols', () => {
    const project = generateProject(createDefaultConfig('2883711', { width: 256, height: 128 }));
    const tileMap = generateHexTileMap(project, { width: 60, height: 38 });
    const svg = exportHexGridSvg(project, { width: 60, height: 38 });

    expect(project.primaryWorld.rivers.every((river) => river.topologyPath?.length)).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.biome === 'desert' && (tile.morphology === 'rough' || tile.morphology === 'mountainous'))).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.biome === 'tundra' && (tile.morphology === 'rough' || tile.morphology === 'mountainous'))).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.biome === 'marine' && tile.morphology === 'lake')).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.biome === 'plains')).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.biome === 'tropical')).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.ridgeEdges.length > 0)).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.navigableRiverEdges.length > 0)).toBe(true);
    expect(tileMap.tiles.every((tile) => tile.morphology !== 'lake' || (!tile.minorRiverEdges.length && !tile.navigableRiverEdges.length && !tile.navigableRiverCenter))).toBe(true);
    expect(tileMap.tiles.every((tile) => !tile.navigableRiverCenter || tile.navigableRiverEdges.length > 0)).toBe(true);
    expect(tileMap.tiles.some((tile) => tile.features.includes('ice') || tile.featureDetails.includes('ice'))).toBe(true);
    expect(svg).toContain('fill="#e3c76b"');
    expect(svg).toContain('fill="#c8d6c7"');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('Minor river edges:');
    expect(svg).toMatch(/<path d="M [^"]+" fill="none" stroke="#2c7e98"/);
    const navigableStrokeWidths = [...svg.matchAll(/stroke="#2f7f9c" stroke-width="([0-9.]+)"/g)].map((match) => Number(match[1]));
    expect(Math.max(...navigableStrokeWidths)).toBeGreaterThan(2);
  });

  it('exports VTT-agnostic metadata and optional hex grid overlay', () => {
    const project = generateProject(createDefaultConfig('vtt-export-001', { width: 128, height: 64 }));
    const metadata = JSON.parse(exportVttMetadata(project, { width: 1024, height: 512, grid: { kind: 'hex-pointy', hexSizeMiles: 1200 } }));
    const svg = exportVttGridSvg(project, { width: 1024, height: 512, grid: { kind: 'hex-pointy', hexSizeMiles: 1200 } });

    expect(metadata.format).toBe('world-forge-vtt-export');
    expect(metadata.image.width).toBe(1024);
    expect(metadata.grid.kind).toBe('hex-pointy');
    expect(metadata.grid.hexSizeMiles).toBe(1200);
    expect(metadata.grid.hexSizePx).toBeGreaterThan(8);
    expect(metadata.image.gridFile).toContain('vtt-map-grid.png');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<polygon');
  });

  it('generates authoritative volcanism and exports visible volcano feature details', () => {
    const project = generateProject(createDefaultConfig('volcanism-001', { width: 256, height: 128 }));
    expect(project.primaryWorld.topologyLayers.volcanism.some((value) => value > 0.72)).toBe(true);
    const tileMap = generateHexTileMap(project, { width: 84, height: 54 });
    const volcanoTiles = tileMap.tiles.filter((tile) => tile.featureDetails.includes('volcano')).length;
    const highlandTiles = tileMap.tiles.filter((tile) => tile.morphology === 'mountainous' || tile.morphology === 'rough').length;
    expect(volcanoTiles).toBeGreaterThan(0);
    expect(volcanoTiles).toBeLessThan(Math.max(12, highlandTiles * 0.06));
  });

  it('roundtrips a .wforge project package', async () => {
    const project = generateProject(createDefaultConfig('package-smoke-001', { width: 128, height: 64 }));
    const blob = await exportWforge(project);
    const file = new File([blob], 'package-smoke-001.wforge');
    const loaded = await importWforge(file);
    expect(loaded.seed).toBe(project.seed);
    expect(loaded.primaryWorld.layers.elevation.length).toBe(project.primaryWorld.layers.elevation.length);
    expect(loaded.metrics.validation.oceanWithinTolerance).toBe(true);
  });
});

function polygonBounds(points: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const coordinates = points.split(' ').map((point) => point.split(',').map(Number));
  return {
    minX: Math.min(...coordinates.map(([x]) => x)),
    maxX: Math.max(...coordinates.map(([x]) => x)),
    minY: Math.min(...coordinates.map(([, y]) => y)),
    maxY: Math.max(...coordinates.map(([, y]) => y))
  };
}
