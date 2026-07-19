import { buildCubedSphereTopology, clamp, type WorldProject } from '@world-forge/shared';
import type { DeepTimeProject } from './deepTimePipeline';

export type PreAgingTerrainState = {
  elevation: Float32Array;
  water: Uint8Array;
};

export type TerrainStateSummary = {
  meanElevation: number;
  elevationStdDev: number;
  meanLocalRelief: number;
  p95LocalRelief: number;
  ruggedTerrainShare: number;
  flatTerrainShare: number;
  boundaryMeanRelief: number;
  interiorMeanRelief: number;
  boundaryReliefRatio: number;
  basinFloorShare: number;
  coastlineCellShare: number;
  landCellShare: number;
  landmassCount: number;
  largestLandmassShare: number;
  cratonMeanRelief: number;
  nonCratonMeanRelief: number;
  cratonCellCount: number;
  nonCratonCellCount: number;
};

export type ProcessPressureSummary = {
  cratonTectonicGainPressure: number;
  nonCratonTectonicGainPressure: number;
  tectonicComparisonAvailable: boolean;
  cratonTectonicOpportunity: number;
  nonCratonTectonicOpportunity: number;
  cratonWeatheringLossPressure: number;
  nonCratonWeatheringLossPressure: number;
  weatheringComparisonAvailable: boolean;
  cratonWeatheringReliefOpportunity: number;
  nonCratonWeatheringReliefOpportunity: number;
  cratonGlacialLossPressure: number;
  nonCratonGlacialLossPressure: number;
  glacialComparisonAvailable: boolean;
  cratonGlacialEligibleCells: number;
  nonCratonGlacialEligibleCells: number;
  cratonCoastalLossPressure: number;
  nonCratonCoastalLossPressure: number;
  coastalComparisonAvailable: boolean;
  cratonCoastalOpportunity: number;
  nonCratonCoastalOpportunity: number;
};

export type DeepTimeTerrainChangeDiagnostics = {
  before: TerrainStateSummary;
  after: TerrainStateSummary;
  meanElevationDelta: number;
  elevationStdDevDelta: number;
  meanLocalReliefDelta: number;
  p95LocalReliefDelta: number;
  ruggedTerrainShareDelta: number;
  flatTerrainShareDelta: number;
  boundaryMeanReliefDelta: number;
  interiorMeanReliefDelta: number;
  boundaryReliefRatioDelta: number;
  basinFloorShareDelta: number;
  coastlineCellShareDelta: number;
  landCellShareDelta: number;
  landmassCountDelta: number;
  largestLandmassShareDelta: number;
  cratonMeanReliefDelta: number;
  nonCratonMeanReliefDelta: number;
  cratonComparisonAvailable: boolean;
  cratonRelativeReliefRetention: number;
  uniqueElevationChangedCells: number;
  uniqueWaterChangedCells: number;
  processPressure: ProcessPressureSummary;
  tectonicAdjustmentOperations: number;
  impactAdjustmentOperations: number;
  weatheringOperations: number;
  glacialErosionOperations: number;
  coastalAdjustmentOperations: number;
  floodedValleyOperations: number;
};

function round(value: number, digits = 5): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

export function capturePreAgingTerrain(project: WorldProject): PreAgingTerrainState {
  return {
    elevation: new Float32Array(project.primaryWorld.topologyLayers.elevation),
    water: new Uint8Array(project.primaryWorld.topologyLayers.water)
  };
}

