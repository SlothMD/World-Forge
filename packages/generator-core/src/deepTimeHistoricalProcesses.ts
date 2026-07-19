import { buildCubedSphereTopology, clamp, cubedSphereCellForLonLat, type WorldProject } from '@world-forge/shared';

export type VolcanismSnapshot = {
  mean: number;
  activeShare: number;
  boundaryMean: number;
  interiorMean: number;
  boundaryToInteriorRatio: number;
};

export type HistoricalProcessBaseline = {
  volcanism: VolcanismSnapshot;
};

export type DeepTimeHistoricalProcessDiagnostics = {
  modelVersion: 'deep-time-historical-processes-v3';
  systemAgeGy: number;
  ageBand: 'young' | 'mature' | 'old';
  epochCount: number;
  earlyImpactIntensityShare: number;
  lateImpactIntensityShare: number;
  impactGainVolume: number;
  impactLossVolume: number;
  impactNetExcavationVolume: number;
  impactEjectaReturnRatio: number;
  impactOperationsPerGy: number;
  impactLossPerGy: number;
  impactLifetimeTargetOperations: number;
  impactLifetimeOperationRatio: number;
  tectonicGainPerGy: number;
  weatheringLossPerGy: number;
  glacialLossPerGy: number;
  coastalLossPerGy: number;
  geothermalFlux: number;
  meanPlateSpeed: number;
  volcanismBoundaryRetentionFactor: number;
  volcanismInteriorRetentionFactor: number;
  volcanismBoundaryFloor: number;
  volcanismInteriorFloor: number;
  volcanismChangedCells: number;
  volcanismIncreasedCells: number;
  volcanismDecreasedCells: number;
  volcanismUnchangedCells: number;
  preAgingVolcanism: VolcanismSnapshot;
  finalVolcanism: VolcanismSnapshot;
  volcanismMeanDelta: number;
  volcanismActiveShareDelta: number;
  volcanismBoundaryMeanDelta: number;
  volcanismInteriorMeanDelta: number;
  notes: string[];
};

type MutationProcess = { totalAmount?: number; operations?: number };
type MutationLedger = {
  tectonicGain?: MutationProcess;
  impactGain?: MutationProcess;
  impactLoss?: MutationProcess;
  weatheringLoss?: MutationProcess;
  glacialLoss?: MutationProcess;
  coastalLoss?: MutationProcess;
};

type HistoricalDeepTime = {
  epochs?: Array<{ index: number; impactIntensity: number; climateSamples: number }>;
  mutationLedger?: MutationLedger;
  historicalProcesses?: DeepTimeHistoricalProcessDiagnostics;
  notes?: string[];
};

type VolcanismEvolution = {
  boundaryRetentionFactor: number;
  interiorRetentionFactor: number;
  boundaryFloor: number;
  interiorFloor: number;
  changedCells: number;
  increasedCells: number;
  decreasedCells: number;
  unchangedCells: number;
};

function round(value: number, digits = 8): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function isBoundaryCell(cell: number, neighbors: Int32Array | Uint32Array, plates: Uint16Array | Uint32Array | Int32Array): boolean {
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor >= 0 && plates[neighbor] !== plates[cell]) return true;
  }
  return false;
}

function snapshotVolcanism(project: WorldProject): VolcanismSnapshot {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const volcanism = world.topologyLayers.volcanism;
  const plates = world.topologyLayers.plates;
  let total = 0;
  let active = 0;
  let boundaryTotal = 0;
  let boundaryCells = 0;
  let interiorTotal = 0;
  let interiorCells = 0;

  for (let cell = 0; cell < volcanism.length; cell += 1) {
    const value = Number.isFinite(volcanism[cell]) ? volcanism[cell] : 0;
    total += value;
    if (value >= 0.55) active += 1;
    if (isBoundaryCell(cell, topology.neighbors, plates)) {
      boundaryTotal += value;
      boundaryCells += 1;
    } else {
      interiorTotal += value;
      interiorCells += 1;
    }
  }

  const mean = total / Math.max(1, volcanism.length);
  const boundaryMean = boundaryTotal / Math.max(1, boundaryCells);
  const interiorMean = interiorTotal / Math.max(1, interiorCells);
  return {
    mean: round(mean),
    activeShare: round(active / Math.max(1, volcanism.length)),
    boundaryMean: round(boundaryMean),
    interiorMean: round(interiorMean),
    boundaryToInteriorRatio: round(boundaryMean / Math.max(1e-9, interiorMean))
  };
}

