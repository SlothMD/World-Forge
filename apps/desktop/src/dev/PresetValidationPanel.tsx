import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Download, FlaskConical, Square, X } from 'lucide-react';
import JSZip from 'jszip';
import { loadWorkspaceSettings } from '../sync';
import type { PresetTestMode, PresetTestResult, PresetTestStatus, PresetValidationReport } from './presetValidation';
import {
  cancelPresetValidationRun,
  getPresetValidationRunSnapshot,
  startPresetValidationRun,
  subscribePresetValidationRun
} from './presetValidationRunStore';

type StructuredFinding = {
  findingId: string;
  scope: 'case' | 'aggregate';
  severity: 'warning' | 'error';
  ownerNode: string;
  message: string;
  actual: number | string | null;
  expected: string | null;
  sourceCaseId?: string;
};

type CaseCounts = Record<PresetTestStatus, number>;

const STEP_PREFIXES: Array<[string, string]> = [
  ['aging', 'deep-time-aging'], ['finalWater', 'water'], ['presentClimate', 'climate'],
  ['hydrology', 'hydrology'], ['biomeClimateRegime', 'biomes'], ['biome', 'biomes'], ['terrain', 'terrain'],
  ['plate', 'tectonics'], ['craton', 'tectonics'], ['drift', 'tectonics'],
  ['impact', 'deep-time-aging'], ['star', 'system-orbit'], ['stellar', 'system-orbit'],
  ['orbital', 'system-orbit'], ['ocean', 'water'], ['river', 'hydrology']
];

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function reportFilenameTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

function countCases(report: PresetValidationReport): CaseCounts {
  const counts: CaseCounts = { pass: 0, warning: 0, fail: 0, error: 0 };
  for (const result of report.results) counts[result.status] += 1;
  return counts;
}

function reportMarkdown(report: PresetValidationReport): string {
  const counts = countCases(report);
  const aggregateWarningCount = report.aggregateFindings?.length ?? 0;
  const lines = [
    '# Preset Validation Report', '',
    `- App version: ${report.appVersion}`,
    `- Generated: ${report.generatedAt}`,
    `- Matrix: ${report.mode}`,
    '- Resolution: 512 x 256; topology 64',
    `- Cases: ${report.totalCases}`,
    `- Passed cases: ${counts.pass}`,
    `- Warning cases: ${counts.warning}`,
    `- Failed cases: ${counts.fail}`,
    `- Error cases: ${counts.error}`,
    `- Aggregate warnings: ${aggregateWarningCount}`
  ];
  if (report.aggregates) {
    lines.push('', '## Aggregate diagnostics', '');
    for (const [key, value] of Object.entries(report.aggregates)) lines.push(`- ${key}: ${typeof value === 'number' ? Number(value.toFixed(4)) : value}`);
  }
  if (report.aggregateFindings?.length) {
    lines.push('', '## Aggregate findings', '');
    for (const finding of report.aggregateFindings) lines.push(`- ${finding}`);
  }
  lines.push('', '| Seed | Star | World | Result | Key findings |', '|---|---|---|---|---|');
  for (const result of report.results) lines.push(`| ${result.testCase.seed} | ${result.testCase.starPresetId} | ${result.testCase.worldPresetId} | ${result.status} | ${result.findings.join('; ') || 'None'} |`);
  return lines.join('\n');
}

function metricStep(key: string): string {
  return STEP_PREFIXES.find(([prefix]) => key.startsWith(prefix))?.[1] ?? 'cross-cutting';
}

function decomposeFingerprint(fingerprint: PresetTestResult['fingerprint']): Record<string, Record<string, unknown>> {
  const steps: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(fingerprint ?? {})) (steps[metricStep(key)] ??= {})[key] = value;
  return steps;
}

