import { createDefaultConfig, generateProject } from '../packages/generator-core/src/index';

type Summary = {
  resolution: string;
  samples: number;
  averageMs: number;
  averageIce: number;
  averageRivers: number;
  averageOcean: number;
  phases: Array<{ name: string; averageMs: number }>;
};

const seeds = ['1001001', '2002002', '3003003'];
const resolutions = [
  { width: 256, height: 128 },
  { width: 512, height: 256 },
  { width: 1024, height: 512 }
];

const summaries = resolutions.map(runResolution);

for (const summary of summaries) {
  console.log(`\n${summary.resolution} (${summary.samples} samples)`);
  console.log(`  avg total: ${summary.averageMs.toFixed(1)} ms`);
  console.log(`  avg ocean: ${summary.averageOcean.toFixed(1)}%`);
  console.log(`  avg ice: ${summary.averageIce.toFixed(1)}%`);
  console.log(`  avg rivers: ${summary.averageRivers.toFixed(1)}`);
  for (const phase of summary.phases.slice(0, 10)) {
    console.log(`  ${phase.name.padEnd(25)} ${phase.averageMs.toFixed(1)} ms`);
  }
}

function runResolution(resolution: { width: number; height: number }): Summary {
  const totals: number[] = [];
  const phaseTotals = new Map<string, number>();
  let ocean = 0;
  let ice = 0;
  let rivers = 0;

  for (const seed of seeds) {
    const config = createDefaultConfig(seed, resolution);
    const project = generateProject(config);
    totals.push(project.diagnostics?.totalMs ?? 0);
    ocean += project.metrics.oceanPercentage;
    ice += project.metrics.icePercentage;
    rivers += project.metrics.riverCount;
    for (const phase of project.diagnostics?.phases ?? []) {
      phaseTotals.set(phase.name, (phaseTotals.get(phase.name) ?? 0) + phase.ms);
    }
  }

  return {
    resolution: `${resolution.width}x${resolution.height}`,
    samples: seeds.length,
    averageMs: average(totals),
    averageIce: ice / seeds.length,
    averageRivers: rivers / seeds.length,
    averageOcean: ocean / seeds.length,
    phases: Array.from(phaseTotals, ([name, total]) => ({ name, averageMs: total / seeds.length })).sort((a, b) => b.averageMs - a.averageMs)
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