function projectVolcanism(project: WorldProject): void {
  const world = project.primaryWorld;
  const projectedWorld = world as typeof world & {
    layers?: { volcanism?: Float32Array };
    mapModel?: { resolution?: { width?: number; height?: number } };
  };
  const target = projectedWorld.layers?.volcanism;
  const width = projectedWorld.mapModel?.resolution?.width ?? 0;
  const height = projectedWorld.mapModel?.resolution?.height ?? 0;
  if (!target || width <= 0 || height <= 0 || target.length !== width * height) return;

  const topology = buildCubedSphereTopology(world.topology.resolution);
  const source = world.topologyLayers.volcanism;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      target[y * width + x] = source[cubedSphereCellForLonLat(topology, longitude, latitude)];
    }
  }
}

function applyVolcanismHistory(project: WorldProject): VolcanismEvolution {
  const world = project.primaryWorld as typeof project.primaryWorld & { planetaryDynamics?: { geothermalFlux?: number } };
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const volcanism = world.topologyLayers.volcanism;
  const plates = world.topologyLayers.plates;
  const ageGy = Math.max(0.05, project.selectedValues.systemAgeGy);
  const geothermal = clamp(world.planetaryDynamics?.geothermalFlux ?? 0.35, 0, 1);
  const speeds = world.plates.map((plate) => Math.hypot(plate.motionX, plate.motionY));
  const meanPlateSpeed = speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length);
  const activity = clamp(meanPlateSpeed / 6, 0, 1);

  const boundaryHalfLifeGy = 8 + geothermal * 10 + activity * 6;
  const interiorHalfLifeGy = 1.8 + geothermal * 4.5;
  const boundaryRetentionFactor = Math.exp((-Math.LN2 * ageGy) / boundaryHalfLifeGy);
  const interiorRetentionFactor = Math.exp((-Math.LN2 * ageGy) / interiorHalfLifeGy);
  const boundaryFloor = clamp(0.32 + geothermal * 0.28 + activity * 0.2, 0.3, 0.78);
  const interiorFloor = clamp(0.06 + geothermal * 0.18, 0.05, 0.26);
  let increasedCells = 0;
  let decreasedCells = 0;
  let unchangedCells = 0;

  for (let cell = 0; cell < volcanism.length; cell += 1) {
    const current = Number.isFinite(volcanism[cell]) ? volcanism[cell] : 0;
    const boundary = isBoundaryCell(cell, topology.neighbors, plates);
    const baseRetention = boundary ? boundaryRetentionFactor : interiorRetentionFactor;
    const persistentFraction = boundary ? boundaryFloor : interiorFloor;
    const highActivityResilience = boundary ? clamp((current - 0.42) / 0.58, 0, 1) * 0.68 : 0;
    const effectiveRetention = clamp(
      Math.max(baseRetention, persistentFraction) + (1 - Math.max(baseRetention, persistentFraction)) * highActivityResilience,
      0,
      1
    );
    const next = clamp(current * effectiveRetention, 0, current);
    const delta = next - current;
    if (delta > 1e-7) increasedCells += 1;
    else if (delta < -1e-7) decreasedCells += 1;
    else unchangedCells += 1;
    volcanism[cell] = next;
  }
  projectVolcanism(project);
  return {
    boundaryRetentionFactor: round(boundaryRetentionFactor),
    interiorRetentionFactor: round(interiorRetentionFactor),
    boundaryFloor: round(boundaryFloor),
    interiorFloor: round(interiorFloor),
    changedCells: increasedCells + decreasedCells,
    increasedCells,
    decreasedCells,
    unchangedCells
  };
}

export function captureHistoricalProcessBaseline(project: WorldProject): HistoricalProcessBaseline {
  return { volcanism: snapshotVolcanism(project) };
}

