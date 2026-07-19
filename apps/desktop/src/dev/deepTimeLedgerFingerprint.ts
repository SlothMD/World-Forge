import type { WorldProject } from '@world-forge/shared';

type MutationPopulation = {
  amountPerOperation?: number;
  operationsPerAffectedCell?: number;
  accumulatedOpportunity?: number;
  amountPerAccumulatedOpportunity?: number;
};

type MutationProcess = {
  amountPerOperation?: number;
  accumulatedOpportunity?: number;
  amountPerAccumulatedOpportunity?: number;
  craton?: MutationPopulation;
  nonCraton?: MutationPopulation;
};

type SedimentDiagnostics = {
  modelVersion?: string;
  erosionRemovedVolume?: number;
  transportableSedimentVolume?: number;
  nonTransportedVolume?: number;
  depositedVolume?: number;
  pendingVolume?: number;
  deepOceanLossVolume?: number;
  budgetError?: number;
  basinAssignedVolume?: number;
  riverAssignedVolume?: number;
  coastalAssignedVolume?: number;
  shelfAssignedVolume?: number;
  deepOceanAssignedVolume?: number;
  basinDepositedVolume?: number;
  riverDepositedVolume?: number;
  coastalDepositedVolume?: number;
  shelfDepositedVolume?: number;
  deepOceanDepositedVolume?: number;
  depositionOperations?: number;
  depositedCells?: number;
};

type MutationLedger = {
  modelVersion?: string;
  tectonicGain?: MutationProcess;
  impactGain?: MutationProcess;
  impactLoss?: MutationProcess;
  weatheringLoss?: MutationProcess;
  glacialLoss?: MutationProcess;
  coastalLoss?: MutationProcess;
  sedimentGain?: MutationProcess;
  sediment?: SedimentDiagnostics;
};

type StageIsolation = {
  modelVersion?: string;
  initialSeaLevel?: number;
  finalSeaLevel?: number;
  seaLevelDelta?: number;
  agingWaterChangedCells?: number;
  reconciliationWaterChangedCells?: number;
  agingWaterCellShareDelta?: number;
  reconciliationWaterCellShareDelta?: number;
  agingCoastlineCellShareDelta?: number;
  reconciliationCoastlineCellShareDelta?: number;
  agingLandmassCountDelta?: number;
  reconciliationLandmassCountDelta?: number;
  agingLargestLandmassShareDelta?: number;
  reconciliationLargestLandmassShareDelta?: number;
};

type VolcanismSnapshot = {
  mean?: number;
  activeShare?: number;
  boundaryMean?: number;
  interiorMean?: number;
  boundaryToInteriorRatio?: number;
};

type HistoricalProcesses = {
  modelVersion?: string;
  systemAgeGy?: number;
  ageBand?: string;
  epochCount?: number;
  earlyImpactIntensityShare?: number;
  lateImpactIntensityShare?: number;
  impactGainVolume?: number;
  impactLossVolume?: number;
  impactNetExcavationVolume?: number;
  impactEjectaReturnRatio?: number;
  impactOperationsPerGy?: number;
  impactLossPerGy?: number;
  impactLifetimeTargetOperations?: number;
  impactLifetimeOperationRatio?: number;
  tectonicGainPerGy?: number;
  weatheringLossPerGy?: number;
  glacialLossPerGy?: number;
  coastalLossPerGy?: number;
  geothermalFlux?: number;
  meanPlateSpeed?: number;
  volcanismBoundaryRetentionFactor?: number;
  volcanismInteriorRetentionFactor?: number;
  volcanismBoundaryFloor?: number;
  volcanismInteriorFloor?: number;
  volcanismChangedCells?: number;
  volcanismIncreasedCells?: number;
  volcanismDecreasedCells?: number;
  volcanismUnchangedCells?: number;
  preAgingVolcanism?: VolcanismSnapshot;
  finalVolcanism?: VolcanismSnapshot;
  volcanismMeanDelta?: number;
  volcanismActiveShareDelta?: number;
  volcanismBoundaryMeanDelta?: number;
  volcanismInteriorMeanDelta?: number;
};

type ImpactHistory = {
  modelVersion?: string;
  totalOpportunities?: number;
  appliedEvents?: number;
  retainedEvents?: number;
  visibleEvents?: number;
  earlyEventShare?: number;
  lateEventShare?: number;
  meanEventAgeMy?: number;
  meanOriginalStrength?: number;
  meanSurvivingRelief?: number;
  meanSurvivalRatio?: number;
  stableDryRetentionIndex?: number;
  wetActiveErosionIndex?: number;
  hardCap?: number;
};

type ContinentalDrift = {
  modelVersion?: string;
  boundaryPairs?: number;
  activeBoundaryPairs?: number;
  convergentBoundaryShare?: number;
  divergentBoundaryShare?: number;
  shearBoundaryShare?: number;
  continentalCollisionPairs?: number;
  continentalRiftPairs?: number;
  subductionPairs?: number;
  meanRelativePlateSpeedCmPerYear?: number;
  meanCollisionVelocityCmPerYear?: number;
  meanRiftVelocityCmPerYear?: number;
  puzzleFitPotential?: number;
  driftMode?: string;
};

type MotionLifecycle = {
  modelVersion?: string;
  plateCount?: number;
  meanPlateSpeedCmPerYear?: number;
  minPlateSpeedCmPerYear?: number;
  maxPlateSpeedCmPerYear?: number;
  plateSpeedStdDevCmPerYear?: number;
  directionResultant?: number;
  occupiedDirectionSectors?: number;
  motionDrivenTerrainChangedCellShare?: number;
  motionDrivenTerrainMeanAbsElevationDelta?: number;
  motionDrivenTerrainMaxAbsElevationDelta?: number;
  agingMotionPassCount?: number;
  agingMotionChangedCellShare?: number;
  agingMotionVolcanismChangedCellShare?: number;
  agingMotionMeanAbsElevationDelta?: number;
  agingMotionMaxAbsElevationDelta?: number;
  agingMotionPositiveElevationVolume?: number;
  agingMotionNegativeElevationVolume?: number;
  agingMotionConvergentBoundaryShare?: number;
  agingMotionDivergentBoundaryShare?: number;
  agingMotionShearBoundaryShare?: number;
  plateOwnershipChangedCellShareDuringAging?: number;
  plateMotionVectorChangedShareDuringAging?: number;
  meanContinentalCentroidDisplacementRadians?: number;
  maxContinentalCentroidDisplacementRadians?: number;
};