function summarize(
  project: DeepTimeProject,
  elevation: Float32Array,
  water: Uint8Array,
  cratonPlateIds: Set<number>
): TerrainStateSummary {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const plates = world.topologyLayers.plates;
  const total = Math.max(1, topology.cellCount);
  let elevationSum = 0;
  let elevationSumSq = 0;
  for (const value of elevation) {
    elevationSum += value;
    elevationSumSq += value * value;
  }
  const meanElevation = elevationSum / total;
  const elevationStdDev = Math.sqrt(Math.max(0, elevationSumSq / total - meanElevation ** 2));
  const localRelief = new Float32Array(total);
  let reliefSum = 0;
  let boundaryRelief = 0;
  let boundaryCells = 0;
  let interiorRelief = 0;
  let interiorCells = 0;
  let rugged = 0;
  let flat = 0;
  let basinFloor = 0;
  let coastline = 0;
  let cratonRelief = 0;
  let cratonCells = 0;
  let nonCratonRelief = 0;
  let nonCratonCells = 0;

  for (let cell = 0; cell < total; cell += 1) {
    let maxDifference = 0;
    let hasPlateBoundary = false;
    let hasWaterBoundary = false;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0) continue;
      maxDifference = Math.max(maxDifference, Math.abs(elevation[cell] - elevation[neighbor]));
      if (plates[neighbor] !== plates[cell]) hasPlateBoundary = true;
      if (water[neighbor] !== water[cell]) hasWaterBoundary = true;
    }
    localRelief[cell] = maxDifference;
    reliefSum += maxDifference;
    if (hasPlateBoundary) {
      boundaryRelief += maxDifference;
      boundaryCells += 1;
    } else {
      interiorRelief += maxDifference;
      interiorCells += 1;
    }
    if (hasWaterBoundary) coastline += 1;
    if (maxDifference >= 0.08) rugged += 1;
    if (maxDifference <= 0.015) flat += 1;
    if (elevation[cell] <= meanElevation - elevationStdDev * 0.65 && maxDifference <= 0.025) basinFloor += 1;
    if (cratonPlateIds.has(plates[cell])) {
      cratonRelief += maxDifference;
      cratonCells += 1;
    } else {
      nonCratonRelief += maxDifference;
      nonCratonCells += 1;
    }
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

  const boundaryMean = boundaryRelief / Math.max(1, boundaryCells);
  const interiorMean = interiorRelief / Math.max(1, interiorCells);
  return {
    meanElevation: round(meanElevation),
    elevationStdDev: round(elevationStdDev),
    meanLocalRelief: round(reliefSum / total),
    p95LocalRelief: round(percentile(Array.from(localRelief), 0.95)),
    ruggedTerrainShare: round(rugged / total),
    flatTerrainShare: round(flat / total),
    boundaryMeanRelief: round(boundaryMean),
    interiorMeanRelief: round(interiorMean),
    boundaryReliefRatio: round(boundaryMean / Math.max(0.0001, interiorMean)),
    basinFloorShare: round(basinFloor / total),
    coastlineCellShare: round(coastline / total),
    landCellShare: round(landCells / total),
    landmassCount: components.length,
    largestLandmassShare: round(Math.max(0, ...components) / Math.max(1, landCells)),
    cratonMeanRelief: round(cratonRelief / Math.max(1, cratonCells)),
    nonCratonMeanRelief: round(nonCratonRelief / Math.max(1, nonCratonCells)),
    cratonCellCount: cratonCells,
    nonCratonCellCount: nonCratonCells
  };
}

