import { buildCubedSphereTopology, type WorldProject } from '@world-forge/shared';

export type InitialTerrainFingerprint = {
  meanLocalRelief: number;
  p95LocalRelief: number;
  ruggedTerrainShare: number;
  flatTerrainShare: number;
  plateauShare: number;
  basinFloorShare: number;
  boundaryReliefRatio: number;
  coastlineCellShare: number;
  landmassCount: number;
  largestLandmassShare: number;
  islandLandShare: number;
  terminalPhaseAdvanced: number;
  terminalPhaseAdvanceYears: number;
  terminalSearchCycleYears: number;
  terminalSampleStepYears: number;
  terminalEvaluatedCandidates: number;
  terminalInitialGlaciationPressure: number;
  terminalSelectedGlaciationPressure: number;
  terminalTargetGlaciationPressure: number;
  terminalTemperatureBeforeC: number;
  terminalTemperatureAfterC: number;
  terminalTargetTemperatureC: number;
  terminalAppliedTemperatureOffsetC: number;
  terminalIceCellsAdded: number;
  terminalIceCellsCleared: number;
  terminalAlignmentImprovement: number;
  agingMeanElevationDelta: number;
  agingElevationStdDevDelta: number;
  agingMeanLocalReliefDelta: number;
  agingP95LocalReliefDelta: number;
  agingRuggedTerrainShareDelta: number;
  agingFlatTerrainShareDelta: number;
  agingBoundaryMeanReliefDelta: number;
  agingInteriorMeanReliefDelta: number;
  agingBoundaryReliefRatioDelta: number;
  agingBasinFloorShareDelta: number;
  agingCoastlineCellShareDelta: number;
  agingLandCellShareDelta: number;
  agingLandmassCountDelta: number;
  agingLargestLandmassShareDelta: number;
  agingCratonMeanReliefDelta: number;
  agingNonCratonMeanReliefDelta: number;
  agingCratonComparisonAvailable: number;
  agingCratonRelativeReliefRetention: number;
  agingUniqueElevationChangedCells: number;
  agingUniqueWaterChangedCells: number;
  agingCratonTectonicGainPressure: number;
  agingNonCratonTectonicGainPressure: number;
  agingTectonicComparisonAvailable: number;
  agingCratonTectonicOpportunity: number;
  agingNonCratonTectonicOpportunity: number;
  agingCratonWeatheringLossPressure: number;
  agingNonCratonWeatheringLossPressure: number;
  agingWeatheringComparisonAvailable: number;
  agingCratonWeatheringReliefOpportunity: number;
  agingNonCratonWeatheringReliefOpportunity: number;
  agingCratonGlacialLossPressure: number;
  agingNonCratonGlacialLossPressure: number;
  agingGlacialComparisonAvailable: number;
  agingCratonGlacialEligibleCells: number;
  agingNonCratonGlacialEligibleCells: number;
  agingCratonCoastalLossPressure: number;
  agingNonCratonCoastalLossPressure: number;
  agingCoastalComparisonAvailable: number;
  agingCratonCoastalOpportunity: number;
  agingNonCratonCoastalOpportunity: number;
  agingTectonicAdjustmentOperations: number;
  agingImpactAdjustmentOperations: number;
  agingWeatheringOperations: number;
  agingGlacialErosionOperations: number;
  agingCoastalAdjustmentOperations: number;
  agingFloodedValleyOperations: number;
  agingTectonicAdjustedCells: number;
  agingImpactAdjustedCells: number;
  agingWeatheredCells: number;
  agingGlaciallyErodedCells: number;
  agingCoastalAdjustedCells: number;
  agingFloodedValleyCells: number;
  agingMutationUnclassifiedAmount: number;
  agingMutationUnclassifiedOperations: number;
  agingTectonicGainAmount: number;
  agingTectonicGainOperations: number;
  agingTectonicGainAffectedCells: number;
  agingTectonicGainComparisonAvailable: number;
  agingCratonTectonicGainPerAffectedCell: number;
  agingNonCratonTectonicGainPerAffectedCell: number;
  agingCratonTectonicGainPerBaselineRelief: number;
  agingNonCratonTectonicGainPerBaselineRelief: number;
  agingImpactGainAmount: number;
  agingImpactGainOperations: number;
  agingImpactGainAffectedCells: number;
  agingImpactGainComparisonAvailable: number;
  agingCratonImpactGainPerAffectedCell: number;
  agingNonCratonImpactGainPerAffectedCell: number;
  agingCratonImpactGainPerBaselineRelief: number;
  agingNonCratonImpactGainPerBaselineRelief: number;
  agingImpactLossAmount: number;
  agingImpactLossOperations: number;
  agingImpactLossAffectedCells: number;
  agingImpactLossComparisonAvailable: number;
  agingCratonImpactLossPerAffectedCell: number;
  agingNonCratonImpactLossPerAffectedCell: number;
  agingCratonImpactLossPerBaselineRelief: number;
  agingNonCratonImpactLossPerBaselineRelief: number;
  agingWeatheringLossAmount: number;
  agingWeatheringLossOperationsExact: number;
  agingWeatheringLossAffectedCells: number;
  agingWeatheringLossComparisonAvailable: number;
  agingCratonWeatheringLossPerAffectedCell: number;
  agingNonCratonWeatheringLossPerAffectedCell: number;
  agingCratonWeatheringLossPerBaselineRelief: number;
  agingNonCratonWeatheringLossPerBaselineRelief: number;
  agingGlacialLossAmount: number;
  agingGlacialLossOperationsExact: number;
  agingGlacialLossAffectedCells: number;
  agingGlacialLossComparisonAvailable: number;
  agingCratonGlacialLossPerAffectedCell: number;
  agingNonCratonGlacialLossPerAffectedCell: number;
  agingCratonGlacialLossPerBaselineRelief: number;
  agingNonCratonGlacialLossPerBaselineRelief: number;
  agingCoastalLossAmount: number;
  agingCoastalLossOperationsExact: number;
  agingCoastalLossAffectedCells: number;
  agingCoastalLossComparisonAvailable: number;
  agingCratonCoastalLossPerAffectedCell: number;
  agingNonCratonCoastalLossPerAffectedCell: number;
  agingCratonCoastalLossPerBaselineRelief: number;
  agingNonCratonCoastalLossPerBaselineRelief: number;
};

