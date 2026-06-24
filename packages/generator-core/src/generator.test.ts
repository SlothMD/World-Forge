import { describe, expect, it } from 'vitest';
import { createDefaultConfig, generateProject } from './index';
import { exportSvg, exportWforge, importWforge, projectToJson } from '@world-forge/exporters';

const seeds = [
  'earthlike-default-001',
  'dry-world-001',
  'wet-world-001',
  'cold-world-001',
  'hot-world-001',
  'high-ocean-001',
  'low-ocean-001',
  'mountain-heavy-001'
];

describe('world generation MVP invariants', () => {
  it('is deterministic for the same seed and config', () => {
    const config = createDefaultConfig('earthlike-default-001', { width: 256, height: 128 });
    const a = projectToJson(generateProject(config));
    const b = projectToJson(generateProject(config));
    expect(hashText(a)).toBe(hashText(b));
  });

  it.each(seeds)('keeps required validation true for %s', (seed) => {
    const config = createDefaultConfig(seed, { width: 256, height: 128 });
    if (seed === 'dry-world-001') config.parameterRanges.aridity = { min: 0.76, max: 0.86 };
    if (seed === 'wet-world-001') config.parameterRanges.aridity = { min: 0.14, max: 0.24 };
    if (seed === 'cold-world-001') config.parameterRanges.averageTemperatureC = { min: -4, max: 2, unit: 'C' };
    if (seed === 'hot-world-001') config.parameterRanges.averageTemperatureC = { min: 24, max: 30, unit: 'C' };
    if (seed === 'high-ocean-001') config.parameterRanges.oceanPercentage = { min: 78, max: 82, unit: '%' };
    if (seed === 'low-ocean-001') config.parameterRanges.oceanPercentage = { min: 30, max: 35, unit: '%' };

    const project = generateProject(config);
    expect(project.metrics.validation.oceanWithinTolerance).toBe(true);
    expect(project.metrics.validation.riverPathsValid).toBe(true);
    expect(project.primaryWorld.rivers.length).toBeGreaterThan(0);
    expect(project.primaryWorld.layers.biomes.length).toBe(config.outputResolution.width * config.outputResolution.height);
  });

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

function hashText(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