type PlateAdvection = {
  modelVersion?: string;
  passCount?: number;
  ownershipChangedCellShare?: number;
  continentalOwnershipChangedCellShare?: number;
  meanOwnershipChangesPerPass?: number;
  maxOwnershipChangesPerPass?: number;
  coherentFrontierAdvanceShare?: number;
  openedOceanCellShare?: number;
  compressedBoundaryCellShare?: number;
  subductedCellShare?: number;
  youngOceanCrustCellShare?: number;
  coherentRiftCorridorCellShare?: number;
  marginContinuityScore?: number;
  fragmentReleaseSuppressionCount?: number;
  orphanRiskCellShare?: number;
  terrainCarriedMeanAbsElevationDelta?: number;
  terrainCarriedMaxAbsElevationDelta?: number;
  volcanismCarriedCellShare?: number;
};

type FragmentHistory = {
  modelVersion?: string;
  fragmentCount?: number;
  continentalCellShare?: number;
  largestFragmentShareOfContinental?: number;
  meanFragmentCellCount?: number;
  boundaryCellShareOfContinental?: number;
  keyframedFragmentSampleCount?: number;
  meanProjectedFragmentDisplacementRadians?: number;
  maxProjectedFragmentDisplacementRadians?: number;
  collisionEventCandidatePairs?: number;
  riftSplitCandidateFragments?: number;
  terrainResponseApplied?: boolean;
  terrainResponseScale?: number;
  terrainResponseCellShare?: number;
  upliftResponseCellShare?: number;
  subsidenceResponseCellShare?: number;
  marginToneResponseCellShare?: number;
  estimatedPositiveReliefVolume?: number;
  estimatedNegativeReliefVolume?: number;
  meanAbsTerrainResponseDelta?: number;
  maxTerrainResponseDelta?: number;
  volcanismResponseApplied?: boolean;
  volcanismResponseScale?: number;
  volcanismResponseCellShare?: number;
  meanVolcanismResponseDelta?: number;
  maxVolcanismResponseDelta?: number;
  collisionCandidateCellShare?: number;
  riftCandidateCellShare?: number;
  transformCandidateCellShare?: number;
  subductionCandidateCellShare?: number;
  trenchCandidateCellShare?: number;
  conjugateMarginCandidatePairs?: number;
  conjugateMarginCandidateShare?: number;
  puzzleFitScore?: number;
  coherentFragmentScore?: number;
  motionEventScore?: number;
};

type FinalWater = {
  modelVersion?: string;
  targetOceanPercentage?: number;
  actualOceanPercentage?: number;
  oceanErrorPercentagePoints?: number;
  seaLevel?: number;
  topologyWaterMaskCorrections?: number;
  marineDepthAdjustedCells?: number;
  marineCellCount?: number;
  lakeCellCount?: number;
  coastCellShare?: number;
  coastlineSharpnessIndex?: number;
  nearSeaLevelBandShare?: number;
  immediateShelfShareOfMarine?: number;
  continentalShelfShareOfMarine?: number;
  shallowSeaShareOfMarine?: number;
  oceanShareOfMarine?: number;
  deepOceanShareOfMarine?: number;
  broadShelfAwayFromCoastShare?: number;
  meanMarineDepth?: number;
  medianMarineDepth?: number;
  p90MarineDepth?: number;
};

type PresentClimate = {
  modelVersion?: string;
  landCellCount?: number;
  marineCellCount?: number;
  meanTemperatureC?: number;
  medianTemperatureC?: number;
  p10TemperatureC?: number;
  p90TemperatureC?: number;
  meanLandPrecipitation?: number;
  medianLandPrecipitation?: number;
  p10LandPrecipitation?: number;
  p90LandPrecipitation?: number;
  landPrecipitationStdDev?: number;
  precipitationFlatnessIndex?: number;
  meanLandWetness?: number;
  medianLandWetness?: number;
  landWetnessStdDev?: number;
  coastalWetnessGradient?: number;
  inlandAridityIndex?: number;
  rainShadowIndex?: number;
  orographicLiftMean?: number;
  orographicShadowMean?: number;
  desertRiskShare?: number;
  tundraRiskShare?: number;
  wetlandRiskShare?: number;
  desertWetlandOverlapShare?: number;
};

type Hydrology = {
  modelVersion?: string;
  landCellCount?: number;
  climateInputMeanPrecipitation?: number;
  climateInputWetLandShare?: number;
  climateInputHighPrecipitationShare?: number;
  terrainHeadwaterCandidateShare?: number;
  terrainHighReliefWetShare?: number;
  terrainMountainHeadwaterShare?: number;
  sourceCandidateCount?: number;
  acceptedRiverCount?: number;
  maximumRiverCount?: number;
  namedRiverCapacityUse?: number;
  topologyRiverCellShare?: number;
  topologyMinorRiverCellShare?: number;
  topologyNavigableRiverCellShare?: number;
  namedRiverPathCellShare?: number;
  shortRiverShare?: number;
  medianSourceToMouthDrop?: number;
  meanRiverPathLength?: number;
  medianRiverPathLength?: number;
  p90RiverPathLength?: number;
  meanSourceElevationAboveSeaLevel?: number;
  medianSourceElevationAboveSeaLevel?: number;
  meanMouthElevationAboveSeaLevel?: number;
  oceanTerminusShare?: number;
  lakeTerminusShare?: number;
  wetlandTerminusShare?: number;
  basinTerminusShare?: number;
  lakeCellShareOfLand?: number;
  closedBasinShareOfLand?: number;
  riverDistributionEvenness?: number;
  maxAccumulation?: number;
  p90Accumulation?: number;
  p99Accumulation?: number;
};