type TerminalPhaseAlignment = {
  advanced?: boolean;
  selectedAdvanceYears?: number;
  searchCycleYears?: number;
  sampleStepYears?: number;
  evaluatedCandidates?: number;
  initialGlaciationPressure?: number;
  selectedGlaciationPressure?: number;
  targetGlaciationPressure?: number;
  temperatureBeforeC?: number;
  temperatureAfterC?: number;
  targetTemperatureC?: number;
  appliedTemperatureOffsetC?: number;
  iceCellsAdded?: number;
  iceCellsCleared?: number;
  alignmentImprovement?: number;
};

type ProcessPressure = {
  cratonTectonicGainPressure?: number;
  nonCratonTectonicGainPressure?: number;
  tectonicComparisonAvailable?: boolean;
  cratonTectonicOpportunity?: number;
  nonCratonTectonicOpportunity?: number;
  cratonWeatheringLossPressure?: number;
  nonCratonWeatheringLossPressure?: number;
  weatheringComparisonAvailable?: boolean;
  cratonWeatheringReliefOpportunity?: number;
  nonCratonWeatheringReliefOpportunity?: number;
  cratonGlacialLossPressure?: number;
  nonCratonGlacialLossPressure?: number;
  glacialComparisonAvailable?: boolean;
  cratonGlacialEligibleCells?: number;
  nonCratonGlacialEligibleCells?: number;
  cratonCoastalLossPressure?: number;
  nonCratonCoastalLossPressure?: number;
  coastalComparisonAvailable?: boolean;
  cratonCoastalOpportunity?: number;
  nonCratonCoastalOpportunity?: number;
};