function inferOwnerNode(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('mountain') || lower.includes('relief') || lower.includes('terrain') || lower.includes('basin')) return 'terrain';
  if (lower.includes('river') || lower.includes('hydrolog') || lower.includes('headwater')) return 'hydrology';
  if (lower.includes('ocean') || lower.includes('water') || lower.includes('shelf') || lower.includes('coast')) return 'water';
  if (lower.includes('plate') || lower.includes('subduction') || lower.includes('craton') || lower.includes('drift')) return 'tectonics';
  if (lower.includes('impact') || lower.includes('aging')) return 'deep-time-aging';
  if (lower.includes('rain') || lower.includes('climate') || lower.includes('temperature') || lower.includes('wetness')) return 'climate';
  if (lower.includes('star') || lower.includes('orbit')) return 'system-orbit';
  if (lower.includes('biome')) return 'biomes';
  return 'validation';
}

function structureFinding(message: string, scope: 'case' | 'aggregate', severity: 'warning' | 'error', sourceCaseId?: string): StructuredFinding {
  return {
    findingId: slug(message).slice(0, 96), scope, severity,
    ownerNode: inferOwnerNode(message), message, actual: null, expected: null,
    ...(sourceCaseId ? { sourceCaseId } : {})
  };
}

function splitAggregates(aggregates: Record<string, number | string>): Record<string, Record<string, number | string>> {
  const files: Record<string, Record<string, number | string>> = { overall: {} };
  const prefixes = ['earthlike', 'habitableWorld', 'waterworld', 'archipelago', 'desertWorld', 'pangea', 'randomWorld'];
  for (const [key, value] of Object.entries(aggregates)) {
    const prefix = prefixes.find((candidate) => key.startsWith(candidate) && /[A-Z]/.test(key[candidate.length] ?? ''));
    if (!prefix) files.overall[key] = value;
    else (files[slug(prefix)] ??= {})[key.slice(prefix.length).replace(/^./, (letter) => letter.toLowerCase())] = value;
  }
  return files;
}