export function attachDeepTimeHistoricalProcessDiagnostics(
  project: WorldProject,
  baseline: HistoricalProcessBaseline
): DeepTimeHistoricalProcessDiagnostics {
  const world = project.primaryWorld as typeof project.primaryWorld & {
    planetaryDynamics?: { geothermalFlux?: number };
    deepTime?: HistoricalDeepTime;
  };
  const deepTime = world.deepTime ?? {};
  const ledger = deepTime.mutationLedger ?? {};
  const epochs = deepTime.epochs ?? [];
  const ageGy = Math.max(0.001, project.selectedValues.systemAgeGy);

  let earlyImpact = 0;
  let lateImpact = 0;
  for (const epoch of epochs) {
    const weighted = Math.max(0, epoch.impactIntensity) * Math.max(1, epoch.climateSamples);
    if (epoch.index < Math.ceil(epochs.length / 2)) earlyImpact += weighted;
    else lateImpact += weighted;
  }
  const totalImpactIntensity = earlyImpact + lateImpact;
  const impactGain = ledger.impactGain?.totalAmount ?? 0;
  const impactLoss = ledger.impactLoss?.totalAmount ?? 0;
  const impactOperations = (ledger.impactGain?.operations ?? 0) + (ledger.impactLoss?.operations ?? 0);
  const impactLifetimeTargetOperations = Math.max(25, Math.round(69 * ageGy));
  const volcanismEvolution = applyVolcanismHistory(project);
  const finalVolcanism = snapshotVolcanism(project);
  const speeds = world.plates.map((plate) => Math.hypot(plate.motionX, plate.motionY));
  const meanPlateSpeed = speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length);
  const diagnostics: DeepTimeHistoricalProcessDiagnostics = {
    modelVersion: 'deep-time-historical-processes-v3',
    systemAgeGy: round(ageGy, 4),
    ageBand: ageGy < 2.5 ? 'young' : ageGy < 6.5 ? 'mature' : 'old',
    epochCount: epochs.length,
    earlyImpactIntensityShare: round(earlyImpact / Math.max(1e-9, totalImpactIntensity)),
    lateImpactIntensityShare: round(lateImpact / Math.max(1e-9, totalImpactIntensity)),
    impactGainVolume: round(impactGain),
    impactLossVolume: round(impactLoss),
    impactNetExcavationVolume: round(Math.max(0, impactLoss - impactGain)),
    impactEjectaReturnRatio: round(impactGain / Math.max(1e-9, impactLoss)),
    impactOperationsPerGy: round(impactOperations / ageGy),
    impactLossPerGy: round(impactLoss / ageGy),
    impactLifetimeTargetOperations,
    impactLifetimeOperationRatio: round(impactOperations / Math.max(1, impactLifetimeTargetOperations)),
    tectonicGainPerGy: round((ledger.tectonicGain?.totalAmount ?? 0) / ageGy),
    weatheringLossPerGy: round((ledger.weatheringLoss?.totalAmount ?? 0) / ageGy),
    glacialLossPerGy: round((ledger.glacialLoss?.totalAmount ?? 0) / ageGy),
    coastalLossPerGy: round((ledger.coastalLoss?.totalAmount ?? 0) / ageGy),
    geothermalFlux: round(world.planetaryDynamics?.geothermalFlux ?? 0),
    meanPlateSpeed: round(meanPlateSpeed),
    volcanismBoundaryRetentionFactor: volcanismEvolution.boundaryRetentionFactor,
    volcanismInteriorRetentionFactor: volcanismEvolution.interiorRetentionFactor,
    volcanismBoundaryFloor: volcanismEvolution.boundaryFloor,
    volcanismInteriorFloor: volcanismEvolution.interiorFloor,
    volcanismChangedCells: volcanismEvolution.changedCells,
    volcanismIncreasedCells: volcanismEvolution.increasedCells,
    volcanismDecreasedCells: volcanismEvolution.decreasedCells,
    volcanismUnchangedCells: volcanismEvolution.unchangedCells,
    preAgingVolcanism: baseline.volcanism,
    finalVolcanism,
    volcanismMeanDelta: round(finalVolcanism.mean - baseline.volcanism.mean),
    volcanismActiveShareDelta: round(finalVolcanism.activeShare - baseline.volcanism.activeShare),
    volcanismBoundaryMeanDelta: round(finalVolcanism.boundaryMean - baseline.volcanism.boundaryMean),
    volcanismInteriorMeanDelta: round(finalVolcanism.interiorMean - baseline.volcanism.interiorMean),
    notes: [
      'Impact intensity shares are weighted by the number of climate samples executed in each epoch.',
      'The lifetime impact target exposes the gap between current fixed-count bombardment and an age-scaled target without silently changing crater frequency in this slice.',
      'Volcanism is decay-only: no cell may be raised above its pre-aging value.',
      'Boundary hotspots receive intensity-sensitive resilience so concentrated active pockets can persist while quiet cells continue to cool.',
      'The boundary and interior floor fields are retained fractions, not absolute volcanism minima.',
      'Topology volcanism is authoritative; a projected volcanism raster is updated only when that optional layer exists.'
    ]
  };

  deepTime.historicalProcesses = diagnostics;
  deepTime.notes?.push('Decay-only volcanic persistence, hotspot resilience, and increased/decreased/unchanged cell counts are retained in deepTime.historicalProcesses.');
  world.deepTime = deepTime;
  return diagnostics;
}