function estimateProcessPressure(
  project: DeepTimeProject,
  beforeState: PreAgingTerrainState,
  cratonPlateIds: Set<number>
): ProcessPressureSummary {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const plates = world.topologyLayers.plates;
  const finalIce = world.topologyLayers.ice;
  const resistanceByPlate = new Map(world.deepTime.cratons.map((craton) => [craton.plateId, craton.erosionResistance]));
  const totals = {
    cratonTectonic: 0,
    nonCratonTectonic: 0,
    cratonWeathering: 0,
    nonCratonWeathering: 0,
    cratonGlacial: 0,
    nonCratonGlacial: 0,
    cratonCoastal: 0,
    nonCratonCoastal: 0
  };
  const opportunities = {
    cratonTectonic: 0,
    nonCratonTectonic: 0,
    cratonWeatheringRelief: 0,
    nonCratonWeatheringRelief: 0,
    cratonGlacial: 0,
    nonCratonGlacial: 0,
    cratonCoastal: 0,
    nonCratonCoastal: 0
  };

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (beforeState.water[cell]) continue;
    const isCraton = cratonPlateIds.has(plates[cell]);
    const prefix = isCraton ? 'craton' : 'nonCraton';
    let differentPlateNeighbors = 0;
    let lowerNeighbors = 0;
    let neighborMean = 0;
    let neighborCount = 0;
    let waterNeighbors = 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0) continue;
      if (plates[neighbor] !== plates[cell]) differentPlateNeighbors += 1;
      if (beforeState.elevation[neighbor] < beforeState.elevation[cell]) lowerNeighbors += 1;
      neighborMean += beforeState.elevation[neighbor];
      neighborCount += 1;
      if (beforeState.water[neighbor]) waterNeighbors += 1;
    }
    const resistance = resistanceByPlate.get(plates[cell]) ?? 0.5;
    if (differentPlateNeighbors > 0) {
      const opportunity = differentPlateNeighbors * (0.7 + lowerNeighbors * 0.08);
      totals[`${prefix}Tectonic`] += opportunity * 0.00055 * (1 - resistance * 0.35);
      opportunities[`${prefix}Tectonic`] += opportunity;
    }
    const relief = neighborCount ? Math.max(0, beforeState.elevation[cell] - neighborMean / neighborCount) : 0;
    if (relief > 0.01) {
      totals[`${prefix}Weathering`] += relief * 0.035 * (1 - resistance * 0.55);
      opportunities[`${prefix}WeatheringRelief`] += relief;
    }
    const altitude = Math.max(0, beforeState.elevation[cell] - world.seaLevel);
    if (finalIce[cell] && altitude > 0.012) {
      totals[`${prefix}Glacial`] += Math.min(0.016, 0.0044 * 0.85 * (1 - resistance * 0.4));
      opportunities[`${prefix}Glacial`] += 1;
    }
    if (waterNeighbors > 0 && neighborCount > 0) {
      const weakness = clamp(1 - Math.abs(beforeState.elevation[cell] - neighborMean / neighborCount) * 2.5, 0.08, 1);
      const opportunity = weakness * waterNeighbors;
      totals[`${prefix}Coastal`] += opportunity * 0.0022 * (1 - resistance * 0.45);
      opportunities[`${prefix}Coastal`] += opportunity;
    }
  }

  const tectonicComparisonAvailable = opportunities.cratonTectonic > 1e-6 && opportunities.nonCratonTectonic > 1e-6;
  const weatheringComparisonAvailable = opportunities.cratonWeatheringRelief > 1e-6 && opportunities.nonCratonWeatheringRelief > 1e-6;
  const glacialComparisonAvailable = opportunities.cratonGlacial > 0 && opportunities.nonCratonGlacial > 0;
  const coastalComparisonAvailable = opportunities.cratonCoastal > 1e-6 && opportunities.nonCratonCoastal > 1e-6;
  return {
    cratonTectonicGainPressure: tectonicComparisonAvailable ? round(totals.cratonTectonic / opportunities.cratonTectonic) : 0,
    nonCratonTectonicGainPressure: tectonicComparisonAvailable ? round(totals.nonCratonTectonic / opportunities.nonCratonTectonic) : 0,
    tectonicComparisonAvailable,
    cratonTectonicOpportunity: round(opportunities.cratonTectonic),
    nonCratonTectonicOpportunity: round(opportunities.nonCratonTectonic),
    cratonWeatheringLossPressure: weatheringComparisonAvailable ? round(totals.cratonWeathering / opportunities.cratonWeatheringRelief) : 0,
    nonCratonWeatheringLossPressure: weatheringComparisonAvailable ? round(totals.nonCratonWeathering / opportunities.nonCratonWeatheringRelief) : 0,
    weatheringComparisonAvailable,
    cratonWeatheringReliefOpportunity: round(opportunities.cratonWeatheringRelief),
    nonCratonWeatheringReliefOpportunity: round(opportunities.nonCratonWeatheringRelief),
    cratonGlacialLossPressure: glacialComparisonAvailable ? round(totals.cratonGlacial / opportunities.cratonGlacial) : 0,
    nonCratonGlacialLossPressure: glacialComparisonAvailable ? round(totals.nonCratonGlacial / opportunities.nonCratonGlacial) : 0,
    glacialComparisonAvailable,
    cratonGlacialEligibleCells: opportunities.cratonGlacial,
    nonCratonGlacialEligibleCells: opportunities.nonCratonGlacial,
    cratonCoastalLossPressure: coastalComparisonAvailable ? round(totals.cratonCoastal / opportunities.cratonCoastal) : 0,
    nonCratonCoastalLossPressure: coastalComparisonAvailable ? round(totals.nonCratonCoastal / opportunities.nonCratonCoastal) : 0,
    coastalComparisonAvailable,
    cratonCoastalOpportunity: round(opportunities.cratonCoastal),
    nonCratonCoastalOpportunity: round(opportunities.nonCratonCoastal)
  };
}