function formatPercent(value: number | string | undefined): string {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

async function buildReportArchive(report: PresetValidationReport): Promise<Blob> {
  const zip = new JSZip();
  const findings: StructuredFinding[] = [];
  const caseFiles: Array<{ caseId: string; path: string; status: string }> = [];
  const caseCounts = countCases(report);

  for (const result of report.results) {
    const caseFindings = result.findings.map((message) => structureFinding(message, 'case', result.status === 'fail' || result.status === 'error' ? 'error' : 'warning', result.testCase.id));
    findings.push(...caseFindings);
    const steps = decomposeFingerprint(result.fingerprint);
    const path = `cases/${slug(result.testCase.seed)}/${slug(result.testCase.starPresetId)}--${slug(result.testCase.worldPresetId)}.json`;
    zip.file(path, JSON.stringify({
      schemaVersion: 1, case: result.testCase, status: result.status, elapsedMs: result.elapsedMs,
      execution: {
        pipelineId: 'native-stage-pipeline', pipelineVersion: report.appVersion,
        ruleset: { starPresetId: result.testCase.starPresetId, worldPresetId: result.testCase.worldPresetId, source: 'core', contentHash: null },
        retries: [], stepOrder: Object.keys(steps),
        steps: Object.fromEntries(Object.entries(steps).map(([stepId, metrics]) => [stepId, {
          stepId, source: 'core', scriptId: stepId, scriptVersion: report.appVersion,
          contentHash: null, status: result.status === 'error' ? 'error' : 'complete', durationMs: null, metrics
        }]))
      },
      findings: caseFindings, error: result.error ?? null
    }, null, 2));
    caseFiles.push({ caseId: result.testCase.id, path, status: result.status });
  }

  for (const message of report.aggregateFindings ?? []) findings.push(structureFinding(message, 'aggregate', 'warning'));
  const aggregateFiles = splitAggregates(report.aggregates ?? {});
  for (const [name, values] of Object.entries(aggregateFiles)) zip.file(`aggregates/${name}.json`, JSON.stringify(values, null, 2));

  const summary = {
    schemaVersion: 2,
    reportVersion: report.reportVersion,
    generatedAt: report.generatedAt,
    appVersion: report.appVersion,
    mode: report.mode,
    resolution: report.resolution,
    topologyResolution: report.topologyResolution,
    seeds: report.seeds,
    totalCases: report.totalCases,
    caseCounts,
    aggregateWarningCount: report.aggregateFindings?.length ?? 0,
    aggregateFindings: findings.filter((finding) => finding.scope === 'aggregate'),
    biomeFocus: {
      workPlan: 'refs/handoffs/biomes-features-validation-work-plan.md',
      phase: 'Phase 1: Biome Diagnostic Validation',
      guardrail: 'Route upstream physical-model defects to the owning node. Do not repair them in biome classification.'
    },
    files: {
      manifest: 'manifest.json', findings: 'findings.json', report: 'report.md',
      aggregates: Object.keys(aggregateFiles).map((name) => `aggregates/${name}.json`), cases: caseFiles
    }
  };

  zip.file('manifest.json', JSON.stringify({
    schemaVersion: 2,
    packageType: 'parchment-worlds-preset-validation',
    generatedAt: report.generatedAt,
    appVersion: report.appVersion,
    entrypoints: { summary: 'summary.json', humanReport: 'report.md', findings: 'findings.json' },
    decomposition: { aggregateFiles: Object.keys(aggregateFiles).length, caseFiles: caseFiles.length, findingCount: findings.length }
  }, null, 2));
  zip.file('summary.json', JSON.stringify(summary, null, 2));
  zip.file('findings.json', JSON.stringify({ schemaVersion: 2, findings }, null, 2));
  zip.file('report.md', reportMarkdown(report));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function downloadReportArchive(report: PresetValidationReport): Promise<void> {
  const blob = await buildReportArchive(report);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `preset-validation-${reportFilenameTimestamp(report.generatedAt)}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PresetValidationPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<PresetTestMode>('short');
  const [downloading, setDownloading] = useState(false);
  const run = useSyncExternalStore(subscribePresetValidationRun, getPresetValidationRunSnapshot, getPresetValidationRunSnapshot);
  const findings = useMemo(() => run.report?.results.filter((result) => result.status !== 'pass').slice(0, 20) ?? [], [run.report]);
  const caseCounts = useMemo(() => run.report ? countCases(run.report) : null, [run.report]);
  const aggregateFindings = run.report?.aggregateFindings ?? [];

  const start = () => {
    const baseConfig = loadWorkspaceSettings().config;
    if (baseConfig) startPresetValidationRun(mode, baseConfig);
  };

  const download = async () => {
    if (!run.report || downloading) return;
    setDownloading(true);
    try { await downloadReportArchive(run.report); }
    finally { setDownloading(false); }
  };

  return <div className="preset-validation-panel" role="dialog" aria-modal="false" aria-labelledby="preset-validation-heading">
    <div className="preset-validation-header">
      <div><FlaskConical size={18} /><h3 id="preset-validation-heading">Preset Validation</h3></div>
      <button type="button" onClick={onClose} aria-label="Close preset validation"><X size={17} /></button>
    </div>
    <p>Runs fixed deterministic seeds at 512 x 256 without replacing or saving the current world.</p>
    <div className="preset-validation-controls">
      <label>Matrix
        <select value={mode} onChange={(event) => setMode(event.target.value as PresetTestMode)} disabled={run.running}>
          <option value="short">Short matrix - 10 seeds - 80 cases</option>
          <option value="full">Full matrix - 10 seeds - 140 cases</option>
          <option value="deep">Deep full walk - 100 seeds - 1,400 cases</option>
        </select>
      </label>
      {!run.running ? <button type="button" onClick={start}><FlaskConical size={16} />Run tests</button> : <button type="button" onClick={cancelPresetValidationRun}><Square size={15} />Cancel</button>}
    </div>
    {mode === 'deep' && !run.running && <p className="generator-field-help">Designed for unattended or overnight runs. The ZIP splits case data into smaller JSON files.</p>}
    {(run.running || run.total > 0) && <div className="preset-validation-progress">
      <progress value={run.completed} max={Math.max(1, run.total)} /><span>{run.completed} / {run.total}</span><small>{run.currentId}</small>
    </div>}
    {run.message && <div className="validation">{run.message}</div>}
    {run.report && caseCounts && <div className="preset-validation-report">
      <div className="preset-validation-summary">
        <strong>{caseCounts.pass} passed</strong>
        <span>{caseCounts.warning} warning cases</span>
        <span>{caseCounts.fail} failed</span>
        <span>{caseCounts.error} errors</span>
        <span>{aggregateFindings.length} aggregate warnings</span>
      </div>
      {run.report.aggregates && <div className="preset-validation-summary" aria-label="Aggregate diagnostics">
        <span>F/G/K: {Math.round(Number(run.report.aggregates.earthlikeFriendlyFShare ?? 0) * 100)}% / {Math.round(Number(run.report.aggregates.earthlikeFriendlyGShare ?? 0) * 100)}% / {Math.round(Number(run.report.aggregates.earthlikeFriendlyKShare ?? 0) * 100)}%</span>
        <span>Unique crust fingerprints: {Math.round(Number(run.report.aggregates.uniqueCrustFingerprintShareBySeedAndWorld ?? 0) * 100)}%</span>
        <span>Biome isolated P95: {Math.round(Number(run.report.aggregates.biomeIsolatedCellShareP95 ?? 0) * 100)}%</span>
        <span>Biome tiny patches P95: {Math.round(Number(run.report.aggregates.biomeTinyPatchCellShareP95 ?? 0) * 100)}%</span>
        <span>Earthlike climate: {Number(run.report.aggregates.earthlikePresentClimateMedianTemperatureMedian ?? 0).toFixed(1)} C median</span>
      </div>}
      {run.report.aggregates && <div className="preset-validation-summary" aria-label="Climate regime aggregate summary">
        <span>Climate regimes: {formatPercent(run.report.aggregates.biomeClimateRegimeShareMaritimeMedian)} maritime | {formatPercent(run.report.aggregates.biomeClimateRegimeShareContinentalMedian)} continental | {formatPercent(run.report.aggregates.biomeClimateRegimeShareMonsoonalMedian)} monsoonal | {formatPercent(run.report.aggregates.biomeClimateRegimeShareAridSeasonalMedian)} arid seasonal | {formatPercent(run.report.aggregates.biomeClimateRegimeShareStableTropicalMedian)} stable tropical</span>
      </div>}
      <div className="preset-validation-downloads"><button type="button" onClick={download} disabled={downloading}><Download size={15} />{downloading ? 'Packaging...' : 'Download ZIP'}</button></div>
      {aggregateFindings.length > 0 && <div className="preset-validation-findings" aria-label="Aggregate findings">
        {aggregateFindings.map((finding) => <div key={finding} className="preset-validation-finding warning"><strong>Aggregate</strong><span>{finding}</span></div>)}
      </div>}
      <div className="preset-validation-findings">
        {findings.length ? findings.map((result) => <div key={result.testCase.id} className={`preset-validation-finding ${result.status}`}>
          <strong>{result.testCase.seed} - {result.testCase.starPresetId} - {result.testCase.worldPresetId}</strong><span>{result.findings.join(' ') || result.error}</span>
        </div>) : <p>No warning, failed, or error cases.</p>}
        {(caseCounts.warning + caseCounts.fail + caseCounts.error) > findings.length && <small>Showing the first 20 non-pass cases. Download the ZIP for all cases.</small>}
      </div>
    </div>}
  </div>;
}