type BiomeDiagnostics = {
  modelVersion?: string;
  landCellCount?: number;
  marineCellCount?: number;
  biomeSharesOfLand?: Partial<Record<string, number>>;
  climateRegimeSharesOfLand?: Partial<Record<string, number>>;
  climateRegimeMeanTemperatureVarianceProxyC?: Partial<Record<string, number>>;
  transitionDensity?: number;
  isolatedBiomeCellShare?: number;
  tinyPatchCellShare?: number;
  annualSeasonalTemperatureSwingC?: number;
  landSeasonalTemperatureSwingC?: number;
  meanTemperatureVarianceProxyC?: number;
  p90TemperatureVarianceProxyC?: number;
  lowVarianceLandShare?: number;
  highVarianceLandShare?: number;
  desertHighWetnessShare?: number;
  rainforestLowWetnessShare?: number;
  forestExtremeColdShare?: number;
  wetlandUnsupportedShare?: number;
  warmIceShare?: number;
  legacyMountainBiomeShare?: number;
  mountainousTerrainShareOfLand?: number;
  mountainousTerrainBiomeShares?: Partial<Record<string, number>>;
  findings?: string[];
};

export type DeepTimeLedgerFingerprint = Record<string, number | string>;

function fields(prefix: string, process: MutationProcess | undefined): DeepTimeLedgerFingerprint {
  return {
    [`aging${prefix}AmountPerOperation`]: process?.amountPerOperation ?? 0,
    [`aging${prefix}AccumulatedOpportunity`]: process?.accumulatedOpportunity ?? 0,
    [`aging${prefix}AmountPerAccumulatedOpportunity`]: process?.amountPerAccumulatedOpportunity ?? 0,
    [`agingCraton${prefix}OperationsPerAffectedCell`]: process?.craton?.operationsPerAffectedCell ?? 0,
    [`agingNonCraton${prefix}OperationsPerAffectedCell`]: process?.nonCraton?.operationsPerAffectedCell ?? 0,
    [`agingCraton${prefix}AccumulatedOpportunity`]: process?.craton?.accumulatedOpportunity ?? 0,
    [`agingNonCraton${prefix}AccumulatedOpportunity`]: process?.nonCraton?.accumulatedOpportunity ?? 0,
    [`agingCraton${prefix}AmountPerAccumulatedOpportunity`]: process?.craton?.amountPerAccumulatedOpportunity ?? 0,
    [`agingNonCraton${prefix}AmountPerAccumulatedOpportunity`]: process?.nonCraton?.amountPerAccumulatedOpportunity ?? 0
  };
}