export function attachDeepTimeTerrainChangeDiagnostics(
  project: DeepTimeProject,
  beforeState: PreAgingTerrainState
): DeepTimeTerrainChangeDiagnostics {
  const cratonPlateIds = new Set(project.primaryWorld.deepTime.cratons.map((craton) => craton.plateId));
  const before = summarize(project, beforeState.elevation, beforeState.water, cratonPlateIds);
  const afterElevation = project.primaryWorld.topologyLayers.elevation;
  const afterWater = project.primaryWorld.topologyLayers.water;
  const after = summarize(project, afterElevation, afterWater, cratonPlateIds);
  const deepTime = project.primaryWorld.deepTime;
  let uniqueElevationChangedCells = 0;
  let uniqueWaterChangedCells = 0;
  for (let cell = 0; cell < beforeState.elevation.length; cell += 1) {
    if (Math.abs(afterElevation[cell] - beforeState.elevation[cell]) > 1e-7) uniqueElevationChangedCells += 1;
    if (afterWater[cell] !== beforeState.water[cell]) uniqueWaterChangedCells += 1;
  }
  const cratonComparisonAvailable = before.cratonCellCount > 0
    && before.nonCratonCellCount > 0
    && before.cratonMeanRelief > 0.0005
    && before.nonCratonMeanRelief > 0.0005;
  const cratonRelativeReliefRetention = cratonComparisonAvailable
    ? round((after.cratonMeanRelief / before.cratonMeanRelief) - (after.nonCratonMeanRelief / before.nonCratonMeanRelief))
    : 0;
  const diagnostics: DeepTimeTerrainChangeDiagnostics = {
    before,
    after,
    meanElevationDelta: round(after.meanElevation - before.meanElevation),
    elevationStdDevDelta: round(after.elevationStdDev - before.elevationStdDev),
    meanLocalReliefDelta: round(after.meanLocalRelief - before.meanLocalRelief),
    p95LocalReliefDelta: round(after.p95LocalRelief - before.p95LocalRelief),
    ruggedTerrainShareDelta: round(after.ruggedTerrainShare - before.ruggedTerrainShare),
    flatTerrainShareDelta: round(after.flatTerrainShare - before.flatTerrainShare),
    boundaryMeanReliefDelta: round(after.boundaryMeanRelief - before.boundaryMeanRelief),
    interiorMeanReliefDelta: round(after.interiorMeanRelief - before.interiorMeanRelief),
    boundaryReliefRatioDelta: round(after.boundaryReliefRatio - before.boundaryReliefRatio),
    basinFloorShareDelta: round(after.basinFloorShare - before.basinFloorShare),
    coastlineCellShareDelta: round(after.coastlineCellShare - before.coastlineCellShare),
    landCellShareDelta: round(after.landCellShare - before.landCellShare),
    landmassCountDelta: after.landmassCount - before.landmassCount,
    largestLandmassShareDelta: round(after.largestLandmassShare - before.largestLandmassShare),
    cratonMeanReliefDelta: round(after.cratonMeanRelief - before.cratonMeanRelief),
    nonCratonMeanReliefDelta: round(after.nonCratonMeanRelief - before.nonCratonMeanRelief),
    cratonComparisonAvailable,
    cratonRelativeReliefRetention,
    uniqueElevationChangedCells,
    uniqueWaterChangedCells,
    processPressure: estimateProcessPressure(project, beforeState, cratonPlateIds),
    tectonicAdjustmentOperations: deepTime.tectonicAdjustedCells,
    impactAdjustmentOperations: deepTime.impactAdjustedCells,
    weatheringOperations: deepTime.weatheredCells,
    glacialErosionOperations: deepTime.glaciallyErodedCells,
    coastalAdjustmentOperations: deepTime.coastalAdjustedCells,
    floodedValleyOperations: deepTime.floodedValleyCells
  };
  const extended = deepTime as typeof deepTime & { terrainChange?: DeepTimeTerrainChangeDiagnostics };
  extended.terrainChange = diagnostics;
  deepTime.notes.push('Deep-time process-pressure comparisons are only marked available when both craton and non-craton populations have meaningful eligible opportunity.');
  return diagnostics;
}
