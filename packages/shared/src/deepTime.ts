import type { WorldProject } from './index';

export type StellarActivityClass = 'quiet' | 'moderate' | 'active' | 'flare-active';

export type StellarModel = {
  spectralClass: string;
  luminosityClass: string;
  effectiveTemperatureK: number;
  massSolar: number;
  radiusSolar: number;
  luminositySolar: number;
  ageGy: number;
  metallicity: number;
  activityClass: StellarActivityClass;
  cyclePeriodYears: number;
  cycleAmplitude: number;
  flareFrequency: number;
  habitableZoneInnerAu: number;
  habitableZoneOuterAu: number;
};

export type PlanetaryDynamicsModel = {
  massEarth: number;
  radiusEarth: number;
  densityEarth: number;
  surfaceGravityG: number;
  rotationPeriodHours: number;
  orbitalPeriodDays: number;
  semiMajorAxisAu: number;
  eccentricityMean: number;
  eccentricityAmplitude: number;
  eccentricityPeriodYears: number;
  obliquityMeanDeg: number;
  obliquityAmplitudeDeg: number;
  obliquityPeriodYears: number;
  axialPrecessionPeriodYears: number;
  apsidalPrecessionPeriodYears: number;
  precessionPhase: number;
  geothermalFlux: number;
  radiogenicHeatFraction: number;
  coreHeatFraction: number;
  magneticFieldStrengthEarth: number;
  atmosphericRetention: number;
};

export type Craton = {
  id: string;
  plateId: number;
  ageGy: number;
  stability: number;
  lithosphereThickness: number;
  buoyancy: number;
  erosionResistance: number;
  riftSusceptibility: number;
  cellCount: number;
  sampleCells: number[];
};

export type AgingEpoch = {
  index: number;
  startAgeMy: number;
  endAgeMy: number;
  durationMy: number;
  tectonicIterations: number;
  impactIntensity: number;
  climateSamples: number;
  erosionIterations: number;
  glacialIterations: number;
  coastalIterations: number;
};

export type OrbitalForcingSample = {
  epochIndex: number;
  eccentricity: number;
  obliquityDeg: number;
  precessionIndex: number;
  stellarCycleIndex: number;
  highLatitudeSummerInsolation: number;
  seasonalContrast: number;
  glaciationPressure: number;
  deglaciationPressure: number;
  moistureTransportModifier: number;
  iceAlbedoFeedbackStrength: number;
};

export type SurfaceConsistencyDiagnostics = {
  waterMaskCorrections: number;
  topologyWaterMaskCorrections: number;
  biomeCorrections: number;
  invalidRiverCellsCleared: number;
  riverPathsTrimmed: number;
  oceanPercentage: number;
  climateCellsRefreshed: number;
  hydrologyCellsRebuilt: number;
  projectedCellsRefreshed: number;
  findings: string[];
};

export type DeepTimeImpactEvent = {
  id: string;
  centerCell: number;
  epochIndex: number;
  eventAgeMy: number;
  radiusCells: number;
  originalStrength: number;
  survivingRelief: number;
  survivalRatio: number;
  erosionResistance: number;
  wetness: number;
  boundaryActivity: number;
  waterAtImpact: boolean;
};

export type DeepTimeImpactHistoryDiagnostics = {
  modelVersion: 'deep-time-impact-history-v1';
  totalOpportunities: number;
  appliedEvents: number;
  retainedEvents: number;
  visibleEvents: number;
  earlyEventShare: number;
  lateEventShare: number;
  meanEventAgeMy: number;
  meanOriginalStrength: number;
  meanSurvivingRelief: number;
  meanSurvivalRatio: number;
  stableDryRetentionIndex: number;
  wetActiveErosionIndex: number;
  hardCap: number;
  events: DeepTimeImpactEvent[];
};

export type DeepTimeContinentalDriftDiagnostics = {
  modelVersion: 'continental-drift-diagnostics-v1';
  boundaryPairs: number;
  activeBoundaryPairs: number;
  convergentBoundaryShare: number;
  divergentBoundaryShare: number;
  shearBoundaryShare: number;
  continentalCollisionPairs: number;
  continentalRiftPairs: number;
  subductionPairs: number;
  meanRelativePlateSpeedCmPerYear: number;
  meanCollisionVelocityCmPerYear: number;
  meanRiftVelocityCmPerYear: number;
  puzzleFitPotential: number;
  driftMode: 'stagnant' | 'subtle' | 'active' | 'hyperactive';
  notes: string[];
};

