import { buildCubedSphereTopology, type WorldProject } from '@world-forge/shared';
import type { DeepTimeProject } from './deepTimePipeline';

export type DeepTimeStageIsolationBaseline = {
  initialSeaLevel: number;
  initialWater: Uint8Array;
};

export type WaterMorphologySummary = {
  waterCellShare: number;
  coastlineCellShare: number;
  landmassCount: number;
  largestLandmassShare: number;
};

export type DeepTimeStageIsolationDiagnostics = {
  modelVersion: 'deep-time-stage-isolation-v1';
  initialSeaLevel: number;
  finalSeaLevel: number;
  seaLevelDelta: number;
  beforeAging: WaterMorphologySummary;
  afterAgingBeforeFinalWater: WaterMorphologySummary;
  afterFinalWater: WaterMorphologySummary;
  agingWaterChangedCells: number;
  reconciliationWaterChangedCells: number;
  agingWaterCellShareDelta: number;
  reconciliationWaterCellShareDelta: number;
  agingCoastlineCellShareDelta: number;
  reconciliationCoastlineCellShareDelta: number;
  agingLandmassCountDelta: number;
  reconciliationLandmassCountDelta: number;
  agingLargestLandmassShareDelta: number;
  reconciliationLargestLandmassShareDelta: number;
};

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeWater(project: WorldProject, water: Uint8Array): WaterMorphologySummary {
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  const total = Math.max(1, topology.cellCount);
  let waterCells = 0;
  let coastlineCells = 0;
  for (let cell = 0; cell < total; cell += 1) {
    if (water[cell]) waterCells += 1;
    let coastal = false;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor >= 0 && water[neighbor] !== water[cell]) coastal = true;
    }
    if (coastal) coastlineCells += 1;
  }

  const visited = new Uint8Array(total);
  const components: number[] = [];
  let landCells = 0;
  for (let start = 0; start < total; start += 1) {
    if (water[start]) continue;
    landCells += 1;
    if (visited[start]) continue;
    visited[start] = 1;
    const queue = [start];
    let size = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const cell = queue[cursor];
      size += 1;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || water[neighbor] || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    components.push(size);
  }

  return {
    waterCellShare: round(waterCells / total),
    coastlineCellShare: round(coastlineCells / total),
    landmassCount: components.length,
    largestLandmassShare: round(Math.max(0, ...components) / Math.max(1, landCells))
  };
}

function changedCells(a: Uint8Array, b: Uint8Array): number {
  let changed = 0;
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index += 1) if (a[index] !== b[index]) changed += 1;
  return changed;
}

export function captureDeepTimeStageIsolationBaseline(project: WorldProject): DeepTimeStageIsolationBaseline {
  return {
    initialSeaLevel: project.primaryWorld.seaLevel,
    initialWater: new Uint8Array(project.primaryWorld.topologyLayers.water)
  };
}

export function attachDeepTimeStageIsolationDiagnostics(
  project: DeepTimeProject,
  baseline: DeepTimeStageIsolationBaseline
): DeepTimeStageIsolationDiagnostics {
  const elevation = project.primaryWorld.topologyLayers.elevation;
  const finalWater = project.primaryWorld.topologyLayers.water;
  const preFinalWater = new Uint8Array(elevation.length);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    preFinalWater[cell] = elevation[cell] <= baseline.initialSeaLevel ? 1 : 0;
  }

  const beforeAging = summarizeWater(project, baseline.initialWater);
  const afterAgingBeforeFinalWater = summarizeWater(project, preFinalWater);
  const afterFinalWater = summarizeWater(project, finalWater);
  const diagnostics: DeepTimeStageIsolationDiagnostics = {
    modelVersion: 'deep-time-stage-isolation-v1',
    initialSeaLevel: round(baseline.initialSeaLevel),
    finalSeaLevel: round(project.primaryWorld.seaLevel),
    seaLevelDelta: round(project.primaryWorld.seaLevel - baseline.initialSeaLevel),
    beforeAging,
    afterAgingBeforeFinalWater,
    afterFinalWater,
    agingWaterChangedCells: changedCells(baseline.initialWater, preFinalWater),
    reconciliationWaterChangedCells: changedCells(preFinalWater, finalWater),
    agingWaterCellShareDelta: round(afterAgingBeforeFinalWater.waterCellShare - beforeAging.waterCellShare),
    reconciliationWaterCellShareDelta: round(afterFinalWater.waterCellShare - afterAgingBeforeFinalWater.waterCellShare),
    agingCoastlineCellShareDelta: round(afterAgingBeforeFinalWater.coastlineCellShare - beforeAging.coastlineCellShare),
    reconciliationCoastlineCellShareDelta: round(afterFinalWater.coastlineCellShare - afterAgingBeforeFinalWater.coastlineCellShare),
    agingLandmassCountDelta: afterAgingBeforeFinalWater.landmassCount - beforeAging.landmassCount,
    reconciliationLandmassCountDelta: afterFinalWater.landmassCount - afterAgingBeforeFinalWater.landmassCount,
    agingLargestLandmassShareDelta: round(afterAgingBeforeFinalWater.largestLandmassShare - beforeAging.largestLandmassShare),
    reconciliationLargestLandmassShareDelta: round(afterFinalWater.largestLandmassShare - afterAgingBeforeFinalWater.largestLandmassShare)
  };

  const extended = project.primaryWorld.deepTime as typeof project.primaryWorld.deepTime & {
    stageIsolation?: DeepTimeStageIsolationDiagnostics;
  };
  extended.stageIsolation = diagnostics;
  project.primaryWorld.deepTime.notes.push(
    'Stage-isolation diagnostics reconstruct the post-aging water mask at the pre-reconciliation sea level, separating geological aging from final ocean-target reconciliation.'
  );
  return diagnostics;
}