type TerrainChange = {
  meanElevationDelta?: number;
  elevationStdDevDelta?: number;
  meanLocalReliefDelta?: number;
  p95LocalReliefDelta?: number;
  ruggedTerrainShareDelta?: number;
  flatTerrainShareDelta?: number;
  boundaryMeanReliefDelta?: number;
  interiorMeanReliefDelta?: number;
  boundaryReliefRatioDelta?: number;
  basinFloorShareDelta?: number;
  coastlineCellShareDelta?: number;
  landCellShareDelta?: number;
  landmassCountDelta?: number;
  largestLandmassShareDelta?: number;
  cratonMeanReliefDelta?: number;
  nonCratonMeanReliefDelta?: number;
  cratonComparisonAvailable?: boolean;
  cratonRelativeReliefRetention?: number;
  uniqueElevationChangedCells?: number;
  uniqueWaterChangedCells?: number;
  processPressure?: ProcessPressure;
  tectonicAdjustmentOperations?: number;
  impactAdjustmentOperations?: number;
  weatheringOperations?: number;
  glacialErosionOperations?: number;
  coastalAdjustmentOperations?: number;
  floodedValleyOperations?: number;
  tectonicAdjustedCells?: number;
  impactAdjustedCells?: number;
  weatheredCells?: number;
  glaciallyErodedCells?: number;
  coastalAdjustedCells?: number;
  floodedValleyCells?: number;
};

type MutationPopulation = {
  amountPerAffectedCell?: number;
  amountPerBaselineRelief?: number;
};

type MutationProcess = {
  totalAmount?: number;
  operations?: number;
  affectedCells?: number;
  comparisonAvailable?: boolean;
  craton?: MutationPopulation;
  nonCraton?: MutationPopulation;
};

type MutationLedger = {
  tectonicGain?: MutationProcess;
  impactGain?: MutationProcess;
  impactLoss?: MutationProcess;
  weatheringLoss?: MutationProcess;
  glacialLoss?: MutationProcess;
  coastalLoss?: MutationProcess;
  unclassifiedElevationMutationAmount?: number;
  unclassifiedElevationMutationOperations?: number;
};

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

function processFields(process: MutationProcess | undefined): [number, number, number, number, number, number, number, number] {
  return [
    process?.totalAmount ?? 0,
    process?.operations ?? 0,
    process?.affectedCells ?? 0,
    process?.comparisonAvailable ? 1 : 0,
    process?.craton?.amountPerAffectedCell ?? 0,
    process?.nonCraton?.amountPerAffectedCell ?? 0,
    process?.craton?.amountPerBaselineRelief ?? 0,
    process?.nonCraton?.amountPerBaselineRelief ?? 0
  ];
}