export type DeepTimeFragmentPlacementDiagnostics = {
  modelVersion: 'fragment-placement-v1';
  fragmentCount: number;
  movingFragmentCount: number;
  resolvedRecordShare: number;
  sourceCellCount: number;
  targetCellCount: number;
  sourceCellShare: number;
  targetCellShare: number;
  retainedCellRatio: number;
  directPlacementCellShare: number;
  collisionCellShare: number;
  collisionResolvedCellShare: number;
  mergedCollisionCellShare: number;
  vacatedSourceCellShare: number;
  youngOceanCrustCellShare: number;
  ownershipChangedCellShare: number;
  meanDisplacementRadians: number;
  maxDisplacementRadians: number;
  notes: string[];
};

export type DeepTimeFragmentKeyframe = {
  keyframeIndex: number;
  ageFraction: number;
  longitudeRadians: number;
  latitudeRadians: number;
};

export type DeepTimeFragmentHistoryRecord = {
  fragmentId: number;
  parentSeedId: number | null;
  plateId: number;
  cellCount: number;
  keyframes: DeepTimeFragmentKeyframe[];
};

export type DeepTimeConjugateMarginHistoryRecord = {
  fragmentAId: number;
  fragmentBId: number;
  probeCount: number;
};

export type DeepTimeFragmentHistoryDiagnostics = {
  modelVersion: 'fragment-history-diagnostics-v13';
  fragmentCount: number;
  continentalCellShare: number;
  largestFragmentShareOfContinental: number;
  meanFragmentCellCount: number;
  boundaryCellShareOfContinental: number;
  keyframedFragmentSampleCount: number;
  storedLineageSeedCount: number;
  resolvedParentShare: number;
  fragmentKeyframeCount: number;
  fragmentHistoryRecords: DeepTimeFragmentHistoryRecord[];
  conjugateMarginHistoryRecords: DeepTimeConjugateMarginHistoryRecord[];
  historyDrivenPairEvaluations: number;
  historyDrivenEventCellShare: number;
  historyDrivenCollisionCellShare: number;
  historyDrivenRiftCellShare: number;
  historyDrivenConjugateMarginCellShare: number;
  directTransformResolvedRecordShare: number;
  directTransformSourceCellShare: number;
  directTransformTargetCellShare: number;
  directTransformCollisionCellShare: number;
  surfaceAgingSampleCount: number;
  meanProjectedFragmentDisplacementRadians: number;
  maxProjectedFragmentDisplacementRadians: number;
  collisionEventCandidatePairs: number;
  riftSplitCandidateFragments: number;
  terrainResponseApplied: boolean;
  terrainResponseScale: number;
  terrainResponseCellShare: number;
  upliftResponseCellShare: number;
  subsidenceResponseCellShare: number;
  marginToneResponseCellShare: number;
  estimatedPositiveReliefVolume: number;
  estimatedNegativeReliefVolume: number;
  meanAbsTerrainResponseDelta: number;
  maxTerrainResponseDelta: number;
  volcanismResponseApplied: boolean;
  volcanismResponseScale: number;
  volcanismResponseCellShare: number;
  meanVolcanismResponseDelta: number;
  maxVolcanismResponseDelta: number;
  collisionCandidateCellShare: number;
  riftCandidateCellShare: number;
  transformCandidateCellShare: number;
  subductionCandidateCellShare: number;
  trenchCandidateCellShare: number;
  conjugateMarginCandidatePairs: number;
  conjugateMarginCandidateShare: number;
  puzzleFitScore: number;
  coherentFragmentScore: number;
  motionEventScore: number;
  notes: string[];
};

export type FinalWaterDiagnostics = {
  modelVersion: 'final-water-diagnostics-v1';
  targetOceanPercentage: number;
  actualOceanPercentage: number;
  oceanErrorPercentagePoints: number;
  seaLevel: number;
  topologyWaterMaskCorrections: number;
  marineDepthAdjustedCells: number;
  marineCellCount: number;
  lakeCellCount: number;
  coastCellShare: number;
  coastlineSharpnessIndex: number;
  nearSeaLevelBandShare: number;
  immediateShelfShareOfMarine: number;
  continentalShelfShareOfMarine: number;
  shallowSeaShareOfMarine: number;
  oceanShareOfMarine: number;
  deepOceanShareOfMarine: number;
  broadShelfAwayFromCoastShare: number;
  meanMarineDepth: number;
  medianMarineDepth: number;
  p90MarineDepth: number;
  notes: string[];
};

