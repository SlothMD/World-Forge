import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/generator-core';
import { generateProjectWithNativeStages } from '@world-forge/generator-core/nativeStagePipeline';
import { cleanGameMapTheme } from '@world-forge/renderer';
import type { GenerationConfig } from '@world-forge/shared';
import { APP_VERSION } from '../appVersion';
import { buildWorldDiagnostics } from './buildWorldDiagnostics';

type ExtendedGenerationConfig = GenerationConfig & {
  seeds?: { star?: string; world?: string };
  starPresetId?: string;
  worldPresetId?: string;
};

describe('buildWorldDiagnostics', () => {
  it('keeps terrain chart shares aligned with geography summary shares', () => {
    const config = createDefaultConfig('2097826', { width: 128, height: 64 }) as ExtendedGenerationConfig;
    config.seeds = { star: '5330255', world: '2097826' };
    config.starPresetId = 'sol-like';
    config.worldPresetId = 'Earthlike';
    config.selectedValues = { oceanTolerancePercentagePoints: 5 };

    const project = generateProjectWithNativeStages(config, { appVersion: APP_VERSION });
    const diagnostics = buildWorldDiagnostics(project, { width: 48, height: 30 }, cleanGameMapTheme);
    const chart = Object.fromEntries(diagnostics.charts.terrain.map((item) => [item.label, item.value]));

    expect(chart.mountainous).toBeCloseTo(diagnostics.geography.mountainousLandShare, 6);
    expect(chart.rugged + chart.mountainous).toBeCloseTo(diagnostics.geography.ruggedOrMountainousShare, 6);
    expect(diagnostics.generation.starSeed).toBe('5330255');
    expect(diagnostics.generation.worldSeed).toBe('2097826');
    expect(diagnostics.findings.map((finding) => finding.id)).not.toContain('hex-rivers-sparse');
    expect(diagnostics.findings.map((finding) => finding.id)).not.toContain('hex-export-river-loss');
  });
});