export function fingerprintInitialTerrain(project: WorldProject): InitialTerrainFingerprint {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const elevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const plates = world.topologyLayers.plates;
  const total = Math.max(1, topology.cellCount);
  const extended = world as typeof world & { deepTime?: { terminalPhaseAlignment?: TerminalPhaseAlignment; terrainChange?: TerrainChange; mutationLedger?: MutationLedger } };
  const alignment = extended.deepTime?.terminalPhaseAlignment ?? {};
  const aging = extended.deepTime?.terrainChange ?? {};
  const pressure = aging.processPressure ?? {};
  const ledger = extended.deepTime?.mutationLedger ?? {};

  let elevationSum = 0;
  let elevationSumSq = 0;
  for (const value of elevation) {
    elevationSum += value;
    elevationSumSq += value * value;
  }
  const elevationMean = elevationSum / total;
  const elevationStdDev = Math.sqrt(Math.max(0, elevationSumSq / total - elevationMean * elevationMean));
  const localRelief = new Float32Array(total);
  let reliefSum = 0;
  let boundaryRelief = 0;
  let boundaryCells = 0;
  let interiorRelief = 0;
  let interiorCells = 0;
  let rugged = 0;
  let flat = 0;
  let plateau = 0;
  let basinFloor = 0;
  let coastlineCells = 0;

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
    if (hasWaterBoundary) coastlineCells += 1;
    if (maxDifference >= 0.08) rugged += 1;
    if (maxDifference <= 0.015) flat += 1;
    if (elevation[cell] >= elevationMean + elevationStdDev * 0.55 && maxDifference <= 0.03) plateau += 1;
    if (elevation[cell] <= elevationMean - elevationStdDev * 0.65 && maxDifference <= 0.025) basinFloor += 1;
  }

  const visited = new Uint8Array(total);
  const landComponents: number[] = [];
  let landCells = 0;
  for (let start = 0; start < total; start += 1) {
    if (water[start]) continue;
    landCells += 1;
    if (visited[start]) continue;
    visited[start] = 1;
    const queue = [start];
    let componentSize = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const cell = queue[cursor];
      componentSize += 1;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || water[neighbor] || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    landComponents.push(componentSize);
  }

  const islandThreshold = Math.max(12, Math.floor(total * 0.002));
  const islandCells = landComponents.filter((size) => size <= islandThreshold).reduce((sum, size) => sum + size, 0);
  const boundaryMean = boundaryRelief / Math.max(1, boundaryCells);
  const interiorMean = interiorRelief / Math.max(1, interiorCells);
  const tectonicOperations = aging.tectonicAdjustmentOperations ?? aging.tectonicAdjustedCells ?? 0;
  const impactOperations = aging.impactAdjustmentOperations ?? aging.impactAdjustedCells ?? 0;
  const weatheringOperations = aging.weatheringOperations ?? aging.weatheredCells ?? 0;
  const glacialOperations = aging.glacialErosionOperations ?? aging.glaciallyErodedCells ?? 0;
  const coastalOperations = aging.coastalAdjustmentOperations ?? aging.coastalAdjustedCells ?? 0;
  const floodedOperations = aging.floodedValleyOperations ?? aging.floodedValleyCells ?? 0;
  const tectonicLedger = processFields(ledger.tectonicGain);
  const impactGainLedger = processFields(ledger.impactGain);
  const impactLossLedger = processFields(ledger.impactLoss);
  const weatheringLedger = processFields(ledger.weatheringLoss);
  const glacialLedger = processFields(ledger.glacialLoss);
  const coastalLedger = processFields(ledger.coastalLoss);

  return {
    meanLocalRelief: rounded(reliefSum / total),
    p95LocalRelief: rounded(percentile(Array.from(localRelief), 0.95)),
    ruggedTerrainShare: rounded(rugged / total),
    flatTerrainShare: rounded(flat / total),
    plateauShare: rounded(plateau / total),
    basinFloorShare: rounded(basinFloor / total),
    boundaryReliefRatio: rounded(boundaryMean / Math.max(0.0001, interiorMean)),
    coastlineCellShare: rounded(coastlineCells / total),
    landmassCount: landComponents.length,
    largestLandmassShare: rounded(Math.max(0, ...landComponents) / Math.max(1, landCells)),
    islandLandShare: rounded(islandCells / Math.max(1, landCells)),
    terminalPhaseAdvanced: alignment.advanced ? 1 : 0,
    terminalPhaseAdvanceYears: alignment.selectedAdvanceYears ?? 0,
    terminalSearchCycleYears: alignment.searchCycleYears ?? 0,
    terminalSampleStepYears: alignment.sampleStepYears ?? 0,
    terminalEvaluatedCandidates: alignment.evaluatedCandidates ?? 0,
    terminalInitialGlaciationPressure: alignment.initialGlaciationPressure ?? 0,
    terminalSelectedGlaciationPressure: alignment.selectedGlaciationPressure ?? 0,
    terminalTargetGlaciationPressure: alignment.targetGlaciationPressure ?? 0,
    terminalTemperatureBeforeC: alignment.temperatureBeforeC ?? 0,
    terminalTemperatureAfterC: alignment.temperatureAfterC ?? 0,
    terminalTargetTemperatureC: alignment.targetTemperatureC ?? 0,
    terminalAppliedTemperatureOffsetC: alignment.appliedTemperatureOffsetC ?? 0,
    terminalIceCellsAdded: alignment.iceCellsAdded ?? 0,
    terminalIceCellsCleared: alignment.iceCellsCleared ?? 0,
    terminalAlignmentImprovement: alignment.alignmentImprovement ?? 0,
    agingMeanElevationDelta: aging.meanElevationDelta ?? 0,
    agingElevationStdDevDelta: aging.elevationStdDevDelta ?? 0,
    agingMeanLocalReliefDelta: aging.meanLocalReliefDelta ?? 0,
    agingP95LocalReliefDelta: aging.p95LocalReliefDelta ?? 0,
    agingRuggedTerrainShareDelta: aging.ruggedTerrainShareDelta ?? 0,
    agingFlatTerrainShareDelta: aging.flatTerrainShareDelta ?? 0,
    agingBoundaryMeanReliefDelta: aging.boundaryMeanReliefDelta ?? 0,
    agingInteriorMeanReliefDelta: aging.interiorMeanReliefDelta ?? 0,
    agingBoundaryReliefRatioDelta: aging.boundaryReliefRatioDelta ?? 0,
    agingBasinFloorShareDelta: aging.basinFloorShareDelta ?? 0,
    agingCoastlineCellShareDelta: aging.coastlineCellShareDelta ?? 0,
    agingLandCellShareDelta: aging.landCellShareDelta ?? 0,
    agingLandmassCountDelta: aging.landmassCountDelta ?? 0,
    agingLargestLandmassShareDelta: aging.largestLandmassShareDelta ?? 0,
    agingCratonMeanReliefDelta: aging.cratonMeanReliefDelta ?? 0,
    agingNonCratonMeanReliefDelta: aging.nonCratonMeanReliefDelta ?? 0,
    agingCratonComparisonAvailable: aging.cratonComparisonAvailable ? 1 : 0,
    agingCratonRelativeReliefRetention: aging.cratonRelativeReliefRetention ?? 0,
    agingUniqueElevationChangedCells: aging.uniqueElevationChangedCells ?? 0,
    agingUniqueWaterChangedCells: aging.uniqueWaterChangedCells ?? 0,
    agingCratonTectonicGainPressure: pressure.cratonTectonicGainPressure ?? 0,
    agingNonCratonTectonicGainPressure: pressure.nonCratonTectonicGainPressure ?? 0,
    agingTectonicComparisonAvailable: pressure.tectonicComparisonAvailable ? 1 : 0,
    agingCratonTectonicOpportunity: pressure.cratonTectonicOpportunity ?? 0,
    agingNonCratonTectonicOpportunity: pressure.nonCratonTectonicOpportunity ?? 0,
    agingCratonWeatheringLossPressure: pressure.cratonWeatheringLossPressure ?? 0,
    agingNonCratonWeatheringLossPressure: pressure.nonCratonWeatheringLossPressure ?? 0,
    agingWeatheringComparisonAvailable: pressure.weatheringComparisonAvailable ? 1 : 0,
    agingCratonWeatheringReliefOpportunity: pressure.cratonWeatheringReliefOpportunity ?? 0,
    agingNonCratonWeatheringReliefOpportunity: pressure.nonCratonWeatheringReliefOpportunity ?? 0,
    agingCratonGlacialLossPressure: pressure.cratonGlacialLossPressure ?? 0,
    agingNonCratonGlacialLossPressure: pressure.nonCratonGlacialLossPressure ?? 0,
    agingGlacialComparisonAvailable: pressure.glacialComparisonAvailable ? 1 : 0,
    agingCratonGlacialEligibleCells: pressure.cratonGlacialEligibleCells ?? 0,
    agingNonCratonGlacialEligibleCells: pressure.nonCratonGlacialEligibleCells ?? 0,
    agingCratonCoastalLossPressure: pressure.cratonCoastalLossPressure ?? 0,
    agingNonCratonCoastalLossPressure: pressure.nonCratonCoastalLossPressure ?? 0,
    agingCoastalComparisonAvailable: pressure.coastalComparisonAvailable ? 1 : 0,
    agingCratonCoastalOpportunity: pressure.cratonCoastalOpportunity ?? 0,
    agingNonCratonCoastalOpportunity: pressure.nonCratonCoastalOpportunity ?? 0,
    agingTectonicAdjustmentOperations: tectonicOperations,
    agingImpactAdjustmentOperations: impactOperations,
    agingWeatheringOperations: weatheringOperations,
    agingGlacialErosionOperations: glacialOperations,
    agingCoastalAdjustmentOperations: coastalOperations,
    agingFloodedValleyOperations: floodedOperations,
    agingTectonicAdjustedCells: tectonicOperations,
    agingImpactAdjustedCells: impactOperations,
    agingWeatheredCells: weatheringOperations,
    agingGlaciallyErodedCells: glacialOperations,
    agingCoastalAdjustedCells: coastalOperations,
    agingFloodedValleyCells: floodedOperations,
    agingMutationUnclassifiedAmount: ledger.unclassifiedElevationMutationAmount ?? 0,
    agingMutationUnclassifiedOperations: ledger.unclassifiedElevationMutationOperations ?? 0,
    agingTectonicGainAmount: tectonicLedger[0], agingTectonicGainOperations: tectonicLedger[1], agingTectonicGainAffectedCells: tectonicLedger[2], agingTectonicGainComparisonAvailable: tectonicLedger[3], agingCratonTectonicGainPerAffectedCell: tectonicLedger[4], agingNonCratonTectonicGainPerAffectedCell: tectonicLedger[5], agingCratonTectonicGainPerBaselineRelief: tectonicLedger[6], agingNonCratonTectonicGainPerBaselineRelief: tectonicLedger[7],
    agingImpactGainAmount: impactGainLedger[0], agingImpactGainOperations: impactGainLedger[1], agingImpactGainAffectedCells: impactGainLedger[2], agingImpactGainComparisonAvailable: impactGainLedger[3], agingCratonImpactGainPerAffectedCell: impactGainLedger[4], agingNonCratonImpactGainPerAffectedCell: impactGainLedger[5], agingCratonImpactGainPerBaselineRelief: impactGainLedger[6], agingNonCratonImpactGainPerBaselineRelief: impactGainLedger[7],
    agingImpactLossAmount: impactLossLedger[0], agingImpactLossOperations: impactLossLedger[1], agingImpactLossAffectedCells: impactLossLedger[2], agingImpactLossComparisonAvailable: impactLossLedger[3], agingCratonImpactLossPerAffectedCell: impactLossLedger[4], agingNonCratonImpactLossPerAffectedCell: impactLossLedger[5], agingCratonImpactLossPerBaselineRelief: impactLossLedger[6], agingNonCratonImpactLossPerBaselineRelief: impactLossLedger[7],
    agingWeatheringLossAmount: weatheringLedger[0], agingWeatheringLossOperationsExact: weatheringLedger[1], agingWeatheringLossAffectedCells: weatheringLedger[2], agingWeatheringLossComparisonAvailable: weatheringLedger[3], agingCratonWeatheringLossPerAffectedCell: weatheringLedger[4], agingNonCratonWeatheringLossPerAffectedCell: weatheringLedger[5], agingCratonWeatheringLossPerBaselineRelief: weatheringLedger[6], agingNonCratonWeatheringLossPerBaselineRelief: weatheringLedger[7],
    agingGlacialLossAmount: glacialLedger[0], agingGlacialLossOperationsExact: glacialLedger[1], agingGlacialLossAffectedCells: glacialLedger[2], agingGlacialLossComparisonAvailable: glacialLedger[3], agingCratonGlacialLossPerAffectedCell: glacialLedger[4], agingNonCratonGlacialLossPerAffectedCell: glacialLedger[5], agingCratonGlacialLossPerBaselineRelief: glacialLedger[6], agingNonCratonGlacialLossPerBaselineRelief: glacialLedger[7],
    agingCoastalLossAmount: coastalLedger[0], agingCoastalLossOperationsExact: coastalLedger[1], agingCoastalLossAffectedCells: coastalLedger[2], agingCoastalLossComparisonAvailable: coastalLedger[3], agingCratonCoastalLossPerAffectedCell: coastalLedger[4], agingNonCratonCoastalLossPerAffectedCell: coastalLedger[5], agingCratonCoastalLossPerBaselineRelief: coastalLedger[6], agingNonCratonCoastalLossPerBaselineRelief: coastalLedger[7]
  };
}