export type PresentClimateDiagnostics = {
  modelVersion: 'present-climate-diagnostics-v1';
  landCellCount: number;
  marineCellCount: number;
  meanTemperatureC: number;
  medianTemperatureC: number;
  p10TemperatureC: number;
  p90TemperatureC: number;
  meanLandPrecipitation: number;
  medianLandPrecipitation: number;
  p10LandPrecipitation: number;
  p90LandPrecipitation: number;
  landPrecipitationStdDev: number;
  precipitationFlatnessIndex: number;
  meanLandWetness: number;
  medianLandWetness: number;
  landWetnessStdDev: number;
  coastalWetnessGradient: number;
  inlandAridityIndex: number;
  rainShadowIndex: number;
  orographicLiftMean: number;
  orographicShadowMean: number;
  desertRiskShare: number;
  tundraRiskShare: number;
  wetlandRiskShare: number;
  desertWetlandOverlapShare: number;
  notes: string[];
};

export type HydrologyDiagnostics = {
  modelVersion: 'hydrology-diagnostics-v1';
  landCellCount: number;
  climateInputMeanPrecipitation: number;
  climateInputWetLandShare: number;
  climateInputHighPrecipitationShare: number;
  terrainHeadwaterCandidateShare: number;
  terrainHighReliefWetShare: number;
  terrainMountainHeadwaterShare: number;
  sourceCandidateCount: number;
  acceptedRiverCount: number;
  maximumRiverCount: number;
  namedRiverCapacityUse: number;
  topologyRiverCellShare: number;
  topologyMinorRiverCellShare: number;
  topologyNavigableRiverCellShare: number;
  namedRiverPathCellShare: number;
  shortRiverShare: number;
  medianSourceToMouthDrop: number;
  meanRiverPathLength: number;
  medianRiverPathLength: number;
  p90RiverPathLength: number;
  meanSourceElevationAboveSeaLevel: number;
  medianSourceElevationAboveSeaLevel: number;
  meanMouthElevationAboveSeaLevel: number;
  oceanTerminusShare: number;
  lakeTerminusShare: number;
  wetlandTerminusShare: number;
  basinTerminusShare: number;
  lakeCellShareOfLand: number;
  closedBasinShareOfLand: number;
  riverDistributionEvenness: number;
  maxAccumulation: number;
  p90Accumulation: number;
  p99Accumulation: number;
  notes: string[];
};

export type DeepTimeDiagnostics = {
  modelVersion: 'deep-time-foundation-v3';
  epochs: AgingEpoch[];
  forcingSamples: OrbitalForcingSample[];
  cratons: Craton[];
  persistentIceCells: number;
  glaciallyErodedCells: number;
  floodedValleyCells: number;
  coastalAdjustedCells: number;
  tectonicAdjustedCells: number;
  impactAdjustedCells: number;
  weatheredCells: number;
  impactHistory: DeepTimeImpactHistoryDiagnostics;
  continentalDrift?: DeepTimeContinentalDriftDiagnostics;
  fragmentPlacement?: DeepTimeFragmentPlacementDiagnostics;
  fragmentHistory?: DeepTimeFragmentHistoryDiagnostics;
  finalWater: FinalWaterDiagnostics;
  presentClimate: PresentClimateDiagnostics;
  hydrology: HydrologyDiagnostics;
  consistency: SurfaceConsistencyDiagnostics;
  notes: string[];
};

export type DeepTimeWorldProject = WorldProject & {
  solarSystem: WorldProject['solarSystem'] & {
    stellarModel: StellarModel;
  };
  primaryWorld: WorldProject['primaryWorld'] & {
    planetaryDynamics: PlanetaryDynamicsModel;
    geology: {
      cratons: Craton[];
    };
    deepTime: DeepTimeDiagnostics;
  };
};

export type DeepTimeProject = DeepTimeWorldProject;