export function fingerprintDeepTimeLedger(project: WorldProject): DeepTimeLedgerFingerprint {
  const extended = project.primaryWorld as typeof project.primaryWorld & {
    deepTime?: { mutationLedger?: MutationLedger; stageIsolation?: StageIsolation; historicalProcesses?: HistoricalProcesses; impactHistory?: ImpactHistory; continentalDrift?: ContinentalDrift; plateAdvection?: PlateAdvection; fragmentHistory?: FragmentHistory; motionLifecycle?: MotionLifecycle; finalWater?: FinalWater; presentClimate?: PresentClimate; hydrology?: Hydrology; biomeDiagnostics?: BiomeDiagnostics };
  };
  const ledger = extended.deepTime?.mutationLedger;
  const sediment = ledger?.sediment;
  const isolation = extended.deepTime?.stageIsolation;
  const historical = extended.deepTime?.historicalProcesses;
  const impactHistory = extended.deepTime?.impactHistory;
  const drift = extended.deepTime?.continentalDrift;
  const advection = extended.deepTime?.plateAdvection;
  const fragmentHistory = extended.deepTime?.fragmentHistory;
  const motion = extended.deepTime?.motionLifecycle;
  const finalWater = extended.deepTime?.finalWater;
  const presentClimate = extended.deepTime?.presentClimate;
  const hydrology = extended.deepTime?.hydrology;
  const biome = extended.deepTime?.biomeDiagnostics;
  const preVolcanism = historical?.preAgingVolcanism;
  const finalVolcanism = historical?.finalVolcanism;
  return {
    agingMutationLedgerVersion: ledger?.modelVersion ?? 'missing',
    agingSedimentBudgetVersion: sediment?.modelVersion ?? 'missing',
    agingSedimentErosionRemovedVolume: sediment?.erosionRemovedVolume ?? 0,
    agingSedimentTransportableVolume: sediment?.transportableSedimentVolume ?? 0,
    agingSedimentNonTransportedVolume: sediment?.nonTransportedVolume ?? 0,
    agingSedimentDepositedVolume: sediment?.depositedVolume ?? 0,
    agingSedimentPendingVolume: sediment?.pendingVolume ?? 0,
    agingSedimentDeepOceanLossVolume: sediment?.deepOceanLossVolume ?? 0,
    agingSedimentBudgetError: sediment?.budgetError ?? 0,
    agingSedimentBasinAssignedVolume: sediment?.basinAssignedVolume ?? 0,
    agingSedimentRiverAssignedVolume: sediment?.riverAssignedVolume ?? 0,
    agingSedimentCoastalAssignedVolume: sediment?.coastalAssignedVolume ?? 0,
    agingSedimentShelfAssignedVolume: sediment?.shelfAssignedVolume ?? 0,
    agingSedimentDeepOceanAssignedVolume: sediment?.deepOceanAssignedVolume ?? 0,
    agingSedimentBasinDepositedVolume: sediment?.basinDepositedVolume ?? 0,
    agingSedimentRiverDepositedVolume: sediment?.riverDepositedVolume ?? 0,
    agingSedimentCoastalDepositedVolume: sediment?.coastalDepositedVolume ?? 0,
    agingSedimentShelfDepositedVolume: sediment?.shelfDepositedVolume ?? 0,
    agingSedimentDeepOceanDepositedVolume: sediment?.deepOceanDepositedVolume ?? 0,
    agingSedimentDepositionOperations: sediment?.depositionOperations ?? 0,
    agingSedimentDepositedCells: sediment?.depositedCells ?? 0,
    agingStageIsolationVersion: isolation?.modelVersion ?? 'missing',
    agingInitialSeaLevel: isolation?.initialSeaLevel ?? 0,
    agingFinalSeaLevel: isolation?.finalSeaLevel ?? 0,
    agingSeaLevelDelta: isolation?.seaLevelDelta ?? 0,
    agingWaterChangedCellsIsolated: isolation?.agingWaterChangedCells ?? 0,
    reconciliationWaterChangedCells: isolation?.reconciliationWaterChangedCells ?? 0,
    agingWaterCellShareDeltaIsolated: isolation?.agingWaterCellShareDelta ?? 0,
    reconciliationWaterCellShareDelta: isolation?.reconciliationWaterCellShareDelta ?? 0,
    agingCoastlineCellShareDeltaIsolated: isolation?.agingCoastlineCellShareDelta ?? 0,
    reconciliationCoastlineCellShareDelta: isolation?.reconciliationCoastlineCellShareDelta ?? 0,
    agingLandmassCountDeltaIsolated: isolation?.agingLandmassCountDelta ?? 0,
    reconciliationLandmassCountDelta: isolation?.reconciliationLandmassCountDelta ?? 0,
    agingLargestLandmassShareDeltaIsolated: isolation?.agingLargestLandmassShareDelta ?? 0,
    reconciliationLargestLandmassShareDelta: isolation?.reconciliationLargestLandmassShareDelta ?? 0,
    agingHistoricalProcessesVersion: historical?.modelVersion ?? 'missing',
    agingImpactHistoryVersion: impactHistory?.modelVersion ?? 'missing',
    agingContinentalDriftVersion: drift?.modelVersion ?? 'missing',
    finalWaterDiagnosticsVersion: finalWater?.modelVersion ?? 'missing',
    finalWaterTargetOceanPercentage: finalWater?.targetOceanPercentage ?? 0,
    finalWaterActualOceanPercentage: finalWater?.actualOceanPercentage ?? 0,
    finalWaterOceanErrorPercentagePoints: finalWater?.oceanErrorPercentagePoints ?? 0,
    finalWaterSeaLevel: finalWater?.seaLevel ?? 0,
    finalWaterTopologyWaterMaskCorrections: finalWater?.topologyWaterMaskCorrections ?? 0,
    finalWaterMarineDepthAdjustedCells: finalWater?.marineDepthAdjustedCells ?? 0,
    finalWaterMarineCellCount: finalWater?.marineCellCount ?? 0,
    finalWaterLakeCellCount: finalWater?.lakeCellCount ?? 0,
    finalWaterCoastCellShare: finalWater?.coastCellShare ?? 0,
    finalWaterCoastlineSharpnessIndex: finalWater?.coastlineSharpnessIndex ?? 0,
    finalWaterNearSeaLevelBandShare: finalWater?.nearSeaLevelBandShare ?? 0,
    finalWaterImmediateShelfShareOfMarine: finalWater?.immediateShelfShareOfMarine ?? 0,
    finalWaterContinentalShelfShareOfMarine: finalWater?.continentalShelfShareOfMarine ?? 0,
    finalWaterShallowSeaShareOfMarine: finalWater?.shallowSeaShareOfMarine ?? 0,
    finalWaterOceanShareOfMarine: finalWater?.oceanShareOfMarine ?? 0,
    finalWaterDeepOceanShareOfMarine: finalWater?.deepOceanShareOfMarine ?? 0,
    finalWaterBroadShelfAwayFromCoastShare: finalWater?.broadShelfAwayFromCoastShare ?? 0,
    finalWaterMeanMarineDepth: finalWater?.meanMarineDepth ?? 0,
    finalWaterMedianMarineDepth: finalWater?.medianMarineDepth ?? 0,
    finalWaterP90MarineDepth: finalWater?.p90MarineDepth ?? 0,
    presentClimateDiagnosticsVersion: presentClimate?.modelVersion ?? 'missing',
    presentClimateLandCellCount: presentClimate?.landCellCount ?? 0,
    presentClimateMarineCellCount: presentClimate?.marineCellCount ?? 0,
    presentClimateMeanTemperatureC: presentClimate?.meanTemperatureC ?? 0,
    presentClimateMedianTemperatureC: presentClimate?.medianTemperatureC ?? 0,
    presentClimateP10TemperatureC: presentClimate?.p10TemperatureC ?? 0,
    presentClimateP90TemperatureC: presentClimate?.p90TemperatureC ?? 0,
    presentClimateMeanLandPrecipitation: presentClimate?.meanLandPrecipitation ?? 0,
    presentClimateMedianLandPrecipitation: presentClimate?.medianLandPrecipitation ?? 0,
    presentClimateP10LandPrecipitation: presentClimate?.p10LandPrecipitation ?? 0,
    presentClimateP90LandPrecipitation: presentClimate?.p90LandPrecipitation ?? 0,
    presentClimateLandPrecipitationStdDev: presentClimate?.landPrecipitationStdDev ?? 0,
    presentClimatePrecipitationFlatnessIndex: presentClimate?.precipitationFlatnessIndex ?? 0,
    presentClimateMeanLandWetness: presentClimate?.meanLandWetness ?? 0,
    presentClimateMedianLandWetness: presentClimate?.medianLandWetness ?? 0,
    presentClimateLandWetnessStdDev: presentClimate?.landWetnessStdDev ?? 0,
    presentClimateCoastalWetnessGradient: presentClimate?.coastalWetnessGradient ?? 0,
    presentClimateInlandAridityIndex: presentClimate?.inlandAridityIndex ?? 0,
    presentClimateRainShadowIndex: presentClimate?.rainShadowIndex ?? 0,
    presentClimateDesertRiskShare: presentClimate?.desertRiskShare ?? 0,
    presentClimateTundraRiskShare: presentClimate?.tundraRiskShare ?? 0,
    presentClimateWetlandRiskShare: presentClimate?.wetlandRiskShare ?? 0,
    presentClimateDesertWetlandOverlapShare: presentClimate?.desertWetlandOverlapShare ?? 0,
    hydrologyDiagnosticsVersion: hydrology?.modelVersion ?? 'missing',
    hydrologyClimateInputMeanPrecipitation: hydrology?.climateInputMeanPrecipitation ?? 0,
    hydrologyClimateInputWetLandShare: hydrology?.climateInputWetLandShare ?? 0,
    hydrologyClimateInputHighPrecipitationShare: hydrology?.climateInputHighPrecipitationShare ?? 0,
    hydrologyTerrainHeadwaterCandidateShare: hydrology?.terrainHeadwaterCandidateShare ?? 0,
    hydrologyTerrainHighReliefWetShare: hydrology?.terrainHighReliefWetShare ?? 0,
    hydrologyTerrainMountainHeadwaterShare: hydrology?.terrainMountainHeadwaterShare ?? 0,
    hydrologySourceCandidateCount: hydrology?.sourceCandidateCount ?? 0,
    hydrologyAcceptedRiverCount: hydrology?.acceptedRiverCount ?? 0,
    hydrologyMaximumRiverCount: hydrology?.maximumRiverCount ?? 0,
    hydrologyNamedRiverCapacityUse: hydrology?.namedRiverCapacityUse ?? 0,
    hydrologyTopologyRiverCellShare: hydrology?.topologyRiverCellShare ?? 0,
    hydrologyTopologyMinorRiverCellShare: hydrology?.topologyMinorRiverCellShare ?? 0,
    hydrologyTopologyNavigableRiverCellShare: hydrology?.topologyNavigableRiverCellShare ?? 0,
    hydrologyNamedRiverPathCellShare: hydrology?.namedRiverPathCellShare ?? 0,
    hydrologyShortRiverShare: hydrology?.shortRiverShare ?? 0,
    hydrologyMedianSourceToMouthDrop: hydrology?.medianSourceToMouthDrop ?? 0,
    hydrologyMeanRiverPathLength: hydrology?.meanRiverPathLength ?? 0,
    hydrologyMedianRiverPathLength: hydrology?.medianRiverPathLength ?? 0,
    hydrologyP90RiverPathLength: hydrology?.p90RiverPathLength ?? 0,
    hydrologyMeanSourceElevationAboveSeaLevel: hydrology?.meanSourceElevationAboveSeaLevel ?? 0,
    hydrologyMedianSourceElevationAboveSeaLevel: hydrology?.medianSourceElevationAboveSeaLevel ?? 0,
    hydrologyOceanTerminusShare: hydrology?.oceanTerminusShare ?? 0,
    hydrologyLakeTerminusShare: hydrology?.lakeTerminusShare ?? 0,
    hydrologyWetlandTerminusShare: hydrology?.wetlandTerminusShare ?? 0,
    hydrologyBasinTerminusShare: hydrology?.basinTerminusShare ?? 0,
    hydrologyLakeCellShareOfLand: hydrology?.lakeCellShareOfLand ?? 0,
    hydrologyClosedBasinShareOfLand: hydrology?.closedBasinShareOfLand ?? 0,
    hydrologyRiverDistributionEvenness: hydrology?.riverDistributionEvenness ?? 0,
    hydrologyMaxAccumulation: hydrology?.maxAccumulation ?? 0,
    hydrologyP90Accumulation: hydrology?.p90Accumulation ?? 0,
    hydrologyP99Accumulation: hydrology?.p99Accumulation ?? 0,
    biomeDiagnosticsVersion: biome?.modelVersion ?? 'missing',
    biomeLandCellCount: biome?.landCellCount ?? 0,
    biomeMarineCellCount: biome?.marineCellCount ?? 0,
    biomeTransitionDensity: biome?.transitionDensity ?? 0,
    biomeIsolatedCellShare: biome?.isolatedBiomeCellShare ?? 0,
    biomeTinyPatchCellShare: biome?.tinyPatchCellShare ?? 0,
    biomeAnnualSeasonalTemperatureSwingC: biome?.annualSeasonalTemperatureSwingC ?? 0,
    biomeLandSeasonalTemperatureSwingC: biome?.landSeasonalTemperatureSwingC ?? 0,
    biomeMeanTemperatureVarianceProxyC: biome?.meanTemperatureVarianceProxyC ?? 0,
    biomeP90TemperatureVarianceProxyC: biome?.p90TemperatureVarianceProxyC ?? 0,
    biomeLowVarianceLandShare: biome?.lowVarianceLandShare ?? 0,
    biomeHighVarianceLandShare: biome?.highVarianceLandShare ?? 0,
    biomeDesertHighWetnessShare: biome?.desertHighWetnessShare ?? 0,
    biomeRainforestLowWetnessShare: biome?.rainforestLowWetnessShare ?? 0,
    biomeForestExtremeColdShare: biome?.forestExtremeColdShare ?? 0,
    biomeWetlandUnsupportedShare: biome?.wetlandUnsupportedShare ?? 0,
    biomeWarmIceShare: biome?.warmIceShare ?? 0,
    biomeLegacyMountainBiomeShare: biome?.legacyMountainBiomeShare ?? 0,
    terrainMountainousShareOfLand: biome?.mountainousTerrainShareOfLand ?? 0,
    terrainMountainousBiomeShareIceCap: biome?.mountainousTerrainBiomeShares?.ice_cap ?? 0,
    terrainMountainousBiomeShareTundra: biome?.mountainousTerrainBiomeShares?.tundra ?? 0,
    terrainMountainousBiomeShareDesert: biome?.mountainousTerrainBiomeShares?.desert ?? 0,
    terrainMountainousBiomeShareGrassland: biome?.mountainousTerrainBiomeShares?.grassland ?? 0,
    terrainMountainousBiomeShareForest: biome?.mountainousTerrainBiomeShares?.forest ?? 0,
    terrainMountainousBiomeShareRainforest: biome?.mountainousTerrainBiomeShares?.rainforest ?? 0,
    terrainMountainousBiomeShareWetland: biome?.mountainousTerrainBiomeShares?.wetland ?? 0,
    biomeUnsupportedFindingCount: biome?.findings?.length ?? 0,
    biomeLandShareIceCap: biome?.biomeSharesOfLand?.ice_cap ?? 0,
    biomeLandShareTundra: biome?.biomeSharesOfLand?.tundra ?? 0,
    biomeLandShareDesert: biome?.biomeSharesOfLand?.desert ?? 0,
    biomeLandShareGrassland: biome?.biomeSharesOfLand?.grassland ?? 0,
    biomeLandShareForest: biome?.biomeSharesOfLand?.forest ?? 0,
    biomeLandShareRainforest: biome?.biomeSharesOfLand?.rainforest ?? 0,
    biomeLandShareWetland: biome?.biomeSharesOfLand?.wetland ?? 0,
    biomeLandShareMountain: biome?.biomeSharesOfLand?.mountain ?? 0,
    biomeClimateRegimeShareMaritime: biome?.climateRegimeSharesOfLand?.maritime ?? 0,
    biomeClimateRegimeShareContinental: biome?.climateRegimeSharesOfLand?.continental ?? 0,
    biomeClimateRegimeShareMonsoonal: biome?.climateRegimeSharesOfLand?.monsoonal ?? 0,
    biomeClimateRegimeShareAridSeasonal: biome?.climateRegimeSharesOfLand?.arid_seasonal ?? 0,
    biomeClimateRegimeShareStableTropical: biome?.climateRegimeSharesOfLand?.stable_tropical ?? 0,
    biomeClimateRegimeVarianceMaritimeC: biome?.climateRegimeMeanTemperatureVarianceProxyC?.maritime ?? 0,
    biomeClimateRegimeVarianceContinentalC: biome?.climateRegimeMeanTemperatureVarianceProxyC?.continental ?? 0,
    biomeClimateRegimeVarianceMonsoonalC: biome?.climateRegimeMeanTemperatureVarianceProxyC?.monsoonal ?? 0,
    biomeClimateRegimeVarianceAridSeasonalC: biome?.climateRegimeMeanTemperatureVarianceProxyC?.arid_seasonal ?? 0,
    biomeClimateRegimeVarianceStableTropicalC: biome?.climateRegimeMeanTemperatureVarianceProxyC?.stable_tropical ?? 0,
    agingDriftBoundaryPairs: drift?.boundaryPairs ?? 0,
    agingDriftActiveBoundaryPairs: drift?.activeBoundaryPairs ?? 0,
    agingDriftConvergentBoundaryShare: drift?.convergentBoundaryShare ?? 0,
    agingDriftDivergentBoundaryShare: drift?.divergentBoundaryShare ?? 0,
    agingDriftShearBoundaryShare: drift?.shearBoundaryShare ?? 0,
    agingDriftContinentalCollisionPairs: drift?.continentalCollisionPairs ?? 0,
    agingDriftContinentalRiftPairs: drift?.continentalRiftPairs ?? 0,
    agingDriftSubductionPairs: drift?.subductionPairs ?? 0,
    agingDriftMeanRelativePlateSpeedCmPerYear: drift?.meanRelativePlateSpeedCmPerYear ?? 0,
    agingDriftMeanCollisionVelocityCmPerYear: drift?.meanCollisionVelocityCmPerYear ?? 0,
    agingDriftMeanRiftVelocityCmPerYear: drift?.meanRiftVelocityCmPerYear ?? 0,
    agingDriftPuzzleFitPotential: drift?.puzzleFitPotential ?? 0,
    agingDriftMode: drift?.driftMode ?? 'missing',
    agingMotionLifecycleVersion: motion?.modelVersion ?? 'missing',
    agingMotionPlateCount: motion?.plateCount ?? 0,
    agingMotionMeanPlateSpeedCmPerYear: motion?.meanPlateSpeedCmPerYear ?? 0,
    agingMotionMinPlateSpeedCmPerYear: motion?.minPlateSpeedCmPerYear ?? 0,
    agingMotionMaxPlateSpeedCmPerYear: motion?.maxPlateSpeedCmPerYear ?? 0,
    agingMotionPlateSpeedStdDevCmPerYear: motion?.plateSpeedStdDevCmPerYear ?? 0,
    agingMotionDirectionResultant: motion?.directionResultant ?? 0,
    agingMotionOccupiedDirectionSectors: motion?.occupiedDirectionSectors ?? 0,
    agingMotionDrivenTerrainChangedCellShare: motion?.motionDrivenTerrainChangedCellShare ?? 0,
    agingMotionDrivenTerrainMeanAbsElevationDelta: motion?.motionDrivenTerrainMeanAbsElevationDelta ?? 0,
    agingMotionDrivenTerrainMaxAbsElevationDelta: motion?.motionDrivenTerrainMaxAbsElevationDelta ?? 0,
    agingMotionPassCount: motion?.agingMotionPassCount ?? 0,
    agingMotionChangedCellShare: motion?.agingMotionChangedCellShare ?? 0,
    agingMotionVolcanismChangedCellShare: motion?.agingMotionVolcanismChangedCellShare ?? 0,
    agingMotionMeanAbsElevationDelta: motion?.agingMotionMeanAbsElevationDelta ?? 0,
    agingMotionMaxAbsElevationDelta: motion?.agingMotionMaxAbsElevationDelta ?? 0,
    agingMotionPositiveElevationVolume: motion?.agingMotionPositiveElevationVolume ?? 0,
    agingMotionNegativeElevationVolume: motion?.agingMotionNegativeElevationVolume ?? 0,
    agingMotionConvergentBoundaryShare: motion?.agingMotionConvergentBoundaryShare ?? 0,
    agingMotionDivergentBoundaryShare: motion?.agingMotionDivergentBoundaryShare ?? 0,
    agingMotionShearBoundaryShare: motion?.agingMotionShearBoundaryShare ?? 0,
    agingMotionPlateOwnershipChangedCellShare: motion?.plateOwnershipChangedCellShareDuringAging ?? 0,
    agingMotionVectorChangedShare: motion?.plateMotionVectorChangedShareDuringAging ?? 0,
    agingMotionMeanContinentalCentroidDisplacementRadians: motion?.meanContinentalCentroidDisplacementRadians ?? 0,
    agingMotionMaxContinentalCentroidDisplacementRadians: motion?.maxContinentalCentroidDisplacementRadians ?? 0,
    plateAdvectionDiagnosticsVersion: advection?.modelVersion ?? 'missing',
    plateAdvectionPassCount: advection?.passCount ?? 0,
    plateAdvectionOwnershipChangedCellShare: advection?.ownershipChangedCellShare ?? 0,
    plateAdvectionContinentalOwnershipChangedCellShare: advection?.continentalOwnershipChangedCellShare ?? 0,
    plateAdvectionMeanOwnershipChangesPerPass: advection?.meanOwnershipChangesPerPass ?? 0,
    plateAdvectionMaxOwnershipChangesPerPass: advection?.maxOwnershipChangesPerPass ?? 0,
    plateAdvectionCoherentFrontierAdvanceShare: advection?.coherentFrontierAdvanceShare ?? 0,
    plateAdvectionOpenedOceanCellShare: advection?.openedOceanCellShare ?? 0,
    plateAdvectionCompressedBoundaryCellShare: advection?.compressedBoundaryCellShare ?? 0,
    plateAdvectionSubductedCellShare: advection?.subductedCellShare ?? 0,
    plateAdvectionYoungOceanCrustCellShare: advection?.youngOceanCrustCellShare ?? 0,
    plateAdvectionCoherentRiftCorridorCellShare: advection?.coherentRiftCorridorCellShare ?? 0,
    plateAdvectionMarginContinuityScore: advection?.marginContinuityScore ?? 0,
    plateAdvectionFragmentReleaseSuppressionCount: advection?.fragmentReleaseSuppressionCount ?? 0,
    plateAdvectionOrphanRiskCellShare: advection?.orphanRiskCellShare ?? 0,
    plateAdvectionTerrainCarriedMeanAbsElevationDelta: advection?.terrainCarriedMeanAbsElevationDelta ?? 0,
    plateAdvectionTerrainCarriedMaxAbsElevationDelta: advection?.terrainCarriedMaxAbsElevationDelta ?? 0,
    plateAdvectionVolcanismCarriedCellShare: advection?.volcanismCarriedCellShare ?? 0,
    fragmentHistoryVersion: fragmentHistory?.modelVersion ?? 'missing',
    fragmentHistoryFragmentCount: fragmentHistory?.fragmentCount ?? 0,
    fragmentHistoryContinentalCellShare: fragmentHistory?.continentalCellShare ?? 0,
    fragmentHistoryLargestFragmentShareOfContinental: fragmentHistory?.largestFragmentShareOfContinental ?? 0,
    fragmentHistoryMeanFragmentCellCount: fragmentHistory?.meanFragmentCellCount ?? 0,
    fragmentHistoryBoundaryCellShareOfContinental: fragmentHistory?.boundaryCellShareOfContinental ?? 0,
    fragmentHistoryKeyframedFragmentSampleCount: fragmentHistory?.keyframedFragmentSampleCount ?? 0,
    fragmentHistoryMeanProjectedFragmentDisplacementRadians: fragmentHistory?.meanProjectedFragmentDisplacementRadians ?? 0,
    fragmentHistoryMaxProjectedFragmentDisplacementRadians: fragmentHistory?.maxProjectedFragmentDisplacementRadians ?? 0,
    fragmentHistoryCollisionEventCandidatePairs: fragmentHistory?.collisionEventCandidatePairs ?? 0,
    fragmentHistoryRiftSplitCandidateFragments: fragmentHistory?.riftSplitCandidateFragments ?? 0,
    fragmentHistoryTerrainResponseApplied: fragmentHistory?.terrainResponseApplied ? 1 : 0,
    fragmentHistoryTerrainResponseScale: fragmentHistory?.terrainResponseScale ?? 0,
    fragmentHistoryTerrainResponseCellShare: fragmentHistory?.terrainResponseCellShare ?? 0,
    fragmentHistoryUpliftResponseCellShare: fragmentHistory?.upliftResponseCellShare ?? 0,
    fragmentHistorySubsidenceResponseCellShare: fragmentHistory?.subsidenceResponseCellShare ?? 0,
    fragmentHistoryMarginToneResponseCellShare: fragmentHistory?.marginToneResponseCellShare ?? 0,
    fragmentHistoryEstimatedPositiveReliefVolume: fragmentHistory?.estimatedPositiveReliefVolume ?? 0,
    fragmentHistoryEstimatedNegativeReliefVolume: fragmentHistory?.estimatedNegativeReliefVolume ?? 0,
    fragmentHistoryMeanAbsTerrainResponseDelta: fragmentHistory?.meanAbsTerrainResponseDelta ?? 0,
    fragmentHistoryMaxTerrainResponseDelta: fragmentHistory?.maxTerrainResponseDelta ?? 0,
    fragmentHistoryVolcanismResponseApplied: fragmentHistory?.volcanismResponseApplied ? 1 : 0,
    fragmentHistoryVolcanismResponseScale: fragmentHistory?.volcanismResponseScale ?? 0,
    fragmentHistoryVolcanismResponseCellShare: fragmentHistory?.volcanismResponseCellShare ?? 0,
    fragmentHistoryMeanVolcanismResponseDelta: fragmentHistory?.meanVolcanismResponseDelta ?? 0,
    fragmentHistoryMaxVolcanismResponseDelta: fragmentHistory?.maxVolcanismResponseDelta ?? 0,
    fragmentHistoryCollisionCandidateCellShare: fragmentHistory?.collisionCandidateCellShare ?? 0,
    fragmentHistoryRiftCandidateCellShare: fragmentHistory?.riftCandidateCellShare ?? 0,
    fragmentHistoryTransformCandidateCellShare: fragmentHistory?.transformCandidateCellShare ?? 0,
    fragmentHistorySubductionCandidateCellShare: fragmentHistory?.subductionCandidateCellShare ?? 0,
    fragmentHistoryTrenchCandidateCellShare: fragmentHistory?.trenchCandidateCellShare ?? 0,
    fragmentHistoryConjugateMarginCandidatePairs: fragmentHistory?.conjugateMarginCandidatePairs ?? 0,
    fragmentHistoryConjugateMarginCandidateShare: fragmentHistory?.conjugateMarginCandidateShare ?? 0,
    fragmentHistoryPuzzleFitScore: fragmentHistory?.puzzleFitScore ?? 0,
    fragmentHistoryCoherentFragmentScore: fragmentHistory?.coherentFragmentScore ?? 0,
    fragmentHistoryMotionEventScore: fragmentHistory?.motionEventScore ?? 0,
    agingImpactTotalOpportunities: impactHistory?.totalOpportunities ?? 0,
    agingImpactAppliedEvents: impactHistory?.appliedEvents ?? 0,
    agingImpactRetainedEvents: impactHistory?.retainedEvents ?? 0,
    agingImpactVisibleEvents: impactHistory?.visibleEvents ?? 0,
    agingImpactEarlyEventShare: impactHistory?.earlyEventShare ?? 0,
    agingImpactLateEventShare: impactHistory?.lateEventShare ?? 0,
    agingImpactMeanEventAgeMy: impactHistory?.meanEventAgeMy ?? 0,
    agingImpactMeanOriginalStrength: impactHistory?.meanOriginalStrength ?? 0,
    agingImpactMeanSurvivingRelief: impactHistory?.meanSurvivingRelief ?? 0,
    agingImpactMeanSurvivalRatio: impactHistory?.meanSurvivalRatio ?? 0,
    agingStableDryImpactRetentionIndex: impactHistory?.stableDryRetentionIndex ?? 0,
    agingWetActiveImpactErosionIndex: impactHistory?.wetActiveErosionIndex ?? 0,
    agingImpactHardCap: impactHistory?.hardCap ?? 0,
    agingSystemAgeGy: historical?.systemAgeGy ?? 0,
    agingAgeBand: historical?.ageBand ?? 'missing',
    agingEpochCount: historical?.epochCount ?? 0,
    agingEarlyImpactIntensityShare: historical?.earlyImpactIntensityShare ?? 0,
    agingLateImpactIntensityShare: historical?.lateImpactIntensityShare ?? 0,
    agingImpactGainVolumeHistorical: historical?.impactGainVolume ?? 0,
    agingImpactLossVolumeHistorical: historical?.impactLossVolume ?? 0,
    agingImpactNetExcavationVolume: historical?.impactNetExcavationVolume ?? 0,
    agingImpactEjectaReturnRatio: historical?.impactEjectaReturnRatio ?? 0,
    agingImpactOperationsPerGy: historical?.impactOperationsPerGy ?? 0,
    agingImpactLossPerGy: historical?.impactLossPerGy ?? 0,
    agingImpactLifetimeTargetOperations: historical?.impactLifetimeTargetOperations ?? 0,
    agingImpactLifetimeOperationRatio: historical?.impactLifetimeOperationRatio ?? 0,
    agingTectonicGainPerGy: historical?.tectonicGainPerGy ?? 0,
    agingWeatheringLossPerGy: historical?.weatheringLossPerGy ?? 0,
    agingGlacialLossPerGy: historical?.glacialLossPerGy ?? 0,
    agingCoastalLossPerGy: historical?.coastalLossPerGy ?? 0,
    agingGeothermalFlux: historical?.geothermalFlux ?? 0,
    agingMeanPlateSpeedHistorical: historical?.meanPlateSpeed ?? 0,
    agingVolcanismBoundaryRetentionFactor: historical?.volcanismBoundaryRetentionFactor ?? 0,
    agingVolcanismInteriorRetentionFactor: historical?.volcanismInteriorRetentionFactor ?? 0,
    agingVolcanismBoundaryFloor: historical?.volcanismBoundaryFloor ?? 0,
    agingVolcanismInteriorFloor: historical?.volcanismInteriorFloor ?? 0,
    agingVolcanismChangedCells: historical?.volcanismChangedCells ?? 0,
    agingVolcanismIncreasedCells: historical?.volcanismIncreasedCells ?? 0,
    agingVolcanismDecreasedCells: historical?.volcanismDecreasedCells ?? 0,
    agingVolcanismUnchangedCells: historical?.volcanismUnchangedCells ?? 0,
    agingPreVolcanismMean: preVolcanism?.mean ?? 0,
    agingPreVolcanismActiveShare: preVolcanism?.activeShare ?? 0,
    agingPreBoundaryVolcanismMean: preVolcanism?.boundaryMean ?? 0,
    agingPreInteriorVolcanismMean: preVolcanism?.interiorMean ?? 0,
    agingPreBoundaryVolcanismRatio: preVolcanism?.boundaryToInteriorRatio ?? 0,
    agingFinalVolcanismMean: finalVolcanism?.mean ?? 0,
    agingFinalVolcanismActiveShare: finalVolcanism?.activeShare ?? 0,
    agingFinalBoundaryVolcanismMean: finalVolcanism?.boundaryMean ?? 0,
    agingFinalInteriorVolcanismMean: finalVolcanism?.interiorMean ?? 0,
    agingFinalBoundaryVolcanismRatio: finalVolcanism?.boundaryToInteriorRatio ?? 0,
    agingVolcanismMeanDelta: historical?.volcanismMeanDelta ?? 0,
    agingVolcanismActiveShareDelta: historical?.volcanismActiveShareDelta ?? 0,
    agingVolcanismBoundaryMeanDelta: historical?.volcanismBoundaryMeanDelta ?? 0,
    agingVolcanismInteriorMeanDelta: historical?.volcanismInteriorMeanDelta ?? 0,
    ...fields('TectonicGain', ledger?.tectonicGain),
    ...fields('ImpactGain', ledger?.impactGain),
    ...fields('ImpactLoss', ledger?.impactLoss),
    ...fields('WeatheringLoss', ledger?.weatheringLoss),
    ...fields('GlacialLoss', ledger?.glacialLoss),
    ...fields('CoastalLoss', ledger?.coastalLoss),
    ...fields('SedimentGain', ledger?.sedimentGain)
  };
}
