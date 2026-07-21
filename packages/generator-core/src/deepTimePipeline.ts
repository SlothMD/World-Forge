import {
  biomeNames,
  biomeToCode,
  buildCubedSphereTopology,
  clamp,
  codeToBiome,
  cubedSphereCellForLonLat,
  type Biome,
  type CubedSphereTopology,
  type GenerationConfig,
  type River,
  type WorldProject
} from '@world-forge/shared';
import { generateProject, type GenerateProjectOptions } from './index';
import { applyBasinAwareCirculation } from './basinCirculation';
import {
  buildRotationBetweenUnitVectors,
  buildTangentSphericalRotation,
  rotateUnitVector,
  unitVectorToLonLat
} from './fragmentSphericalTransform';

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

export type DeepTimeProgress = {
  phase: 'initializing' | 'epoch' | 'reconciling' | 'complete';
  progress: number;
  message: string;
  epochIndex?: number;
  epochCount?: number;
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

export type DeepTimeProject = WorldProject & {
  solarSystem: WorldProject['solarSystem'] & { stellarModel: StellarModel };
  primaryWorld: WorldProject['primaryWorld'] & {
    planetaryDynamics: PlanetaryDynamicsModel;
    geology: { cratons: Craton[] };
    deepTime: DeepTimeDiagnostics;
  };
};

type RandomSource = { next: () => number; range: (min: number, max: number) => number; int: (min: number, max: number) => number };

type AgingCounters = {
  iceCells: number;
  eroded: number;
  flooded: number;
  coastal: number;
  tectonic: number;
  impacts: number;
  weathered: number;
};

type ImpactHistoryAccumulator = {
  totalOpportunities: number;
  appliedEvents: number;
  retainedEvents: number;
  visibleEvents: number;
  hardCap: number;
  eventAgeMySum: number;
  originalStrengthSum: number;
  survivingReliefSum: number;
  survivalRatioSum: number;
  earlyEvents: number;
  lateEvents: number;
  stableDryRetentionSum: number;
  stableDryRetentionCount: number;
  wetActiveErosionSum: number;
  wetActiveErosionCount: number;
  events: DeepTimeImpactEvent[];
};

type PlateLookup = {
  kind: Uint8Array;
  motionX: number[];
  motionY: number[];
};

function createPlateLookup(plates: DeepTimeProject['primaryWorld']['plates']): PlateLookup {
  const maxId = plates.reduce((max, plate) => Math.max(max, plate.id), 0);
  const kind = new Uint8Array(maxId + 1);
  const motionX = new Array<number>(maxId + 1).fill(0);
  const motionY = new Array<number>(maxId + 1).fill(0);
  for (const plate of plates) {
    kind[plate.id] = plate.kind === 'continental' ? 1 : 2;
    motionX[plate.id] = plate.motionX;
    motionY[plate.id] = plate.motionY;
  }
  return { kind, motionX, motionY };
}

function createPlateResistanceLookup(resistance: Map<number, number>, plates: DeepTimeProject['primaryWorld']['plates']): number[] {
  const maxId = plates.reduce((max, plate) => Math.max(max, plate.id), 0);
  const lookup = new Array<number>(maxId + 1).fill(0.5);
  for (const plate of plates) lookup[plate.id] = resistance.get(plate.id) ?? 0.5;
  return lookup;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomSource(seed: string): RandomSource {
  let state = hashSeed(seed) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next())
  };
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function buildStellarModel(project: WorldProject, rng: RandomSource): StellarModel {
  const rawClass = project.solarSystem.star.type.charAt(0).toUpperCase();
  const spectralClass = ['F', 'G', 'K'].includes(rawClass) ? rawClass : 'G';
  const base = spectralClass === 'F'
    ? { temperature: 6750, mass: 1.28, radius: 1.32, luminosity: 2.55 }
    : spectralClass === 'K'
      ? { temperature: 5050, mass: 0.78, radius: 0.76, luminosity: 0.42 }
      : { temperature: 5772, mass: 1, radius: 1, luminosity: 1 };
  const ageGy = project.solarSystem.ageGy;
  const activityScore = clamp(1.25 - ageGy / 7.5 + rng.range(-0.16, 0.16), 0, 1.4);
  const activityClass: StellarActivityClass = activityScore > 1.05 ? 'flare-active' : activityScore > 0.76 ? 'active' : activityScore > 0.42 ? 'moderate' : 'quiet';
  const luminositySolar = base.luminosity * rng.range(0.92, 1.08);
  const habitableScale = Math.sqrt(luminositySolar);
  return {
    spectralClass: `${spectralClass}${Math.max(0, Math.min(9, Math.round(rng.range(1, 8))))}`,
    luminosityClass: project.solarSystem.star.luminosityClass || 'V',
    effectiveTemperatureK: Math.round(base.temperature * rng.range(0.975, 1.025)),
    massSolar: round(base.mass * rng.range(0.96, 1.04)),
    radiusSolar: round(base.radius * rng.range(0.96, 1.04)),
    luminositySolar: round(luminositySolar),
    ageGy,
    metallicity: round(rng.range(-0.28, 0.22), 2),
    activityClass,
    cyclePeriodYears: round(rng.range(7, 16), 1),
    cycleAmplitude: round(clamp(activityScore * rng.range(0.006, 0.025), 0.002, 0.04), 4),
    flareFrequency: round(activityScore * rng.range(0.15, 1.2), 3),
    habitableZoneInnerAu: round(0.95 * habitableScale),
    habitableZoneOuterAu: round(1.67 * habitableScale)
  };
}

function buildPlanetaryDynamics(project: WorldProject, stellar: StellarModel, rng: RandomSource): PlanetaryDynamicsModel {
  const world = project.primaryWorld;
  const primaryBody = project.solarSystem.bodies.find((body) => body.isPrimaryWorld);
  const radiusEarth = clamp(world.sizeClass, 0.45, 2.2);
  const massEarth = clamp(world.massClass, 0.25, 6);
  const densityEarth = massEarth / Math.max(0.01, radiusEarth ** 3);
  const semiMajorAxisAu = clamp(primaryBody?.orbitalDistanceClass ?? Math.sqrt(stellar.luminositySolar), 0.25, 6);
  return {
    massEarth: round(massEarth),
    radiusEarth: round(radiusEarth),
    densityEarth: round(densityEarth),
    surfaceGravityG: round(massEarth / Math.max(0.05, radiusEarth ** 2)),
    rotationPeriodHours: round(rng.range(18, 34), 2),
    orbitalPeriodDays: round(365.256 * Math.sqrt(semiMajorAxisAu ** 3 / stellar.massSolar), 2),
    semiMajorAxisAu: round(semiMajorAxisAu),
    eccentricityMean: round(world.orbitalEccentricity, 4),
    eccentricityAmplitude: round(rng.range(0.006, 0.045), 4),
    eccentricityPeriodYears: Math.round(rng.range(70000, 130000)),
    obliquityMeanDeg: round(world.axialTiltDeg, 3),
    obliquityAmplitudeDeg: round(rng.range(0.8, 3.8), 3),
    obliquityPeriodYears: Math.round(rng.range(36000, 48000)),
    axialPrecessionPeriodYears: Math.round(rng.range(21000, 29000)),
    apsidalPrecessionPeriodYears: Math.round(rng.range(90000, 140000)),
    precessionPhase: round(rng.next(), 4),
    geothermalFlux: round(clamp(0.35 - project.selectedValues.systemAgeGy * 0.035 + rng.range(0.08, 0.4), 0.12, 0.95)),
    radiogenicHeatFraction: round(rng.range(0.35, 0.68)),
    coreHeatFraction: round(rng.range(0.32, 0.65)),
    magneticFieldStrengthEarth: round(clamp(massEarth / radiusEarth * rng.range(0.55, 1.45), 0.05, 3)),
    atmosphericRetention: round(clamp((massEarth / radiusEarth) * (1 - stellar.flareFrequency * 0.08), 0.15, 1.5))
  };
}

function buildEpochs(ageGy: number): AgingEpoch[] {
  const totalMy = Math.max(250, ageGy * 1000);
  const fractions = [0.08, 0.12, 0.16, 0.2, 0.22, 0.22];
  let cursor = 0;
  return fractions.map((fraction, index) => {
    const durationMy = totalMy * fraction;
    const startAgeMy = cursor;
    cursor += durationMy;
    const maturity = index / Math.max(1, fractions.length - 1);
    return {
      index,
      startAgeMy: round(startAgeMy, 1),
      endAgeMy: round(cursor, 1),
      durationMy: round(durationMy, 1),
      tectonicIterations: index < 3 ? 3 : 2,
      impactIntensity: round((1 - maturity) ** 2, 3),
      climateSamples: index < 2 ? 1 : 3,
      erosionIterations: index < 2 ? 1 : 2,
      glacialIterations: index < 3 ? 0 : 2,
      coastalIterations: index < 4 ? 0 : 2
    };
  });
}

function buildCratons(project: WorldProject, rng: RandomSource): Craton[] {
  const world = project.primaryWorld;
  const continentalIds = new Set(world.plates.filter((plate) => plate.kind === 'continental').map((plate) => plate.id));
  const cellsByPlate = new Map<number, number[]>();
  for (let cell = 0; cell < world.topologyLayers.plates.length; cell += 1) {
    const plateId = world.topologyLayers.plates[cell];
    if (!continentalIds.has(plateId) || world.topologyLayers.elevation[cell] <= world.seaLevel + 0.04) continue;
    const cells = cellsByPlate.get(plateId) ?? [];
    if (cells.length < 4096) cells.push(cell);
    cellsByPlate.set(plateId, cells);
  }
  return [...cellsByPlate.entries()].map(([plateId, sampleCells], index) => {
    const stability = rng.range(0.72, 0.98);
    return {
      id: `craton-${index + 1}`,
      plateId,
      ageGy: round(clamp(project.selectedValues.systemAgeGy * rng.range(0.55, 0.95), 0.4, project.selectedValues.systemAgeGy), 2),
      stability: round(stability),
      lithosphereThickness: round(rng.range(1.15, 1.75)),
      buoyancy: round(rng.range(0.18, 0.52)),
      erosionResistance: round(clamp(stability * rng.range(0.78, 1.08), 0.5, 1)),
      riftSusceptibility: round(clamp(1 - stability + rng.range(0, 0.16), 0.04, 0.42)),
      cellCount: sampleCells.length,
      sampleCells
    };
  });
}

function orbitalForcing(dynamics: PlanetaryDynamicsModel, stellar: StellarModel, epoch: AgingEpoch, sampleIndex: number): OrbitalForcingSample {
  const timeYears = (epoch.startAgeMy + epoch.durationMy * ((sampleIndex + 0.5) / Math.max(1, epoch.climateSamples))) * 1_000_000;
  const eccentricity = clamp(dynamics.eccentricityMean + Math.sin((timeYears / dynamics.eccentricityPeriodYears) * Math.PI * 2) * dynamics.eccentricityAmplitude, 0, 0.35);
  const obliquityDeg = clamp(dynamics.obliquityMeanDeg + Math.sin((timeYears / dynamics.obliquityPeriodYears) * Math.PI * 2) * dynamics.obliquityAmplitudeDeg, 0, 55);
  const precessionIndex = Math.sin((timeYears / dynamics.axialPrecessionPeriodYears + dynamics.precessionPhase) * Math.PI * 2);
  const stellarCycleIndex = Math.sin((timeYears / stellar.cyclePeriodYears) * Math.PI * 2) * stellar.cycleAmplitude;
  const obliquityCooling = clamp((24 - obliquityDeg) / 18, -0.6, 1.1);
  const highLatitudeSummerInsolation = clamp(1 - obliquityCooling * 0.22 + precessionIndex * eccentricity * 0.8 + stellarCycleIndex, 0.55, 1.4);
  const glaciationPressure = clamp((1.04 - highLatitudeSummerInsolation) * 1.8 + obliquityCooling * 0.35, 0, 1);
  return {
    epochIndex: epoch.index,
    eccentricity: round(eccentricity, 4),
    obliquityDeg: round(obliquityDeg, 3),
    precessionIndex: round(precessionIndex, 4),
    stellarCycleIndex: round(stellarCycleIndex, 5),
    highLatitudeSummerInsolation: round(highLatitudeSummerInsolation, 4),
    seasonalContrast: round(clamp(obliquityDeg / 35 + eccentricity * 2.2, 0.2, 1.6), 4),
    glaciationPressure: round(glaciationPressure, 4),
    deglaciationPressure: round(clamp(1 - glaciationPressure, 0, 1), 4),
    moistureTransportModifier: round(clamp(0.86 + obliquityDeg / 90 + eccentricity * 0.5, 0.75, 1.3), 4),
    iceAlbedoFeedbackStrength: round(clamp(0.35 + glaciationPressure * 0.5, 0.3, 0.9), 4)
  };
}

function cratonResistanceByPlate(cratons: Craton[]): Map<number, number> {
  return new Map(cratons.map((craton) => [craton.plateId, craton.erosionResistance]));
}

function createImpactHistory(): ImpactHistoryAccumulator {
  return {
    totalOpportunities: 0,
    appliedEvents: 0,
    retainedEvents: 0,
    visibleEvents: 0,
    hardCap: 0,
    eventAgeMySum: 0,
    originalStrengthSum: 0,
    survivingReliefSum: 0,
    survivalRatioSum: 0,
    earlyEvents: 0,
    lateEvents: 0,
    stableDryRetentionSum: 0,
    stableDryRetentionCount: 0,
    wetActiveErosionSum: 0,
    wetActiveErosionCount: 0,
    events: []
  };
}

function finalizeImpactHistory(history: ImpactHistoryAccumulator, totalMy: number): DeepTimeImpactHistoryDiagnostics {
  const applied = Math.max(1, history.appliedEvents);
  return {
    modelVersion: 'deep-time-impact-history-v1',
    totalOpportunities: history.totalOpportunities,
    appliedEvents: history.appliedEvents,
    retainedEvents: history.retainedEvents,
    visibleEvents: history.visibleEvents,
    earlyEventShare: round(history.earlyEvents / applied, 4),
    lateEventShare: round(history.lateEvents / applied, 4),
    meanEventAgeMy: round(history.eventAgeMySum / applied, 2),
    meanOriginalStrength: round(history.originalStrengthSum / applied, 6),
    meanSurvivingRelief: round(history.survivingReliefSum / applied, 6),
    meanSurvivalRatio: round(history.survivalRatioSum / applied, 4),
    stableDryRetentionIndex: round(history.stableDryRetentionSum / Math.max(1, history.stableDryRetentionCount), 4),
    wetActiveErosionIndex: round(history.wetActiveErosionSum / Math.max(1, history.wetActiveErosionCount), 4),
    hardCap: history.hardCap,
    events: history.events.map((event) => ({
      ...event,
      eventAgeMy: round(event.eventAgeMy, 2),
      originalStrength: round(event.originalStrength, 6),
      survivingRelief: round(event.survivingRelief, 6),
      survivalRatio: round(event.survivalRatio, 4),
      erosionResistance: round(event.erosionResistance, 4),
      wetness: round(event.wetness, 4),
      boundaryActivity: round(event.boundaryActivity, 4)
    })).sort((left, right) => right.eventAgeMy - left.eventAgeMy).slice(0, Math.min(512, Math.max(64, Math.round(totalMy / 12))))
  };
}

function applyAgeScaledImpacts(
  project: DeepTimeProject,
  topology: CubedSphereTopology,
  epoch: AgingEpoch,
  rng: RandomSource,
  cratonResistance: Map<number, number>,
  history: ImpactHistoryAccumulator,
  counters: AgingCounters
): void {
  const world = project.primaryWorld;
  const elevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const wetness = world.topologyLayers.wetness;
  const plates = world.topologyLayers.plates;
  const totalMy = Math.max(250, project.selectedValues.systemAgeGy * 1000);
  const durationGy = Math.max(0.05, epoch.durationMy / 1000);
  const bombardmentWeight = 0.22 + epoch.impactIntensity * 1.55;
  const opportunityScale = Math.sqrt(topology.cellCount) * 0.42 * Math.max(0.1, project.selectedValues.impactFrequency);
  const opportunities = Math.round(opportunityScale * durationGy * bombardmentWeight);
  const hardCap = Math.max(8, Math.round(Math.sqrt(topology.cellCount) * 1.7 * Math.max(0.6, Math.min(1.6, project.selectedValues.impactFrequency))));
  const impactCount = Math.min(hardCap, Math.max(0, opportunities));
  history.totalOpportunities += opportunities;
  history.hardCap = Math.max(history.hardCap, hardCap);

  for (let impact = 0; impact < impactCount; impact += 1) {
    const center = rng.int(0, topology.cellCount - 1);
    const eventAgeMy = epoch.startAgeMy + rng.range(0, epoch.durationMy);
    const normalizedAge = clamp(eventAgeMy / totalMy, 0, 1);
    const absoluteAgePressure = clamp(eventAgeMy / 4500, 0, 1.35);
    let differentPlateNeighbors = 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[center * 4 + direction];
      if (neighbor >= 0 && plates[neighbor] !== plates[center]) differentPlateNeighbors += 1;
    }
    const boundaryActivity = differentPlateNeighbors / 4;
    const resistance = cratonResistance.get(plates[center]) ?? 0.5;
    const localWetness = wetness[center] ?? 0;
    const waterAtImpact = water[center] === 1;
    const erodingContext = localWetness * 0.28 + boundaryActivity * 0.2 + (waterAtImpact ? 0.18 : 0);
    const retentionContext = resistance * 0.3 + (1 - localWetness) * 0.16;
    const survivalRatio = clamp(0.96 - absoluteAgePressure * 0.5 - normalizedAge * 0.18 - erodingContext + retentionContext, 0.06, 1);
    const originalStrength = rng.range(0.003, 0.018) * (0.35 + epoch.impactIntensity * 0.9);
    const survivingRelief = originalStrength * survivalRatio;
    const radiusCells = 1 + (originalStrength > 0.012 ? 1 : 0);

    if (survivingRelief > 0.00035) history.retainedEvents += 1;
    if (survivingRelief > 0.0014) history.visibleEvents += 1;
    if (normalizedAge < 0.35) history.earlyEvents += 1;
    if (normalizedAge > 0.7) history.lateEvents += 1;
    if (resistance > 0.68 && localWetness < 0.35) {
      history.stableDryRetentionSum += survivalRatio;
      history.stableDryRetentionCount += 1;
    }
    if (boundaryActivity > 0.25 || localWetness > 0.62 || waterAtImpact) {
      history.wetActiveErosionSum += 1 - survivalRatio;
      history.wetActiveErosionCount += 1;
    }
    history.appliedEvents += 1;
    history.eventAgeMySum += eventAgeMy;
    history.originalStrengthSum += originalStrength;
    history.survivingReliefSum += survivingRelief;
    history.survivalRatioSum += survivalRatio;
    history.events.push({
      id: `impact-${epoch.index + 1}-${impact + 1}`,
      centerCell: center,
      epochIndex: epoch.index,
      eventAgeMy,
      radiusCells,
      originalStrength,
      survivingRelief,
      survivalRatio,
      erosionResistance: resistance,
      wetness: localWetness,
      boundaryActivity,
      waterAtImpact
    });

    elevation[center] -= survivingRelief;
    counters.impacts += 1;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[center * 4 + direction];
      if (neighbor < 0) continue;
      elevation[neighbor] += survivingRelief * 0.18;
      counters.impacts += 1;
      if (radiusCells < 2) continue;
      const outer = topology.neighbors[neighbor * 4 + direction];
      if (outer < 0) continue;
      elevation[outer] += survivingRelief * 0.07;
      counters.impacts += 1;
    }
  }
}

function countMarkedCells(layer: Uint8Array): number {
  let count = 0;
  for (const value of layer) count += value ? 1 : 0;
  return count;
}

type FragmentLineageSeed = {
  id: number;
  plateId: number;
  cellCount: number;
  x: number;
  y: number;
  z: number;
  cells: number[];
};

function captureFragmentLineageSeeds(
  plates: Uint16Array,
  topology: CubedSphereTopology,
  plateLookup: PlateLookup
): FragmentLineageSeed[] {
  const fragmentIds = new Int32Array(topology.cellCount);
  fragmentIds.fill(-1);
  const queue = new Int32Array(topology.cellCount);
  const seeds: FragmentLineageSeed[] = [];

  for (let start = 0; start < topology.cellCount; start += 1) {
    if (fragmentIds[start] >= 0 || plateLookup.kind[plates[start]] !== 1) continue;
    const id = seeds.length;
    const plateId = plates[start];
    let head = 0;
    let tail = 0;
    let cellCount = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    const cells: number[] = [];
    queue[tail++] = start;
    fragmentIds[start] = id;
    while (head < tail) {
      const cell = queue[head++];
      cellCount += 1;
      cells.push(cell);
      x += topology.positions[cell * 3];
      y += topology.positions[cell * 3 + 1];
      z += topology.positions[cell * 3 + 2];
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || fragmentIds[neighbor] >= 0 || plates[neighbor] !== plateId || plateLookup.kind[plates[neighbor]] !== 1) continue;
        fragmentIds[neighbor] = id;
        queue[tail++] = neighbor;
      }
    }
    const length = Math.max(0.000001, Math.hypot(x, y, z));
    seeds.push({ id, plateId, cellCount, x: x / length, y: y / length, z: z / length, cells });
  }

  return seeds;
}

function buildStoredFragmentHistory(
  fragmentSizes: number[],
  fragmentPlateIds: number[],
  centroidX: number[],
  centroidY: number[],
  centroidZ: number[],
  lineageSeeds: FragmentLineageSeed[],
  plateLookup: PlateLookup
): { records: DeepTimeFragmentHistoryRecord[]; resolvedParentShare: number; keyframeCount: number } {
  const records: DeepTimeFragmentHistoryRecord[] = [];
  let resolvedParents = 0;
  const selected = fragmentSizes
    .map((cellCount, fragmentId) => ({ fragmentId, cellCount }))
    .filter((fragment) => fragment.cellCount >= 4)
    .sort((left, right) => right.cellCount - left.cellCount)
    .slice(0, 96);

  for (const fragment of selected) {
    const fragmentId = fragment.fragmentId;
    const plateId = fragmentPlateIds[fragmentId];
    let parent: FragmentLineageSeed | undefined;
    let parentDistance = Number.POSITIVE_INFINITY;
    for (const seed of lineageSeeds) {
      if (seed.plateId !== plateId) continue;
      const distance = angularDistance(seed.x, seed.y, seed.z, centroidX[fragmentId], centroidY[fragmentId], centroidZ[fragmentId]);
      if (distance < parentDistance) {
        parent = seed;
        parentDistance = distance;
      }
    }
    if (parent) resolvedParents += 1;
    const startX = parent?.x ?? centroidX[fragmentId];
    const startY = parent?.y ?? centroidY[fragmentId];
    const startZ = parent?.z ?? centroidZ[fragmentId];
    const endX = centroidX[fragmentId];
    const endY = centroidY[fragmentId];
    const endZ = centroidZ[fragmentId];
    const keyframes: DeepTimeFragmentKeyframe[] = [];
    for (let keyframeIndex = 0; keyframeIndex < 5; keyframeIndex += 1) {
      const ageFraction = keyframeIndex / 4;
      const x = startX * (1 - ageFraction) + endX * ageFraction;
      const y = startY * (1 - ageFraction) + endY * ageFraction;
      const z = startZ * (1 - ageFraction) + endZ * ageFraction;
      const length = Math.max(0.000001, Math.hypot(x, y, z));
      const normalizedX = x / length;
      const normalizedY = y / length;
      const normalizedZ = z / length;
      const baseLatitude = Math.asin(clamp(normalizedY, -1, 1));
      const baseLongitude = Math.atan2(normalizedZ, normalizedX);
      const motionScale = ageFraction * (1 - ageFraction) * 0.012;
      keyframes.push({
        keyframeIndex,
        ageFraction: round(ageFraction, 3),
        longitudeRadians: round(baseLongitude + plateLookup.motionX[plateId] * motionScale, 6),
        latitudeRadians: round(clamp(baseLatitude + plateLookup.motionY[plateId] * motionScale, -1.48, 1.48), 6)
      });
    }
    records.push({
      fragmentId,
      parentSeedId: parent?.id ?? null,
      plateId,
      cellCount: fragment.cellCount,
      keyframes
    });
  }

  return {
    records,
    resolvedParentShare: resolvedParents / Math.max(1, records.length),
    keyframeCount: records.reduce((sum, record) => sum + record.keyframes.length, 0)
  };
}

function findBestUnclaimedTransformTarget(
  topology: CubedSphereTopology,
  initialTarget: number,
  targetClaims: Uint8Array,
  targetVector: { x: number; y: number; z: number },
  maxDepth = 3
): number {
  if (!targetClaims[initialTarget]) return initialTarget;
  const queueCells = [initialTarget];
  const queueDepths = [0];
  const visited = new Set<number>([initialTarget]);
  let head = 0;
  let bestCell = -1;
  let bestAlignment = Number.NEGATIVE_INFINITY;
  while (head < queueCells.length) {
    const cell = queueCells[head];
    const depth = queueDepths[head];
    head += 1;
    if (!targetClaims[cell]) {
      const alignment =
        topology.positions[cell * 3] * targetVector.x +
        topology.positions[cell * 3 + 1] * targetVector.y +
        topology.positions[cell * 3 + 2] * targetVector.z;
      if (alignment > bestAlignment + 1e-12 || (Math.abs(alignment - bestAlignment) <= 1e-12 && (bestCell < 0 || cell < bestCell))) {
        bestCell = cell;
        bestAlignment = alignment;
      }
    }
    if (depth >= maxDepth) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queueCells.push(neighbor);
      queueDepths.push(depth + 1);
    }
  }
  return bestCell;
}

function applyAuthoritativeFragmentTransforms(
  project: DeepTimeProject,
  lineageSeeds: FragmentLineageSeed[],
  topology: CubedSphereTopology,
  plateLookup: PlateLookup
): DeepTimeFragmentPlacementDiagnostics {
  const world = project.primaryWorld;
  const plates = world.topologyLayers.plates;
  const elevation = world.topologyLayers.elevation;
  const volcanism = world.topologyLayers.volcanism;
  const originalPlates = new Uint16Array(plates);
  const originalElevation = new Float32Array(elevation);
  const originalVolcanism = new Float32Array(volcanism);
  const sourceCells = new Uint8Array(topology.cellCount);
  const targetClaims = new Uint8Array(topology.cellCount);
  const targetCells = new Uint8Array(topology.cellCount);
  const directPlacementCells = new Uint8Array(topology.cellCount);
  const collisionCells = new Uint8Array(topology.cellCount);
  const collisionResolvedCells = new Uint8Array(topology.cellCount);
  const mergedCollisionCells = new Uint8Array(topology.cellCount);
  const oceanPlateId = world.plates.find((plate) => plate.kind === 'oceanic')?.id ?? originalPlates[0] ?? 0;
  const sortedSeeds = [...lineageSeeds].sort((left, right) => right.cellCount - left.cellCount || left.id - right.id);
  let targetCellCount = 0;
  let movingFragmentCount = 0;
  let displacementTotal = 0;
  let maxDisplacement = 0;

  for (const seed of sortedSeeds) {
    for (const sourceCell of seed.cells) {
      sourceCells[sourceCell] = 1;
      plates[sourceCell] = oceanPlateId;
      elevation[sourceCell] = Math.min(originalElevation[sourceCell], world.seaLevel - 0.07);
      volcanism[sourceCell] = Math.max(originalVolcanism[sourceCell] * 0.35, world.planetaryDynamics.geothermalFlux * 0.12);
    }
  }

  for (const seed of sortedSeeds) {
    const speed = Math.hypot(plateLookup.motionX[seed.plateId], plateLookup.motionY[seed.plateId]);
    const displacement = speed > 0.0001
      ? clamp(speed * Math.max(0.25, project.selectedValues.systemAgeGy) * 0.018, 0.012, 0.42)
      : 0;
    const motionX = speed > 0.0001 ? plateLookup.motionX[seed.plateId] / speed : 0;
    const motionY = speed > 0.0001 ? plateLookup.motionY[seed.plateId] / speed : 0;
    const rotation = buildTangentSphericalRotation(
    { x: seed.x, y: seed.y, z: seed.z },
    motionX,
    motionY,
    displacement
  );
  if (displacement > 0) movingFragmentCount += 1;
  displacementTotal += displacement;
  maxDisplacement = Math.max(maxDisplacement, displacement);
  for (const sourceCell of seed.cells) {
    const rotatedTarget = rotateUnitVector(
      {
        x: topology.positions[sourceCell * 3],
        y: topology.positions[sourceCell * 3 + 1],
        z: topology.positions[sourceCell * 3 + 2]
      },
      rotation
    );
    const targetCoordinates = unitVectorToLonLat(rotatedTarget);
    const desiredTarget = cubedSphereCellForLonLat(topology, targetCoordinates.longitude, targetCoordinates.latitude);
      let targetCell = desiredTarget;
      if (targetClaims[desiredTarget]) {
        collisionCells[desiredTarget] = 1;
        const spillTarget = findBestUnclaimedTransformTarget(
        topology,
        desiredTarget,
        targetClaims,
        rotatedTarget,
        3
      );
        if (spillTarget >= 0) {
          targetCell = spillTarget;
          collisionResolvedCells[targetCell] = 1;
        } else {
          mergedCollisionCells[desiredTarget] = 1;
          elevation[desiredTarget] = Math.max(elevation[desiredTarget], originalElevation[sourceCell]) + 0.004;
          volcanism[desiredTarget] = clamp(Math.max(volcanism[desiredTarget], originalVolcanism[sourceCell]) + 0.008, 0, 1);
          continue;
        }
      } else {
        directPlacementCells[targetCell] = 1;
      }
      targetClaims[targetCell] = 1;
      targetCells[targetCell] = 1;
      targetCellCount += 1;
      plates[targetCell] = originalPlates[sourceCell];
      elevation[targetCell] = originalElevation[sourceCell];
      volcanism[targetCell] = originalVolcanism[sourceCell];
    }
  }

  let ownershipChangedCells = 0;
  let vacatedSourceCells = 0;
  let youngOceanCrustCells = 0;
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (plates[cell] !== originalPlates[cell]) ownershipChangedCells += 1;
    if (sourceCells[cell] && !targetCells[cell]) vacatedSourceCells += 1;
    if (sourceCells[cell] && plateLookup.kind[plates[cell]] === 2) youngOceanCrustCells += 1;
  }

  const sourceCellCount = countMarkedCells(sourceCells);
  const denominator = Math.max(1, topology.cellCount);
  const retainedCellRatio = targetCellCount / Math.max(1, sourceCellCount);
  const notes = [
    'All captured continental fragments use one rigid three-dimensional spherical rotation, including near-stationary fragments which use identity transforms.',
    'Overlapping target claims search the local topology neighborhood and choose the unclaimed cell with the best angular fit before merging relief at the collision target.',
    'Vacated source cells become young oceanic crust before erosion, impacts, glaciation, climate, and hydrology run.'
  ];
  if (retainedCellRatio < 0.97) notes.push('Fragment placement retained less than 97 percent of source cells; inspect merged collision pressure.');

  return {
    modelVersion: 'fragment-placement-v1',
    fragmentCount: sortedSeeds.length,
    movingFragmentCount,
    resolvedRecordShare: sortedSeeds.length / Math.max(1, lineageSeeds.length),
    sourceCellCount,
    targetCellCount,
    sourceCellShare: sourceCellCount / denominator,
    targetCellShare: targetCellCount / denominator,
    retainedCellRatio,
    directPlacementCellShare: countMarkedCells(directPlacementCells) / denominator,
    collisionCellShare: countMarkedCells(collisionCells) / denominator,
    collisionResolvedCellShare: countMarkedCells(collisionResolvedCells) / denominator,
    mergedCollisionCellShare: countMarkedCells(mergedCollisionCells) / denominator,
    vacatedSourceCellShare: vacatedSourceCells / denominator,
    youngOceanCrustCellShare: youngOceanCrustCells / denominator,
    ownershipChangedCellShare: ownershipChangedCells / denominator,
    meanDisplacementRadians: displacementTotal / Math.max(1, sortedSeeds.length),
    maxDisplacementRadians: maxDisplacement,
    notes
  };
}

function previewDirectFragmentTransformRaster(
  records: DeepTimeFragmentHistoryRecord[],
  lineageSeeds: FragmentLineageSeed[],
  topology: CubedSphereTopology
): { resolvedRecordShare: number; sourceCellShare: number; targetCellShare: number; collisionCellShare: number } {
  const seedsById = new Map(lineageSeeds.map((seed) => [seed.id, seed]));
  const sourceCells = new Uint8Array(topology.cellCount);
  const targetClaims = new Uint16Array(topology.cellCount);
  let resolvedRecords = 0;

  for (const record of records) {
    if (record.parentSeedId === null || record.keyframes.length < 2) continue;
    const seed = seedsById.get(record.parentSeedId);
    if (!seed) continue;
    const first = record.keyframes[0];
    const last = record.keyframes[record.keyframes.length - 1];
    const rotation = buildRotationBetweenUnitVectors(
    vectorFromLonLat(first.longitudeRadians, first.latitudeRadians),
    vectorFromLonLat(last.longitudeRadians, last.latitudeRadians)
  );
    resolvedRecords += 1;
    for (const sourceCell of seed.cells) {
      sourceCells[sourceCell] = 1;
      const rotatedTarget = rotateUnitVector(
        {
          x: topology.positions[sourceCell * 3],
          y: topology.positions[sourceCell * 3 + 1],
          z: topology.positions[sourceCell * 3 + 2]
        },
        rotation
      );
      const targetCoordinates = unitVectorToLonLat(rotatedTarget);
      const targetCell = cubedSphereCellForLonLat(topology, targetCoordinates.longitude, targetCoordinates.latitude);
      targetClaims[targetCell] = Math.min(65535, targetClaims[targetCell] + 1);
    }
  }

  let targetCells = 0;
  let collisionCells = 0;
  for (const claims of targetClaims) {
    if (claims > 0) targetCells += 1;
    if (claims > 1) collisionCells += 1;
  }
  const denominator = Math.max(1, topology.cellCount);
  return {
    resolvedRecordShare: resolvedRecords / Math.max(1, records.length),
    sourceCellShare: countMarkedCells(sourceCells) / denominator,
    targetCellShare: targetCells / denominator,
    collisionCellShare: collisionCells / denominator
  };
}

function applyStoredFragmentHistoryEventFields(
  records: DeepTimeFragmentHistoryRecord[],
  conjugateMargins: DeepTimeConjugateMarginHistoryRecord[],
  fragmentIds: Int32Array,
  topology: CubedSphereTopology,
  collisionCells: Uint8Array,
  riftCells: Uint8Array,
  conjugateMarginCells: Uint8Array
): { pairEvaluations: number; eventCellShare: number; collisionCellShare: number; riftCellShare: number; conjugateMarginCellShare: number } {
  const recordsByFragment = new Map(records.map((record) => [record.fragmentId, record]));
  const conjugatePairs = new Set(conjugateMargins.map((record) => `${Math.min(record.fragmentAId, record.fragmentBId)}:${Math.max(record.fragmentAId, record.fragmentBId)}`));
  const relationCache = new Map<string, 'collision' | 'rift' | 'neutral'>();
  const historyEventCells = new Uint8Array(topology.cellCount);
  const historyCollisionCells = new Uint8Array(topology.cellCount);
  const historyRiftCells = new Uint8Array(topology.cellCount);
  const historyConjugateCells = new Uint8Array(topology.cellCount);
  let pairEvaluations = 0;

  const relationFor = (fragmentAId: number, fragmentBId: number): 'collision' | 'rift' | 'neutral' => {
    const a = Math.min(fragmentAId, fragmentBId);
    const b = Math.max(fragmentAId, fragmentBId);
    const key = `${a}:${b}`;
    const cached = relationCache.get(key);
    if (cached) return cached;
    const first = recordsByFragment.get(a);
    const second = recordsByFragment.get(b);
    if (!first || !second || first.keyframes.length < 2 || second.keyframes.length < 2) {
      relationCache.set(key, 'neutral');
      return 'neutral';
    }
    const firstStart = first.keyframes[0];
    const firstEnd = first.keyframes[first.keyframes.length - 1];
    const secondStart = second.keyframes[0];
    const secondEnd = second.keyframes[second.keyframes.length - 1];
    const startA = vectorFromLonLat(firstStart.longitudeRadians, firstStart.latitudeRadians);
    const endA = vectorFromLonLat(firstEnd.longitudeRadians, firstEnd.latitudeRadians);
    const startB = vectorFromLonLat(secondStart.longitudeRadians, secondStart.latitudeRadians);
    const endB = vectorFromLonLat(secondEnd.longitudeRadians, secondEnd.latitudeRadians);
    const initialDistance = angularDistance(startA.x, startA.y, startA.z, startB.x, startB.y, startB.z);
    const finalDistance = angularDistance(endA.x, endA.y, endA.z, endB.x, endB.y, endB.z);
    const distanceDelta = finalDistance - initialDistance;
    const sharesParent = first.parentSeedId !== null && first.parentSeedId === second.parentSeedId;
    const relation = sharesParent && distanceDelta > 0.004
      ? 'rift'
      : !sharesParent && distanceDelta < -0.004
        ? 'collision'
        : 'neutral';
    relationCache.set(key, relation);
    return relation;
  };

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const fragmentAId = fragmentIds[cell];
    if (fragmentAId < 0 || !recordsByFragment.has(fragmentAId)) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor <= cell || neighbor < 0) continue;
      const fragmentBId = fragmentIds[neighbor];
      if (fragmentBId < 0 || fragmentBId === fragmentAId || !recordsByFragment.has(fragmentBId)) continue;
      pairEvaluations += 1;
      const a = Math.min(fragmentAId, fragmentBId);
      const b = Math.max(fragmentAId, fragmentBId);
      const key = `${a}:${b}`;
      const relation = relationFor(a, b);
      if (relation === 'collision') {
        collisionCells[cell] = 1;
        collisionCells[neighbor] = 1;
        historyCollisionCells[cell] = 1;
        historyCollisionCells[neighbor] = 1;
        historyEventCells[cell] = 1;
        historyEventCells[neighbor] = 1;
      } else if (relation === 'rift') {
        riftCells[cell] = 1;
        riftCells[neighbor] = 1;
        historyRiftCells[cell] = 1;
        historyRiftCells[neighbor] = 1;
        historyEventCells[cell] = 1;
        historyEventCells[neighbor] = 1;
      }
      if (conjugatePairs.has(key)) {
        conjugateMarginCells[cell] = 1;
        conjugateMarginCells[neighbor] = 1;
        historyConjugateCells[cell] = 1;
        historyConjugateCells[neighbor] = 1;
        historyEventCells[cell] = 1;
        historyEventCells[neighbor] = 1;
      }
    }
  }

  const denominator = Math.max(1, topology.cellCount);
  return {
    pairEvaluations,
    eventCellShare: countMarkedCells(historyEventCells) / denominator,
    collisionCellShare: countMarkedCells(historyCollisionCells) / denominator,
    riftCellShare: countMarkedCells(historyRiftCells) / denominator,
    conjugateMarginCellShare: countMarkedCells(historyConjugateCells) / denominator
  };
}

function buildFragmentHistoryDiagnostics(
  project: DeepTimeProject,
  topology: CubedSphereTopology,
  plateLookup: PlateLookup,
  lineageSeeds: FragmentLineageSeed[],
  options: {
    applyTerrainResponse?: boolean;
    terrainResponseScale?: number;
    applyVolcanismResponse?: boolean;
    volcanismResponseScale?: number;
    surfaceAgingSampleCount?: number;
    directTransformDiagnostics?: { resolvedRecordShare: number; sourceCellShare: number; targetCellShare: number; collisionCellShare: number };
  } = {}
): DeepTimeFragmentHistoryDiagnostics {
  const world = project.primaryWorld;
  const plates = world.topologyLayers.plates;
  const elevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const volcanism = world.topologyLayers.volcanism;
  const fragmentIds = new Int32Array(topology.cellCount);
  fragmentIds.fill(-1);
  const queue = new Int32Array(topology.cellCount);
  const fragmentSizes: number[] = [];
  const fragmentPlateIds: number[] = [];
  const fragmentCentroidX: number[] = [];
  const fragmentCentroidY: number[] = [];
  const fragmentCentroidZ: number[] = [];
  let continentalCells = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (plateLookup.kind[plates[cell]] === 1) continentalCells += 1;
  }

  for (let start = 0; start < topology.cellCount; start += 1) {
    if (fragmentIds[start] >= 0 || plateLookup.kind[plates[start]] !== 1) continue;
    const fragmentId = fragmentSizes.length;
    let head = 0;
    let tail = 0;
    let size = 0;
    let centroidX = 0;
    let centroidY = 0;
    let centroidZ = 0;
    const plateId = plates[start];
    queue[tail++] = start;
    fragmentIds[start] = fragmentId;
    while (head < tail) {
      const cell = queue[head++];
      size += 1;
      centroidX += topology.positions[cell * 3];
      centroidY += topology.positions[cell * 3 + 1];
      centroidZ += topology.positions[cell * 3 + 2];
      const cellPlateId = plates[cell];
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || fragmentIds[neighbor] >= 0 || plates[neighbor] !== cellPlateId || plateLookup.kind[plates[neighbor]] !== 1) continue;
        fragmentIds[neighbor] = fragmentId;
        queue[tail++] = neighbor;
      }
    }
    fragmentSizes.push(size);
    fragmentPlateIds.push(plateId);
    const length = Math.max(0.000001, Math.hypot(centroidX, centroidY, centroidZ));
    fragmentCentroidX.push(centroidX / length);
    fragmentCentroidY.push(centroidY / length);
    fragmentCentroidZ.push(centroidZ / length);
  }

  const boundaryCells = new Uint8Array(topology.cellCount);
  const collisionCells = new Uint8Array(topology.cellCount);
  const riftCells = new Uint8Array(topology.cellCount);
  const transformCells = new Uint8Array(topology.cellCount);
  const subductionCells = new Uint8Array(topology.cellCount);
  const trenchCells = new Uint8Array(topology.cellCount);
  const conjugateMarginCells = new Uint8Array(topology.cellCount);
  const conjugatePairs = new Map<string, number>();
  const fragmentBoundaryCounts = new Uint32Array(fragmentSizes.length);
  const fragmentRiftBoundaryCounts = new Uint32Array(fragmentSizes.length);
  let boundaryCellCount = 0;
  let conjugateProbeCount = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const plateAId = plates[cell];
    if (plateLookup.kind[plateAId] !== 1) continue;
    let isBoundary = false;
    let outwardX = 0;
    let outwardY = 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || plates[neighbor] === plateAId) continue;
      const plateBId = plates[neighbor];
      const dx = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.max(0.12, Math.cos(topology.latitudes[cell]));
      const dy = topology.latitudes[neighbor] - topology.latitudes[cell];
      const distance = Math.max(0.000001, Math.hypot(dx, dy));
      const nx = dx / distance;
      const ny = dy / distance;
      const relativeX = plateLookup.motionX[plateBId] - plateLookup.motionX[plateAId];
      const relativeY = plateLookup.motionY[plateBId] - plateLookup.motionY[plateAId];
      const normalVelocity = relativeX * nx + relativeY * ny;
      const shearVelocity = Math.abs(relativeX * -ny + relativeY * nx);
      const neighborContinental = plateLookup.kind[plateBId] === 1;
      isBoundary = true;
      outwardX += nx;
      outwardY += ny;
      if (neighborContinental && normalVelocity > 0.55) collisionCells[cell] = 1;
      if (normalVelocity < -0.45) riftCells[cell] = 1;
      if (shearVelocity > 1.2) transformCells[cell] = 1;
      if (!neighborContinental && normalVelocity > 0.35) {
        subductionCells[cell] = 1;
        trenchCells[neighbor] = 1;
      }
    }
    if (!isBoundary) continue;
    boundaryCells[cell] = 1;
    boundaryCellCount += 1;
    const fragmentId = fragmentIds[cell];
    if (fragmentId >= 0) {
      fragmentBoundaryCounts[fragmentId] += 1;
      if (riftCells[cell]) fragmentRiftBoundaryCounts[fragmentId] += 1;
    }

    const outwardLength = Math.hypot(outwardX, outwardY);
    if (outwardLength <= 0.0001) continue;
    const pair = findConjugateMarginPair(cell, fragmentIds, water, elevation, world.seaLevel, topology, outwardX / outwardLength, outwardY / outwardLength);
    if (pair >= 0 && pair !== fragmentIds[cell]) {
      conjugateMarginCells[cell] = 1;
      conjugateProbeCount += 1;
      const a = Math.min(fragmentIds[cell], pair);
      const b = Math.max(fragmentIds[cell], pair);
      const pairKey = `${a}:${b}`;
      conjugatePairs.set(pairKey, (conjugatePairs.get(pairKey) ?? 0) + 1);
    }
  }

  const continentalDenominator = Math.max(1, continentalCells);
  const boundaryDenominator = Math.max(1, boundaryCellCount);
  const largestFragment = fragmentSizes.reduce((max, size) => Math.max(max, size), 0);
  const collisionShare = countMarkedCells(collisionCells) / continentalDenominator;
  const riftShare = countMarkedCells(riftCells) / continentalDenominator;
  const conjugateShare = conjugateProbeCount / boundaryDenominator;
  const coherentFragmentScore = clamp(largestFragment / continentalDenominator, 0, 1);
  const storedHistory = buildStoredFragmentHistory(
    fragmentSizes,
    fragmentPlateIds,
    fragmentCentroidX,
    fragmentCentroidY,
    fragmentCentroidZ,
    lineageSeeds,
    plateLookup
  );
  const directTransformPreview = options.directTransformDiagnostics ?? previewDirectFragmentTransformRaster(storedHistory.records, lineageSeeds, topology);
  const conjugateMarginHistoryRecords: DeepTimeConjugateMarginHistoryRecord[] = [...conjugatePairs.entries()]
    .map(([key, probeCount]) => {
      const [fragmentAId, fragmentBId] = key.split(':').map(Number);
      return { fragmentAId, fragmentBId, probeCount };
    })
    .sort((left, right) => right.probeCount - left.probeCount || left.fragmentAId - right.fragmentAId || left.fragmentBId - right.fragmentBId)
    .slice(0, 256);
  const historyDrivenEvents = applyStoredFragmentHistoryEventFields(
    storedHistory.records,
    conjugateMarginHistoryRecords,
    fragmentIds,
    topology,
    collisionCells,
    riftCells,
    conjugateMarginCells
  );
  const motionEvents = estimateFragmentMotionEvents(
    fragmentSizes,
    fragmentPlateIds,
    fragmentCentroidX,
    fragmentCentroidY,
    fragmentCentroidZ,
    fragmentBoundaryCounts,
    fragmentRiftBoundaryCounts,
    plateLookup,
    project.selectedValues.systemAgeGy,
    continentalDenominator
  );
  const terrainResponse = estimateFragmentTerrainResponse(
    collisionCells,
    riftCells,
    transformCells,
    subductionCells,
    trenchCells,
    conjugateMarginCells,
    elevation,
    water,
    world.seaLevel,
    topology,
    options.applyTerrainResponse ? options.terrainResponseScale ?? 0.3 : 0
  );
  const volcanismResponse = estimateFragmentVolcanismResponse(
    collisionCells,
    riftCells,
    transformCells,
    subductionCells,
    trenchCells,
    conjugateMarginCells,
    volcanism,
    topology,
    options.applyVolcanismResponse ? options.volcanismResponseScale ?? 0.3 : 0
  );
  const puzzleFitScore = clamp(conjugateShare * 0.4 + collisionShare * 0.18 + riftShare * 0.14 + motionEvents.motionEventScore * 0.28, 0, 1);

  return {
    modelVersion: 'fragment-history-diagnostics-v13',
    fragmentCount: fragmentSizes.length,
    continentalCellShare: round(continentalCells / Math.max(1, topology.cellCount), 6),
    largestFragmentShareOfContinental: round(largestFragment / continentalDenominator, 6),
    meanFragmentCellCount: round(fragmentSizes.reduce((sum, size) => sum + size, 0) / Math.max(1, fragmentSizes.length), 2),
    boundaryCellShareOfContinental: round(boundaryCellCount / continentalDenominator, 6),
    keyframedFragmentSampleCount: motionEvents.sampleCount,
    storedLineageSeedCount: lineageSeeds.length,
    resolvedParentShare: round(storedHistory.resolvedParentShare, 6),
    fragmentKeyframeCount: storedHistory.keyframeCount,
    fragmentHistoryRecords: storedHistory.records,
    conjugateMarginHistoryRecords,
    historyDrivenPairEvaluations: historyDrivenEvents.pairEvaluations,
    historyDrivenEventCellShare: round(historyDrivenEvents.eventCellShare, 6),
    historyDrivenCollisionCellShare: round(historyDrivenEvents.collisionCellShare, 6),
    historyDrivenRiftCellShare: round(historyDrivenEvents.riftCellShare, 6),
    historyDrivenConjugateMarginCellShare: round(historyDrivenEvents.conjugateMarginCellShare, 6),
    directTransformResolvedRecordShare: round(directTransformPreview.resolvedRecordShare, 6),
    directTransformSourceCellShare: round(directTransformPreview.sourceCellShare, 6),
    directTransformTargetCellShare: round(directTransformPreview.targetCellShare, 6),
    directTransformCollisionCellShare: round(directTransformPreview.collisionCellShare, 6),
    surfaceAgingSampleCount: options.surfaceAgingSampleCount ?? 0,
    meanProjectedFragmentDisplacementRadians: round(motionEvents.meanDisplacementRadians, 6),
    maxProjectedFragmentDisplacementRadians: round(motionEvents.maxDisplacementRadians, 6),
    collisionEventCandidatePairs: motionEvents.collisionPairs,
    riftSplitCandidateFragments: motionEvents.riftSplitFragments,
    terrainResponseApplied: Boolean(options.applyTerrainResponse),
    terrainResponseScale: round(options.applyTerrainResponse ? options.terrainResponseScale ?? 0.3 : 0, 4),
    terrainResponseCellShare: round(terrainResponse.responseCellShare, 6),
    upliftResponseCellShare: round(terrainResponse.upliftCellShare, 6),
    subsidenceResponseCellShare: round(terrainResponse.subsidenceCellShare, 6),
    marginToneResponseCellShare: round(terrainResponse.marginToneCellShare, 6),
    estimatedPositiveReliefVolume: round(terrainResponse.positiveReliefVolume, 8),
    estimatedNegativeReliefVolume: round(terrainResponse.negativeReliefVolume, 8),
    meanAbsTerrainResponseDelta: round(terrainResponse.meanAbsDelta, 8),
    maxTerrainResponseDelta: round(terrainResponse.maxAbsDelta, 8),
    volcanismResponseApplied: Boolean(options.applyVolcanismResponse),
    volcanismResponseScale: round(options.applyVolcanismResponse ? options.volcanismResponseScale ?? 0.3 : 0, 4),
    volcanismResponseCellShare: round(volcanismResponse.responseCellShare, 6),
    meanVolcanismResponseDelta: round(volcanismResponse.meanDelta, 8),
    maxVolcanismResponseDelta: round(volcanismResponse.maxDelta, 8),
    collisionCandidateCellShare: round(collisionShare, 6),
    riftCandidateCellShare: round(riftShare, 6),
    transformCandidateCellShare: round(countMarkedCells(transformCells) / continentalDenominator, 6),
    subductionCandidateCellShare: round(countMarkedCells(subductionCells) / continentalDenominator, 6),
    trenchCandidateCellShare: round(countMarkedCells(trenchCells) / Math.max(1, topology.cellCount - continentalCells), 6),
    conjugateMarginCandidatePairs: conjugatePairs.size,
    conjugateMarginCandidateShare: round(conjugateShare, 6),
    puzzleFitScore: round(puzzleFitScore, 6),
    coherentFragmentScore: round(coherentFragmentScore, 6),
    motionEventScore: round(motionEvents.motionEventScore, 6),
    notes: [
      options.applyTerrainResponse
        ? 'Fragment-history terrain and volcanism responses are authoritative at bounded scales; final water, climate, hydrology, biomes, and projection reconcile after them.'
        : 'Diagnostic-only prototype: no terrain, water, plate, or projection layers are changed.',
      'Initial continental fragment seeds are captured before aging and retained as stable lineage anchors.',
      'Final fragments are matched to same-plate lineage seeds and carry five deterministic stored keyframes from initial to final centroid state.',
      'Candidate sutures, rifts, transforms, subduction margins, and trenches are inferred from local plate motion at continental boundaries.',
      'Conjugate-margin relationships are stored as explicit fragment-pair records with supporting probe counts rather than remaining an aggregate score.',
      'Stored lineage and keyframe distance changes now rasterize collision and rift events back onto final fragment boundaries before authoritative terrain and volcanism response.',
      'Largest fragments retain the cheap motion-event estimate for secondary collision and split candidate scoring.',
      options.applyTerrainResponse
        ? 'Terrain-response fields applied a bounded elevation adjustment before final sea-level, climate, hydrology, biome, and projection reconciliation.'
        : 'Terrain-response fields estimate uplift, subsidence, trenching, and margin tone-up pressure without mutating elevation.',
      options.applyVolcanismResponse
        ? 'Volcanism-response fields apply bounded arc, rift, transform, and suture signals from the same fragment-history event masks.'
        : 'Volcanism-response fields estimate arc, rift, transform, and suture signals without mutating volcanism.',
      `Dense surface aging used ${options.surfaceAgingSampleCount ?? 0} samples after one authoritative whole-fragment placement pass.`,
      'Direct fragment transforms move continental membership, elevation, and volcanism before surface aging. Retired ownership transfer and motion-driven terrain paths are no longer represented in the output contract.'
    ]
  };
}

function estimateFragmentTerrainResponse(
  collisionCells: Uint8Array,
  riftCells: Uint8Array,
  transformCells: Uint8Array,
  subductionCells: Uint8Array,
  trenchCells: Uint8Array,
  conjugateMarginCells: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  seaLevel: number,
  topology: CubedSphereTopology,
  applyScale = 0
): {
  responseCellShare: number;
  upliftCellShare: number;
  subsidenceCellShare: number;
  marginToneCellShare: number;
  positiveReliefVolume: number;
  negativeReliefVolume: number;
  meanAbsDelta: number;
  maxAbsDelta: number;
} {
  const responseCells = new Uint8Array(topology.cellCount);
  const upliftCells = new Uint8Array(topology.cellCount);
  const subsidenceCells = new Uint8Array(topology.cellCount);
  const marginToneCells = new Uint8Array(topology.cellCount);
  let positiveReliefVolume = 0;
  let negativeReliefVolume = 0;
  let absoluteDeltaTotal = 0;
  let maxAbsDelta = 0;
  const response = new Float32Array(topology.cellCount);

  const addResponse = (cell: number, amount: number, firstRing = 0.42, secondRing = 0.14) => {
    response[cell] += amount;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0) continue;
      response[neighbor] += amount * firstRing;
      for (let nextDirection = 0; nextDirection < 4; nextDirection += 1) {
        const next = topology.neighbors[neighbor * 4 + nextDirection];
        if (next < 0 || next === cell) continue;
        response[next] += amount * secondRing;
      }
    }
  };

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (collisionCells[cell]) addResponse(cell, 0.18, 0.22, 0.035);
    if (subductionCells[cell]) addResponse(cell, 0.15, 0.2, 0.035);
    if (transformCells[cell]) addResponse(cell, elevation[cell] > seaLevel ? 0.011 : -0.0065, 0.26, 0.055);
    if (riftCells[cell]) addResponse(cell, -0.046, 0.32, 0.075);
    if (trenchCells[cell]) addResponse(cell, -0.068, 0.28, 0.055);
    if (conjugateMarginCells[cell]) {
      marginToneCells[cell] = 1;
      addResponse(cell, water[cell] || elevation[cell] <= seaLevel + 0.04 ? -0.016 : 0.01, 0.28, 0.06);
    }
  }

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const rawDelta = response[cell];
    const delta = rawDelta * (applyScale > 0 ? applyScale : 1);
    if (Math.abs(delta) <= 0.000001) continue;
    if (applyScale > 0) elevation[cell] = clamp(elevation[cell] + delta, -1.2, 1.2);
    responseCells[cell] = 1;
    if (delta > 0) {
      upliftCells[cell] = 1;
      positiveReliefVolume += delta;
    } else {
      subsidenceCells[cell] = 1;
      negativeReliefVolume += -delta;
    }
    absoluteDeltaTotal += Math.abs(delta);
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
  }

  return {
    responseCellShare: countMarkedCells(responseCells) / Math.max(1, topology.cellCount),
    upliftCellShare: countMarkedCells(upliftCells) / Math.max(1, topology.cellCount),
    subsidenceCellShare: countMarkedCells(subsidenceCells) / Math.max(1, topology.cellCount),
    marginToneCellShare: countMarkedCells(marginToneCells) / Math.max(1, topology.cellCount),
    positiveReliefVolume,
    negativeReliefVolume,
    meanAbsDelta: absoluteDeltaTotal / Math.max(1, topology.cellCount),
    maxAbsDelta
  };
}

function estimateFragmentVolcanismResponse(
  collisionCells: Uint8Array,
  riftCells: Uint8Array,
  transformCells: Uint8Array,
  subductionCells: Uint8Array,
  trenchCells: Uint8Array,
  conjugateMarginCells: Uint8Array,
  volcanism: Float32Array,
  topology: CubedSphereTopology,
  applyScale = 0
): {
  responseCellShare: number;
  meanDelta: number;
  maxDelta: number;
} {
  const responseCells = new Uint8Array(topology.cellCount);
  let deltaTotal = 0;
  let maxDelta = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    let rawDelta = 0;
    if (subductionCells[cell]) rawDelta += 0.055;
    if (riftCells[cell]) rawDelta += 0.028;
    if (collisionCells[cell]) rawDelta += 0.012;
    if (transformCells[cell]) rawDelta += 0.008;
    if (trenchCells[cell]) rawDelta += 0.006;
    if (conjugateMarginCells[cell]) rawDelta += 0.004;
    const delta = rawDelta * (applyScale > 0 ? applyScale : 1);
    if (delta <= 0.000001) continue;
    if (applyScale > 0) volcanism[cell] = clamp(volcanism[cell] + delta, 0, 1);
    responseCells[cell] = 1;
    deltaTotal += delta;
    maxDelta = Math.max(maxDelta, delta);
  }

  return {
    responseCellShare: countMarkedCells(responseCells) / Math.max(1, topology.cellCount),
    meanDelta: deltaTotal / Math.max(1, topology.cellCount),
    maxDelta
  };
}

function estimateFragmentMotionEvents(
  fragmentSizes: number[],
  fragmentPlateIds: number[],
  centroidX: number[],
  centroidY: number[],
  centroidZ: number[],
  boundaryCounts: Uint32Array,
  riftBoundaryCounts: Uint32Array,
  plateLookup: PlateLookup,
  systemAgeGy: number,
  continentalCells: number
): {
  sampleCount: number;
  meanDisplacementRadians: number;
  maxDisplacementRadians: number;
  collisionPairs: number;
  riftSplitFragments: number;
  motionEventScore: number;
} {
  const candidates = fragmentSizes
    .map((size, id) => ({ id, size }))
    .filter((fragment) => fragment.size >= 4)
    .sort((a, b) => b.size - a.size)
    .slice(0, 96);
  const samples = candidates.map((fragment) => {
    const id = fragment.id;
    const plateId = fragmentPlateIds[id];
    const latitude = Math.asin(clamp(centroidY[id], -1, 1));
    const longitude = Math.atan2(centroidZ[id], centroidX[id]);
    const speed = Math.hypot(plateLookup.motionX[plateId], plateLookup.motionY[plateId]);
    const displacement = clamp(speed * Math.max(0.25, systemAgeGy) * 0.028, 0, 0.85);
    const projectedLatitude = clamp(latitude + plateLookup.motionY[plateId] * displacement * 0.16, -1.48, 1.48);
    const projectedLongitude = longitude + plateLookup.motionX[plateId] * displacement * 0.16 / Math.max(0.18, Math.cos(latitude));
    const projected = vectorFromLonLat(projectedLongitude, projectedLatitude);
    const radius = clamp(Math.sqrt(fragment.size / Math.max(1, continentalCells)) * 1.8, 0.018, 0.42);
    const riftShare = riftBoundaryCounts[id] / Math.max(1, boundaryCounts[id]);
    return {
      id,
      size: fragment.size,
      radius,
      x: centroidX[id],
      y: centroidY[id],
      z: centroidZ[id],
      px: projected.x,
      py: projected.y,
      pz: projected.z,
      displacement,
      riftShare
    };
  });
  let displacementTotal = 0;
  let maxDisplacement = 0;
  let collisionPairs = 0;
  let weightedCollisionSignal = 0;
  for (const sample of samples) {
    displacementTotal += sample.displacement;
    maxDisplacement = Math.max(maxDisplacement, sample.displacement);
  }
  for (let a = 0; a < samples.length; a += 1) {
    for (let b = a + 1; b < samples.length; b += 1) {
      const first = samples[a];
      const second = samples[b];
      const initialDistance = angularDistance(first.x, first.y, first.z, second.x, second.y, second.z);
      const projectedDistance = angularDistance(first.px, first.py, first.pz, second.px, second.py, second.pz);
      const closing = initialDistance - projectedDistance;
      const interactionRadius = first.radius + second.radius + 0.035;
      if (closing <= 0.015 || projectedDistance > interactionRadius) continue;
      collisionPairs += 1;
      weightedCollisionSignal += clamp(closing / Math.max(0.001, interactionRadius), 0, 1);
    }
  }
  const riftSplitFragments = samples.filter((sample) => sample.riftShare >= 0.32 && sample.displacement >= 0.04).length;
  const motionEventScore = clamp(
    (weightedCollisionSignal / Math.max(1, samples.length)) * 0.55 +
      (riftSplitFragments / Math.max(1, samples.length)) * 0.3 +
      (displacementTotal / Math.max(1, samples.length)) * 0.15,
    0,
    1
  );
  return {
    sampleCount: samples.length,
    meanDisplacementRadians: displacementTotal / Math.max(1, samples.length),
    maxDisplacementRadians: maxDisplacement,
    collisionPairs,
    riftSplitFragments,
    motionEventScore
  };
}

function vectorFromLonLat(longitude: number, latitude: number): { x: number; y: number; z: number } {
  const cosLat = Math.cos(latitude);
  return {
    x: cosLat * Math.cos(longitude),
    y: Math.sin(latitude),
    z: cosLat * Math.sin(longitude)
  };
}

function angularDistance(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1));
}

function findConjugateMarginPair(
  cell: number,
  fragmentIds: Int32Array,
  water: Uint8Array,
  elevation: Float32Array,
  seaLevel: number,
  topology: CubedSphereTopology,
  vectorX: number,
  vectorY: number
): number {
  const sourceFragment = fragmentIds[cell];
  if (sourceFragment < 0) return -1;
  let cursor = cell;
  let crossedOpenTerrain = false;
  for (let step = 0; step < 14; step += 1) {
    const next = stepTopologyByVector(topology, cursor, vectorX, vectorY);
    if (next === cursor) break;
    cursor = next;
    const fragment = fragmentIds[cursor];
    if (fragment >= 0) {
      return crossedOpenTerrain && fragment !== sourceFragment ? fragment : -1;
    }
    if (water[cursor] || elevation[cursor] <= seaLevel + 0.035) crossedOpenTerrain = true;
    else if (step > 2) break;
  }
  return -1;
}

function applyTopologyAging(
  project: DeepTimeProject,
  topology: CubedSphereTopology,
  forcing: OrbitalForcingSample,
  epoch: AgingEpoch,
  rng: RandomSource,
  cratonResistance: number[],
  cratonResistanceMap: Map<number, number>,
  impactHistory: ImpactHistoryAccumulator
): AgingCounters {
  const world = project.primaryWorld;
  const elevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const ice = world.topologyLayers.ice;
  const temperature = world.topologyLayers.temperature;
  const plates = world.topologyLayers.plates;
  const counters: AgingCounters = { iceCells: 0, eroded: 0, flooded: 0, coastal: 0, tectonic: 0, impacts: 0, weathered: 0 };

  applyAgeScaledImpacts(project, topology, epoch, rng, cratonResistanceMap, impactHistory, counters);

  for (let pass = 0; pass < epoch.erosionIterations; pass += 1) {
    const next = new Float32Array(elevation);
    for (let cell = 0; cell < elevation.length; cell += 1) {
      if (water[cell]) continue;
      let neighborMean = 0;
      let neighborCount = 0;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0) continue;
        neighborMean += elevation[neighbor];
        neighborCount += 1;
      }
      if (!neighborCount) continue;
      neighborMean /= neighborCount;
      const relief = elevation[cell] - neighborMean;
      if (relief <= 0.01) continue;
      const resistance = cratonResistance[plates[cell]] ?? 0.5;
      const weathering = relief * 0.035 * (1 - resistance * 0.55);
      next[cell] -= weathering;
      counters.weathered += 1;
    }
    elevation.set(next);
  }

  const polarThreshold = 0.72 - forcing.glaciationPressure * 0.18;
  for (let cell = 0; cell < elevation.length; cell += 1) {
    if (water[cell]) continue;
    const latitude = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const altitude = Math.max(0, elevation[cell] - world.seaLevel);
    const accumulation = latitude + altitude * 0.18 + forcing.glaciationPressure * 0.24 - Math.max(0, temperature[cell]) / 90;
    if (accumulation > polarThreshold) {
      ice[cell] = 1;
      counters.iceCells += 1;
      if (epoch.glacialIterations > 0 && altitude > 0.012) {
        const resistance = cratonResistance[plates[cell]] ?? 0.5;
        const erosion = Math.min(0.016, 0.0022 * epoch.glacialIterations * (0.45 + forcing.glaciationPressure) * (1 - resistance * 0.4));
        elevation[cell] -= erosion;
        counters.eroded += 1;
      }
    } else if (ice[cell] && forcing.deglaciationPressure > 0.6) {
      ice[cell] = 0;
    }
  }

  if (epoch.coastalIterations > 0) {
    const next = new Float32Array(elevation);
    for (let cell = 0; cell < elevation.length; cell += 1) {
      if (water[cell]) continue;
      let waterNeighbors = 0;
      let neighborMean = 0;
      let neighborCount = 0;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0) continue;
        waterNeighbors += water[neighbor] ? 1 : 0;
        neighborMean += elevation[neighbor];
        neighborCount += 1;
      }
      if (!waterNeighbors || !neighborCount) continue;
      const resistance = cratonResistance[plates[cell]] ?? 0.5;
      const weakness = clamp(1 - Math.abs(elevation[cell] - neighborMean / neighborCount) * 2.5, 0.08, 1);
      next[cell] -= weakness * waterNeighbors * 0.0011 * epoch.coastalIterations * (1 - resistance * 0.45);
      counters.coastal += 1;
    }
    elevation.set(next);
  }

  for (let cell = 0; cell < elevation.length; cell += 1) {
    const wasWater = Boolean(water[cell]);
    const isWater = elevation[cell] <= world.seaLevel;
    water[cell] = isWater ? 1 : 0;
    if (!wasWater && isWater) counters.flooded += 1;
    if (isWater) ice[cell] = 0;
  }

  return counters;
}

function finalSeaLevel(elevation: Float32Array, targetOceanPercentage: number): number {
  const values = Array.from(elevation).sort((a, b) => a - b);
  const targetIndex = Math.max(0, Math.min(values.length - 1, Math.round((targetOceanPercentage / 100) * (values.length - 1))));
  return values[targetIndex] ?? 0;
}

function assignFinalWater(world: DeepTimeProject['primaryWorld']): number {
  let corrections = 0;
  for (let cell = 0; cell < world.topologyLayers.elevation.length; cell += 1) {
    const next = world.topologyLayers.elevation[cell] <= world.seaLevel ? 1 : 0;
    if (world.topologyLayers.water[cell] !== next) corrections += 1;
    world.topologyLayers.water[cell] = next;
    if (next) world.topologyLayers.ice[cell] = 0;
  }
  return corrections;
}

function shapeFinalMarineDepths(world: DeepTimeProject['primaryWorld'], topology: CubedSphereTopology): number {
  const elevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const seaLevel = world.seaLevel;
  const distanceToLand = new Int16Array(topology.cellCount);
  distanceToLand.fill(32767);
  const queue: number[] = [];
  let head = 0;
  let adjusted = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (!water[cell]) {
      distanceToLand[cell] = 0;
      queue.push(cell);
    }
  }
  while (head < queue.length) {
    const cell = queue[head++];
    const distance = distanceToLand[cell];
    if (distance >= 8) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || distanceToLand[neighbor] <= distance + 1) continue;
      distanceToLand[neighbor] = distance + 1;
      queue.push(neighbor);
    }
  }

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (!water[cell]) continue;
    const distance = Math.min(8, distanceToLand[cell]);
    if (distance <= 1) continue;
    const distanceFactor = clamp((distance - 1) / 7, 0, 1);
    const targetDepth = 0.08 + Math.pow(distanceFactor, 1.32) * 0.58;
    const targetElevation = seaLevel - targetDepth;
    if (elevation[cell] > targetElevation) {
      elevation[cell] = elevation[cell] * (1 - distanceFactor * 0.72) + targetElevation * (distanceFactor * 0.72);
      adjusted += 1;
    }
  }
  return adjusted;
}

function percentileFromSorted(values: number[], fraction: number): number {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)))] ?? 0;
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function normalizeValue(value: number, min: number, max: number): number {
  return clamp((value - min) / Math.max(0.000001, max - min), 0, 1);
}

function smoothTopologyLayer(layer: Float32Array, topology: CubedSphereTopology, passes: number, blend: number, mask?: Uint8Array): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(layer);
    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      if (mask && mask[cell] !== 1) continue;
      let total = layer[cell];
      let count = 1;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || (mask && mask[neighbor] !== 1)) continue;
        total += layer[neighbor];
        count += 1;
      }
      next[cell] = layer[cell] * (1 - blend) + (total / count) * blend;
    }
    layer.set(next);
  }
}

function topologyTerrainGradient(layer: Float32Array, topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  let gx = 0;
  let gy = 0;
  let count = 0;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = topology.neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    const dx = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.max(0.12, Math.cos(topology.latitudes[cell]));
    const dy = topology.latitudes[neighbor] - topology.latitudes[cell];
    const distance2 = Math.max(0.000001, dx * dx + dy * dy);
    const delta = layer[neighbor] - layer[cell];
    gx += (delta * dx) / distance2;
    gy += (delta * dy) / distance2;
    count += 1;
  }
  return count ? { x: clamp(gx / count, -1, 1), y: clamp(gy / count, -1, 1) } : { x: 0, y: 0 };
}

function stepTopologyByVector(topology: CubedSphereTopology, cell: number, vectorX: number, vectorY: number): number {
  const length = Math.hypot(vectorX, vectorY);
  if (length < 0.0001) return cell;
  let best = cell;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = topology.neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    const dx = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.max(0.12, Math.cos(topology.latitudes[cell]));
    const dy = topology.latitudes[neighbor] - topology.latitudes[cell];
    const distance = Math.max(0.000001, Math.hypot(dx, dy));
    const score = (dx / distance) * (vectorX / length) + (dy / distance) * (vectorY / length);
    if (score > bestScore) {
      best = neighbor;
      bestScore = score;
    }
  }
  return best;
}

function computeTopologyInfluence(mask: Uint8Array, topology: CubedSphereTopology, radius: number, targetValue: number): Float32Array {
  const distance = new Float32Array(mask.length);
  const maxDistance = radius + 1;
  for (let cell = 0; cell < mask.length; cell += 1) distance[cell] = mask[cell] === targetValue ? 0 : maxDistance;
  for (let pass = 0; pass < radius; pass += 1) {
    for (let cell = 0; cell < mask.length; cell += 1) {
      let best = distance[cell];
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor >= 0) best = Math.min(best, distance[neighbor] + 1);
      }
      distance[cell] = best;
    }
  }
  for (let cell = 0; cell < distance.length; cell += 1) distance[cell] = clamp(1 - distance[cell] / maxDistance, 0, 1);
  return distance;
}

function presentDayWindVector(topology: CubedSphereTopology, elevation: Float32Array, temperature: Float32Array, cell: number, averageTemperatureC: number): { x: number; y: number } {
  const latitude = topology.latitudes[cell];
  const lat01 = latitude / (Math.PI / 2);
  const absLat = Math.abs(lat01);
  const hemisphere = latitude < 0 ? -1 : 1;
  const cellBand = absLat < 0.33 ? 0 : absLat < 0.66 ? 1 : 2;
  const zonalDirection = cellBand === 1 ? -hemisphere : hemisphere;
  const pressureGradient = cellBand === 0 ? -lat01 : cellBand === 1 ? hemisphere * 0.38 : -hemisphere * 0.25;
  const gradient = topologyTerrainGradient(elevation, topology, cell);
  const highlandBlock = clamp((elevation[cell] - 0.22) * 2.2, 0, 1);
  const thermal = normalizeValue(temperature[cell], averageTemperatureC - 18, averageTemperatureC + 18) - 0.5;
  const windward = Math.max(0, gradient.x * zonalDirection + gradient.y * pressureGradient);
  const deflect = highlandBlock * (0.45 + windward * 1.4);
  const x = zonalDirection * 0.56 - gradient.x * deflect - gradient.y * deflect * 0.42;
  const y = pressureGradient * 0.34 - gradient.y * deflect + gradient.x * deflect * 0.38 - thermal * 0.08;
  const magnitude = Math.max(0.001, Math.hypot(x, y));
  return { x: x / magnitude, y: y / magnitude };
}

function presentDayMoistureFetch(
  elevation: Float32Array,
  water: Uint8Array,
  topology: CubedSphereTopology,
  cell: number,
  windX: number,
  windY: number,
  oceanInfluence: number
): number {
  if (water[cell] === 1) return 1;
  let cursor = cell;
  let fetch = oceanInfluence * 0.45;
  for (let step = 0; step < 18; step += 1) {
    cursor = stepTopologyByVector(topology, cursor, -windX, -windY);
    const decay = 1 - step / 19;
    if (water[cursor] === 1) fetch += decay * 0.5;
    else fetch -= Math.max(0, elevation[cursor] - 0.32) * decay * 0.07;
  }
  return clamp(fetch, 0, 1);
}

function presentDayOrographicEffect(
  elevation: Float32Array,
  topology: CubedSphereTopology,
  cell: number,
  windX: number,
  windY: number
): { lift: number; shadow: number } {
  const gradient = topologyTerrainGradient(elevation, topology, cell);
  const upslope = Math.max(0, gradient.x * windX + gradient.y * windY);
  let cursor = cell;
  let shadow = 0;
  for (let step = 0; step < 12; step += 1) {
    cursor = stepTopologyByVector(topology, cursor, -windX, -windY);
    const barrier = Math.max(0, elevation[cursor] - elevation[cell] + 0.06) + Math.max(0, elevation[cursor] - 0.36) * 0.48;
    shadow = Math.max(shadow, barrier * (1 - step / 13));
  }
  return {
    lift: clamp(upslope * 2.9 + Math.max(0, elevation[cell] - 0.44) * 0.1, 0, 1),
    shadow: clamp(shadow * 1.25, 0, 1)
  };
}

function standardDeviation(values: number[], meanValue: number): number {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / values.length);
}

function meanNumber(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function buildFinalWaterDiagnostics(
  project: DeepTimeProject,
  topology: CubedSphereTopology,
  topologyWaterMaskCorrections: number,
  marineDepthAdjustedCells: number
): FinalWaterDiagnostics {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const elevation = layers.elevation;
  const water = layers.water;
  const lakes = layers.lakes;
  const seaLevel = world.seaLevel;
  const distanceToLand = new Int16Array(topology.cellCount);
  distanceToLand.fill(32767);
  const queue: number[] = [];
  let head = 0;
  let weightedWater = 0;
  let totalWeight = 0;
  let marineCellCount = 0;
  let lakeCellCount = 0;
  let coastCells = 0;
  let nearSeaLevelBand = 0;
  let immediateShelf = 0;
  let continentalShelf = 0;
  let shallowSea = 0;
  let ocean = 0;
  let deepOcean = 0;
  let broadShelfAwayFromCoast = 0;
  let marineDepthTotal = 0;
  const marineDepths: number[] = [];

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const weight = topology.areaWeights[cell] ?? 1;
    totalWeight += weight;
    if (water[cell]) weightedWater += weight;
    const altitude = elevation[cell] - seaLevel;
    if (Math.abs(altitude) <= 0.018) nearSeaLevelBand += 1;
    if (!water[cell]) {
      distanceToLand[cell] = 0;
      queue.push(cell);
    }
  }

  while (head < queue.length) {
    const cell = queue[head++];
    const distance = distanceToLand[cell];
    if (distance >= 5) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || distanceToLand[neighbor] <= distance + 1) continue;
      distanceToLand[neighbor] = distance + 1;
      queue.push(neighbor);
    }
  }

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const isWater = water[cell] === 1;
    let touchesOpposite = false;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor >= 0 && (water[neighbor] === 1) !== isWater) touchesOpposite = true;
    }
    if (touchesOpposite) coastCells += 1;
    if (!isWater) continue;
    marineCellCount += 1;
    if (lakes[cell]) lakeCellCount += 1;
    const depth = Math.max(0, seaLevel - elevation[cell]);
    marineDepthTotal += depth;
    marineDepths.push(depth);
    if (depth <= 0.04) immediateShelf += 1;
    else if (depth <= 0.12) continentalShelf += 1;
    else if (depth <= 0.24) shallowSea += 1;
    else if (depth <= 0.48) ocean += 1;
    else deepOcean += 1;
    if (depth <= 0.12 && distanceToLand[cell] > 3) broadShelfAwayFromCoast += 1;
  }

  marineDepths.sort((a, b) => a - b);
  const marine = Math.max(1, marineCellCount);
  const nearBandShare = nearSeaLevelBand / Math.max(1, topology.cellCount);
  const coastShare = coastCells / Math.max(1, topology.cellCount);
  const actualOceanPercentage = (weightedWater / Math.max(1e-9, totalWeight)) * 100;
  const coastlineSharpnessIndex = clamp(1 - nearBandShare / Math.max(0.01, coastShare * 2.8), 0, 1);

  return {
    modelVersion: 'final-water-diagnostics-v1',
    targetOceanPercentage: round(project.selectedValues.oceanPercentage, 3),
    actualOceanPercentage: round(actualOceanPercentage, 3),
    oceanErrorPercentagePoints: round(actualOceanPercentage - project.selectedValues.oceanPercentage, 3),
    seaLevel: round(seaLevel, 6),
    topologyWaterMaskCorrections,
    marineDepthAdjustedCells,
    marineCellCount,
    lakeCellCount,
    coastCellShare: round(coastShare, 5),
    coastlineSharpnessIndex: round(coastlineSharpnessIndex, 5),
    nearSeaLevelBandShare: round(nearBandShare, 5),
    immediateShelfShareOfMarine: round(immediateShelf / marine, 5),
    continentalShelfShareOfMarine: round(continentalShelf / marine, 5),
    shallowSeaShareOfMarine: round(shallowSea / marine, 5),
    oceanShareOfMarine: round(ocean / marine, 5),
    deepOceanShareOfMarine: round(deepOcean / marine, 5),
    broadShelfAwayFromCoastShare: round(broadShelfAwayFromCoast / marine, 5),
    meanMarineDepth: round(marineDepthTotal / marine, 6),
    medianMarineDepth: round(percentileFromSorted(marineDepths, 0.5), 6),
    p90MarineDepth: round(percentileFromSorted(marineDepths, 0.9), 6),
    notes: [
      'Final water diagnostics are computed from authoritative topology cells after sea-level reconciliation.',
      'Marine depth bands use topology elevation relative to final sea level; projected preview colors are not used.',
      'Broad shelf away from coast flags shallow marine water more than three topology steps from land.',
      'Final bathymetry shaping deepens marine cells away from land after the coastline mask is fixed.'
    ]
  };
}

function refreshTopologyClimate(project: DeepTimeProject, topology: CubedSphereTopology): number {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const count = topology.cellCount;
  const oceanInfluence = computeTopologyInfluence(layers.water, topology, 28, 1);
  const landInfluence = computeTopologyInfluence(layers.water, topology, 10, 0);
  const precipitation = new Float32Array(count);
  const moisture = new Float32Array(count);

  for (let cell = 0; cell < count; cell += 1) {
    const latitude = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const altitude = Math.max(0, layers.elevation[cell] - world.seaLevel);
    const ocean = layers.water[cell] === 1;
    const latitudeCooling = Math.pow(latitude, 1.3) * 38;
    const altitudeCooling = altitude * 20;
    const oceanModeration = ocean ? 2.5 * (1 - latitude * 0.4) : 0;
    const iceCooling = layers.ice[cell] ? 5 : 0;
    layers.temperature[cell] = world.averageTemperatureC + 10 - latitudeCooling - altitudeCooling + oceanModeration - iceCooling;

    const wind = presentDayWindVector(topology, layers.elevation, layers.temperature, cell, world.averageTemperatureC);
    const fetch = presentDayMoistureFetch(layers.elevation, layers.water, topology, cell, wind.x, wind.y, oceanInfluence[cell]);
    const orographic = presentDayOrographicEffect(layers.elevation, topology, cell, wind.x, wind.y);
    const absLatitude = Math.abs(topology.latitudes[cell]);
    const itcz = Math.exp(-(topology.latitudes[cell] ** 2) / 0.085) * 0.22;
    const stormTrack = Math.exp(-((absLatitude - 0.72) ** 2) / 0.055) * 0.16;
    const subtropicalDry = Math.exp(-((absLatitude - 0.53) ** 2) / 0.04) * 0.18;
    const coastalWetness = landInfluence[cell] * oceanInfluence[cell] * 0.1;
    const thermalMoisture = normalizeValue(layers.temperature[cell], -8, 30) * 0.08;
    const altitudeDrying = Math.max(0, altitude - 0.24) * 0.22;
    const climateBase = fetch * 0.56 + (1 - project.selectedValues.aridity) * 0.3 + itcz + stormTrack + coastalWetness + thermalMoisture;
    const landPrecipitation = clamp(climateBase + orographic.lift * 0.5 - orographic.shadow * 0.92 - subtropicalDry - altitudeDrying, 0, 1);
    precipitation[cell] = ocean ? clamp(normalizeValue(layers.temperature[cell], -4, 32) * 0.72 + oceanInfluence[cell] * 0.1, 0.1, 0.95) : landPrecipitation;
    moisture[cell] = ocean ? 1 : clamp(landPrecipitation * 0.82 + oceanInfluence[cell] * 0.14 + Math.max(0, layers.wetness[cell] - 0.52) * 0.06, 0.02, 1);
    layers.climateMoisture[cell] = moisture[cell];
    layers.climatePrecipitation[cell] = precipitation[cell];
    layers.climateWetnessDelta[cell] = 0;

    if (layers.ice[cell] && layers.temperature[cell] > 3) layers.ice[cell] = 0;
    if (layers.water[cell]) layers.ice[cell] = 0;
  }

  smoothTopologyLayer(moisture, topology, 1, 0.18);
  smoothTopologyLayer(precipitation, topology, 1, 0.14);

  for (let cell = 0; cell < count; cell += 1) {
    const previous = layers.wetness[cell];
    layers.climateMoisture[cell] = layers.water[cell] ? 1 : moisture[cell];
    layers.climatePrecipitation[cell] = precipitation[cell];
    layers.wetness[cell] = layers.water[cell] ? 1 : clamp(precipitation[cell] * 0.78 + moisture[cell] * 0.22, 0, 1);
    layers.climateWetnessDelta[cell] = layers.wetness[cell] - previous;
  }

  if (world.climate) {
    world.climate.notes = [
      ...world.climate.notes.filter((note) => !note.startsWith('Present-day layers refreshed')),
      'Present-day layers refreshed after deep-time terrain, water, and ice reconciliation.'
    ];
  }
  return count;
}

function buildPresentClimateDiagnostics(project: DeepTimeProject, topology: CubedSphereTopology): PresentClimateDiagnostics {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const landTemperature: number[] = [];
  const landPrecipitation: number[] = [];
  const landWetness: number[] = [];
  let marineCells = 0;
  let coastalWetness = 0;
  let coastalCount = 0;
  let inlandWetness = 0;
  let inlandCount = 0;
  let liftTotal = 0;
  let shadowTotal = 0;
  let rainShadowCells = 0;
  let desertRisk = 0;
  let tundraRisk = 0;
  let wetlandRisk = 0;
  let desertWetlandOverlap = 0;
  const oceanInfluence = computeTopologyInfluence(layers.water, topology, 16, 1);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (layers.water[cell]) {
      marineCells += 1;
      continue;
    }
    const wind = presentDayWindVector(topology, layers.elevation, layers.temperature, cell, world.averageTemperatureC);
    const orographic = presentDayOrographicEffect(layers.elevation, topology, cell, wind.x, wind.y);
    liftTotal += orographic.lift;
    shadowTotal += orographic.shadow;
    if (orographic.shadow > 0.2 && layers.climatePrecipitation[cell] < 0.28) rainShadowCells += 1;
    landTemperature.push(layers.temperature[cell]);
    landPrecipitation.push(layers.climatePrecipitation[cell]);
    landWetness.push(layers.wetness[cell]);
    if (oceanInfluence[cell] > 0.45) {
      coastalWetness += layers.wetness[cell];
      coastalCount += 1;
    } else if (oceanInfluence[cell] < 0.12) {
      inlandWetness += layers.wetness[cell];
      inlandCount += 1;
    }
    if (layers.wetness[cell] < 0.22 && layers.temperature[cell] > 1.5) desertRisk += 1;
    if (layers.temperature[cell] <= 1.5) tundraRisk += 1;
    if (layers.lakes[cell] || (layers.river[cell] > 0.5 && layers.wetness[cell] > 0.66)) wetlandRisk += 1;
    if (layers.wetness[cell] < 0.22 && (layers.lakes[cell] || layers.river[cell] > 0.5)) desertWetlandOverlap += 1;
  }

  landTemperature.sort((a, b) => a - b);
  landPrecipitation.sort((a, b) => a - b);
  landWetness.sort((a, b) => a - b);
  const landCount = Math.max(1, landPrecipitation.length);
  const meanPrecipitation = meanNumber(landPrecipitation);
  const meanWetness = meanNumber(landWetness);
  const precipitationStdDev = standardDeviation(landPrecipitation, meanPrecipitation);
  const wetnessStdDev = standardDeviation(landWetness, meanWetness);
  const p10Precip = percentileFromSorted(landPrecipitation, 0.1);
  const p90Precip = percentileFromSorted(landPrecipitation, 0.9);
  const notes = [
    'Present-climate diagnostics inspect authoritative topology cells after final sea level and before biome projection.',
    'Land precipitation excludes marine cells so ocean evaporation does not hide flat or dry land rainfall.',
    'Rain-shadow index counts dry land cells with a significant upwind terrain barrier.'
  ];
  const flatnessIndex = clamp(1 - (p90Precip - p10Precip) / 0.42, 0, 1);
  if (flatnessIndex > 0.72) notes.push('Land precipitation distribution is unusually flat; rainfall may not be varying enough for biome classification.');
  if (desertWetlandOverlap / landCount > 0.03) notes.push('Dry climate cells overlap with river/lake wetland signals more than expected; inspect hydrology versus biome classification.');

  return {
    modelVersion: 'present-climate-diagnostics-v1',
    landCellCount: landPrecipitation.length,
    marineCellCount: marineCells,
    meanTemperatureC: round(meanNumber(landTemperature), 3),
    medianTemperatureC: round(percentileFromSorted(landTemperature, 0.5), 3),
    p10TemperatureC: round(percentileFromSorted(landTemperature, 0.1), 3),
    p90TemperatureC: round(percentileFromSorted(landTemperature, 0.9), 3),
    meanLandPrecipitation: round(meanPrecipitation, 5),
    medianLandPrecipitation: round(percentileFromSorted(landPrecipitation, 0.5), 5),
    p10LandPrecipitation: round(p10Precip, 5),
    p90LandPrecipitation: round(p90Precip, 5),
    landPrecipitationStdDev: round(precipitationStdDev, 5),
    precipitationFlatnessIndex: round(flatnessIndex, 5),
    meanLandWetness: round(meanWetness, 5),
    medianLandWetness: round(percentileFromSorted(landWetness, 0.5), 5),
    landWetnessStdDev: round(wetnessStdDev, 5),
    coastalWetnessGradient: round((coastalWetness / Math.max(1, coastalCount)) - (inlandWetness / Math.max(1, inlandCount)), 5),
    inlandAridityIndex: round(1 - inlandWetness / Math.max(1, inlandCount), 5),
    rainShadowIndex: round(rainShadowCells / landCount, 5),
    orographicLiftMean: round(liftTotal / landCount, 5),
    orographicShadowMean: round(shadowTotal / landCount, 5),
    desertRiskShare: round(desertRisk / landCount, 5),
    tundraRiskShare: round(tundraRisk / landCount, 5),
    wetlandRiskShare: round(wetlandRisk / landCount, 5),
    desertWetlandOverlapShare: round(desertWetlandOverlap / landCount, 5),
    notes
  };
}

function rebuildTopologyHydrology(project: DeepTimeProject, topology: CubedSphereTopology): { cells: number; rivers: River[]; diagnostics: HydrologyDiagnostics } {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const count = topology.cellCount;
  const downstream = new Int32Array(count);
  downstream.fill(-1);
  const accumulation = new Float32Array(count);
  layers.river.fill(0);
  layers.lakes.fill(0);

  for (let cell = 0; cell < count; cell += 1) {
    accumulation[cell] = layers.water[cell] ? 0 : 0.08 + layers.climatePrecipitation[cell] + layers.wetness[cell] * 0.25;
    if (layers.water[cell]) continue;
    let best = -1;
    let bestElevation = layers.elevation[cell];
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0) continue;
      const neighborElevation = layers.water[neighbor] ? world.seaLevel - 0.001 : layers.elevation[neighbor];
      if (neighborElevation < bestElevation - 0.00001) {
        bestElevation = neighborElevation;
        best = neighbor;
      }
    }
    downstream[cell] = best;
    if (best < 0) layers.lakes[cell] = 1;
  }

  const order = Array.from({ length: count }, (_, index) => index).sort((a, b) => layers.elevation[b] - layers.elevation[a]);
  for (const cell of order) {
    const target = downstream[cell];
    if (target >= 0) accumulation[target] += accumulation[cell];
  }

  let maxAccumulation = 0;
  for (let cell = 0; cell < count; cell += 1) maxAccumulation = Math.max(maxAccumulation, accumulation[cell]);
  const riverThreshold = clamp(0.075 / Math.max(0.4, project.selectedValues.riverDensity), 0.018, 0.12);
  for (let cell = 0; cell < count; cell += 1) {
    if (layers.water[cell]) continue;
    layers.river[cell] = clamp(accumulation[cell] / Math.max(0.001, maxAccumulation) / riverThreshold, 0, 1);
  }

  const candidateSources = order
    .filter((cell) => !layers.water[cell] && layers.river[cell] > 0.72 && layers.elevation[cell] > world.seaLevel + 0.04);
  const tracedCandidates = candidateSources
    .map((source) => traceHydrologyCandidate(source, downstream, layers, world.seaLevel, count))
    .filter((candidate) => candidate.path.length >= 5)
    .sort((a, b) => hydrologyTrunkScore(b, accumulation, layers, world.seaLevel) - hydrologyTrunkScore(a, accumulation, layers, world.seaLevel));
  const claimed = new Uint8Array(count);
  const rivers: River[] = [];
  const maximumRivers = Math.min(240, Math.max(12, Math.round(project.selectedValues.riverDensity * 42)));
  const trunkTarget = Math.max(6, Math.round(maximumRivers * 0.58));

  addHydrologyCandidatesAsRivers(tracedCandidates, rivers, claimed, trunkTarget, 0.62, true);
  addHydrologyCandidatesAsRivers(tracedCandidates, rivers, claimed, maximumRivers, 0.34, false);

  const diagnostics = buildHydrologyDiagnostics(project, topology, downstream, accumulation, candidateSources.length, maximumRivers, rivers);
  return { cells: count, rivers, diagnostics };
}

type HydrologyCandidate = {
  source: number;
  path: number[];
  terminus: River['terminus'];
};

function traceHydrologyCandidate(
  source: number,
  downstream: Int32Array,
  layers: DeepTimeProject['primaryWorld']['topologyLayers'],
  seaLevel: number,
  maxSteps: number
): HydrologyCandidate {
  const path: number[] = [];
  const visited = new Set<number>();
  let cell = source;
  let terminus: River['terminus'] = 'basin';
  for (let step = 0; step < maxSteps; step += 1) {
    if (visited.has(cell)) break;
    visited.add(cell);
    path.push(cell);
    if (layers.water[cell]) {
      terminus = 'ocean';
      break;
    }
    if (layers.lakes[cell]) {
      terminus = 'lake';
      break;
    }
    const next = downstream[cell];
    if (next < 0) {
      terminus = layers.wetness[cell] > 0.75 ? 'wetland' : 'basin';
      break;
    }
    cell = next;
  }
  void seaLevel;
  return { source, path, terminus };
}

function hydrologyTrunkScore(
  candidate: HydrologyCandidate,
  accumulation: Float32Array,
  layers: DeepTimeProject['primaryWorld']['topologyLayers'],
  seaLevel: number
): number {
  const source = candidate.path[0] ?? candidate.source;
  const mouth = candidate.path[candidate.path.length - 1] ?? source;
  const sourceAltitude = Math.max(0, (layers.elevation[source] ?? seaLevel) - seaLevel);
  const mouthAltitude = Math.max(0, (layers.elevation[mouth] ?? seaLevel) - seaLevel);
  const drop = Math.max(0, sourceAltitude - mouthAltitude);
  const pathLength = candidate.path.length;
  const accumulationScore = Math.log1p(accumulation[source] ?? 0) + Math.log1p(accumulation[mouth] ?? 0) * 0.35;
  const terminusScore = candidate.terminus === 'ocean' ? 1.2 : candidate.terminus === 'lake' ? 1.0 : candidate.terminus === 'wetland' ? 0.72 : 0.42;
  const shortPenalty = pathLength <= 7 ? 1.35 : pathLength <= 10 ? 0.38 : 0;
  return pathLength * 0.38 + drop * 8 + sourceAltitude * 1.8 + accumulationScore * 0.42 + terminusScore - shortPenalty;
}

function addHydrologyCandidatesAsRivers(
  candidates: HydrologyCandidate[],
  rivers: River[],
  claimed: Uint8Array,
  limit: number,
  maxClaimedShare: number,
  trunksOnly: boolean
): void {
  for (const candidate of candidates) {
    if (rivers.length >= limit) break;
    const landPath = candidate.path.filter((cell) => claimed[cell] === 0);
    const claimedShare = 1 - landPath.length / Math.max(1, candidate.path.length);
    if (claimedShare > maxClaimedShare) continue;
    if (trunksOnly && candidate.path.length < 9) continue;
    const source = candidate.path[0];
    if (source === undefined || claimed[source]) continue;
    for (const pathCell of candidate.path) claimed[pathCell] = 1;
    rivers.push({
      id: `river-${rivers.length + 1}`,
      path: [],
      topologyPath: candidate.path,
      sourceIndex: source,
      mouthIndex: candidate.path[candidate.path.length - 1] ?? source,
      terminus: candidate.terminus
    });
  }
}

function buildHydrologyDiagnostics(
  project: DeepTimeProject,
  topology: CubedSphereTopology,
  downstream: Int32Array,
  accumulation: Float32Array,
  sourceCandidateCount: number,
  maximumRiverCount: number,
  rivers: River[]
): HydrologyDiagnostics {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const landPrecipitation: number[] = [];
  const accumulationValues: number[] = [];
  const pathLengths = rivers.map((river) => river.topologyPath?.length ?? river.path.length).sort((a, b) => a - b);
  const sourceElevations: number[] = [];
  const mouthElevations: number[] = [];
  const sourceToMouthDrops: number[] = [];
  const namedPathCells = new Uint8Array(topology.cellCount);
  const sectorHasLand = new Uint8Array(8);
  const sectorHasRiver = new Uint8Array(8);
  let landCells = 0;
  let wetLand = 0;
  let highPrecipitation = 0;
  let headwaterCandidates = 0;
  let highReliefWet = 0;
  let mountainHeadwaters = 0;
  let topologyRiverCells = 0;
  let topologyMinorRiverCells = 0;
  let topologyNavigableRiverCells = 0;
  let lakeCells = 0;
  let closedBasins = 0;
  const termini = { ocean: 0, lake: 0, wetland: 0, basin: 0 };

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (layers.water[cell]) continue;
    landCells += 1;
    const longitudeSector = Math.min(7, Math.max(0, Math.floor(((topology.longitudes[cell] + Math.PI) / (Math.PI * 2)) * 8)));
    sectorHasLand[longitudeSector] = 1;
    const altitude = layers.elevation[cell] - world.seaLevel;
    const localRelief = topologyLocalRelief(layers.elevation, topology, cell);
    landPrecipitation.push(layers.climatePrecipitation[cell]);
    accumulationValues.push(accumulation[cell]);
    if (layers.wetness[cell] >= 0.48) wetLand += 1;
    if (layers.climatePrecipitation[cell] >= 0.5) highPrecipitation += 1;
    if (altitude > 0.08 && layers.wetness[cell] >= 0.35 && downstream[cell] >= 0) headwaterCandidates += 1;
    if (localRelief >= 0.12 && layers.wetness[cell] >= 0.34) highReliefWet += 1;
    if (altitude > 0.28 && layers.climatePrecipitation[cell] >= 0.28) mountainHeadwaters += 1;
    if (layers.river[cell] > 0.05) {
      topologyRiverCells += 1;
      sectorHasRiver[longitudeSector] = 1;
    }
    if (layers.river[cell] > 0.12) topologyMinorRiverCells += 1;
    if (layers.river[cell] > 0.62) topologyNavigableRiverCells += 1;
    if (layers.lakes[cell]) lakeCells += 1;
    if (downstream[cell] < 0) closedBasins += 1;
  }

  for (const river of rivers) {
    termini[river.terminus] += 1;
    const source = river.topologyPath?.[0] ?? river.sourceIndex;
    const mouth = river.topologyPath?.[river.topologyPath.length - 1] ?? river.mouthIndex;
    const sourceElevation = (layers.elevation[source] ?? world.seaLevel) - world.seaLevel;
    const mouthElevation = (layers.elevation[mouth] ?? world.seaLevel) - world.seaLevel;
    sourceElevations.push(sourceElevation);
    mouthElevations.push(mouthElevation);
    sourceToMouthDrops.push(sourceElevation - mouthElevation);
    for (const pathCell of river.topologyPath ?? []) if (!layers.water[pathCell]) namedPathCells[pathCell] = 1;
  }

  landPrecipitation.sort((a, b) => a - b);
  accumulationValues.sort((a, b) => a - b);
  sourceElevations.sort((a, b) => a - b);
  mouthElevations.sort((a, b) => a - b);
  sourceToMouthDrops.sort((a, b) => a - b);
  const land = Math.max(1, landCells);
  const riverCount = Math.max(1, rivers.length);
  let namedPathCellCount = 0;
  for (const value of namedPathCells) namedPathCellCount += value;
  const shortRiverShare = pathLengths.filter((length) => length <= 7).length / riverCount;
  const landSectors = Array.from(sectorHasLand).filter(Boolean).length;
  const riverSectors = Array.from(sectorHasRiver).filter(Boolean).length;
  const notes = [
    'Hydrology diagnostics separate climate input, terrain/headwater support, topology river signal, and named river acceptance.',
    'Hex export loss is measured in app/export diagnostics because exporter semantics are downstream of generator-core.',
    'River distribution evenness is a coarse longitude-sector occupancy metric, not a watershed-quality score.'
  ];
  const riverCellShare = topologyRiverCells / land;
  const headwaterShare = headwaterCandidates / land;
  if (headwaterShare < 0.08) notes.push('Terrain/climate headwater candidate share is low; sparse rivers may be upstream of the hydrology threshold.');
  if (riverCellShare < 0.04 && headwaterShare >= 0.08) notes.push('Topology river signal is sparse despite available headwater candidates; inspect accumulation thresholds.');
  if (rivers.length < maximumRiverCount * 0.45 && sourceCandidateCount >= maximumRiverCount) notes.push('Named river acceptance is below capacity even though source candidates exist; path claiming or minimum path length may be suppressing rivers.');
  if (shortRiverShare > 0.55) notes.push('Most named rivers are short at topology scale; sparse tile export is likely from short paths collapsing during downsampling.');

  return {
    modelVersion: 'hydrology-diagnostics-v1',
    landCellCount: landCells,
    climateInputMeanPrecipitation: round(meanNumber(landPrecipitation), 5),
    climateInputWetLandShare: round(wetLand / land, 5),
    climateInputHighPrecipitationShare: round(highPrecipitation / land, 5),
    terrainHeadwaterCandidateShare: round(headwaterShare, 5),
    terrainHighReliefWetShare: round(highReliefWet / land, 5),
    terrainMountainHeadwaterShare: round(mountainHeadwaters / land, 5),
    sourceCandidateCount,
    acceptedRiverCount: rivers.length,
    maximumRiverCount,
    namedRiverCapacityUse: round(rivers.length / Math.max(1, maximumRiverCount), 5),
    topologyRiverCellShare: round(riverCellShare, 5),
    topologyMinorRiverCellShare: round(topologyMinorRiverCells / land, 5),
    topologyNavigableRiverCellShare: round(topologyNavigableRiverCells / land, 5),
    namedRiverPathCellShare: round(namedPathCellCount / land, 5),
    shortRiverShare: round(shortRiverShare, 5),
    medianSourceToMouthDrop: round(percentileFromSorted(sourceToMouthDrops, 0.5), 5),
    meanRiverPathLength: round(meanNumber(pathLengths), 3),
    medianRiverPathLength: round(percentileFromSorted(pathLengths, 0.5), 3),
    p90RiverPathLength: round(percentileFromSorted(pathLengths, 0.9), 3),
    meanSourceElevationAboveSeaLevel: round(meanNumber(sourceElevations), 5),
    medianSourceElevationAboveSeaLevel: round(percentileFromSorted(sourceElevations, 0.5), 5),
    meanMouthElevationAboveSeaLevel: round(meanNumber(mouthElevations), 5),
    oceanTerminusShare: round(termini.ocean / riverCount, 5),
    lakeTerminusShare: round(termini.lake / riverCount, 5),
    wetlandTerminusShare: round(termini.wetland / riverCount, 5),
    basinTerminusShare: round(termini.basin / riverCount, 5),
    lakeCellShareOfLand: round(lakeCells / land, 5),
    closedBasinShareOfLand: round(closedBasins / land, 5),
    riverDistributionEvenness: round(riverSectors / Math.max(1, landSectors), 5),
    maxAccumulation: round(accumulationValues[accumulationValues.length - 1] ?? 0, 5),
    p90Accumulation: round(percentileFromSorted(accumulationValues, 0.9), 5),
    p99Accumulation: round(percentileFromSorted(accumulationValues, 0.99), 5),
    notes
  };
}

function topologyLocalRelief(layer: Float32Array, topology: CubedSphereTopology, cell: number): number {
  let min = layer[cell];
  let max = layer[cell];
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = topology.neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    min = Math.min(min, layer[neighbor]);
    max = Math.max(max, layer[neighbor]);
  }
  return max - min;
}

function classifyTopologyBiomes(project: DeepTimeProject): number {
  const world = project.primaryWorld;
  const layers = world.topologyLayers;
  const ocean = biomeToCode('ocean');
  const iceCap = biomeToCode('ice_cap');
  const tundra = biomeToCode('tundra');
  const desert = biomeToCode('desert');
  const grassland = biomeToCode('grassland');
  const forest = biomeToCode('forest');
  const rainforest = biomeToCode('rainforest');
  const wetland = biomeToCode('wetland');
  let corrections = 0;

  for (let cell = 0; cell < layers.biomes.length; cell += 1) {
    let next = grassland;
    const altitude = layers.elevation[cell] - world.seaLevel;
    if (layers.water[cell]) next = ocean;
    else if (layers.ice[cell]) next = iceCap;
    else if (layers.lakes[cell] || (layers.river[cell] > 0.5 && layers.wetness[cell] > 0.66)) next = wetland;
    else if (layers.temperature[cell] <= 1.5) next = tundra;
    else if (layers.wetness[cell] < 0.2) next = desert;
    else if (layers.temperature[cell] > 20 && layers.wetness[cell] > 0.72) next = rainforest;
    else if (layers.wetness[cell] > 0.5) next = forest;
    if (layers.biomes[cell] !== next) corrections += 1;
    layers.biomes[cell] = next;
  }
  return corrections;
}

function projectFinalTopology(project: DeepTimeProject, topology: CubedSphereTopology): number {
  const world = project.primaryWorld;
  const source = world.topologyLayers;
  const target = world.layers;
  const { width, height } = world.mapModel.resolution;

  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const cell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const index = y * width + x;
      target.elevation[index] = source.elevation[cell];
      target.plates[index] = source.plates[cell];
      target.water[index] = source.water[cell];
      target.temperature[index] = source.temperature[cell];
      target.wetness[index] = source.wetness[cell];
      target.climateMoisture[index] = source.climateMoisture[cell];
      target.climatePrecipitation[index] = source.climatePrecipitation[cell];
      target.climateWetnessDelta[index] = source.climateWetnessDelta[cell];
      target.biomes[index] = source.biomes[cell];
      target.ice[index] = source.ice[cell];
      target.river[index] = source.river[cell];
      target.lakes[index] = source.lakes[cell];

      target.windX[index] = 0;
      target.windY[index] = 0;
      target.currentX[index] = 0;
      target.currentY[index] = 0;
    }
  }
  return width * height;
}

function projectRiverPaths(project: DeepTimeProject, topology: CubedSphereTopology, rivers: River[]): River[] {
  const { width, height } = project.primaryWorld.mapModel.resolution;
  return rivers.map((river) => {
    const path: number[] = [];
    for (const cell of river.topologyPath ?? []) {
      const longitude = topology.longitudes[cell];
      const latitude = topology.latitudes[cell];
      const x = Math.max(0, Math.min(width - 1, Math.floor(((longitude + Math.PI) / (Math.PI * 2)) * width)));
      const y = Math.max(0, Math.min(height - 1, Math.floor((0.5 - latitude / Math.PI) * height)));
      const index = y * width + x;
      if (path[path.length - 1] !== index) path.push(index);
    }
    return {
      ...river,
      path,
      sourceIndex: path[0] ?? 0,
      mouthIndex: path[path.length - 1] ?? 0
    };
  }).filter((river) => river.path.length > 1);
}

function refreshMetrics(project: DeepTimeProject): SurfaceConsistencyDiagnostics {
  const world = project.primaryWorld;
  let waterCount = 0;
  let iceCount = 0;
  let lakeCount = 0;
  let biomeCorrections = 0;
  let invalidRiverCellsCleared = 0;
  const biomeCounts = Object.fromEntries(biomeNames.map((biome) => [biome, 0])) as Record<Biome, number>;
  const oceanCode = biomeToCode('ocean');
  const iceCode = biomeToCode('ice_cap');

  for (let index = 0; index < world.layers.water.length; index += 1) {
    if (world.layers.water[index]) {
      waterCount += 1;
      if (world.layers.biomes[index] !== oceanCode) {
        world.layers.biomes[index] = oceanCode;
        biomeCorrections += 1;
      }
      if (world.layers.river[index] > 0) {
        world.layers.river[index] = 0;
        invalidRiverCellsCleared += 1;
      }
    } else if (world.layers.ice[index]) {
      iceCount += 1;
      if (world.layers.biomes[index] !== iceCode) {
        world.layers.biomes[index] = iceCode;
        biomeCorrections += 1;
      }
    }
    if (world.layers.lakes[index]) lakeCount += 1;
    biomeCounts[codeToBiome(world.layers.biomes[index])] += 1;
  }

  const oceanPercentage = round((waterCount / Math.max(1, world.layers.water.length)) * 100, 2);
  world.oceanPercentage = oceanPercentage;
  project.metrics.oceanPercentage = oceanPercentage;
  project.metrics.landPercentage = round(100 - oceanPercentage, 2);
  project.metrics.icePercentage = round((iceCount / Math.max(1, world.layers.ice.length)) * 100, 2);
  project.metrics.riverCount = world.rivers.length;
  project.metrics.lakeCellCount = lakeCount;
  project.metrics.biomeCounts = biomeCounts;
  project.metrics.validation.oceanWithinTolerance = Math.abs(oceanPercentage - project.selectedValues.oceanPercentage) <= project.selectedValues.oceanTolerancePercentagePoints;
  project.metrics.validation.riverPathsValid = world.rivers.every((river) => river.path.length > 1 && river.path.every((index) => index >= 0 && index < world.layers.water.length));

  const findings: string[] = [];
  if (!project.metrics.validation.oceanWithinTolerance) findings.push('Final ocean coverage moved outside the configured tolerance during deep-time aging.');
  if (!project.metrics.validation.riverPathsValid) findings.push('One or more final river paths failed consistency validation.');
  findings.push('Present-day climate, hydrology, biome, and projection layers were rebuilt from final aged topology.');

  return {
    waterMaskCorrections: 0,
    topologyWaterMaskCorrections: 0,
    biomeCorrections,
    invalidRiverCellsCleared,
    riverPathsTrimmed: 0,
    oceanPercentage,
    climateCellsRefreshed: world.topology.cellCount,
    hydrologyCellsRebuilt: world.topology.cellCount,
    projectedCellsRefreshed: world.layers.water.length,
    findings
  };
}

export function applyDeepTimeFoundation(project: WorldProject, onProgress?: (progress: DeepTimeProgress) => void): DeepTimeProject {
  const mutable = project as DeepTimeProject;
  const rng = randomSource(`${project.seed}:deep-time-v2`);
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  onProgress?.({ phase: 'initializing', progress: 0.04, message: 'Initializing stellar, orbital, craton, and epoch models' });
  const stellarModel = buildStellarModel(project, rng);
  const planetaryDynamics = buildPlanetaryDynamics(project, stellarModel, rng);
  const cratons = buildCratons(project, rng);
  const resistanceByPlate = cratonResistanceByPlate(cratons);
  const resistance = createPlateResistanceLookup(resistanceByPlate, mutable.primaryWorld.plates);
  const plateLookup = createPlateLookup(mutable.primaryWorld.plates);
  const fragmentLineageSeeds = captureFragmentLineageSeeds(mutable.primaryWorld.topologyLayers.plates, topology, plateLookup);
  const epochs = buildEpochs(project.selectedValues.systemAgeGy);
  const forcingSamples: OrbitalForcingSample[] = [];
  let persistentIceCells = 0;
  let glaciallyErodedCells = 0;
  let floodedValleyCells = 0;
  let coastalAdjustedCells = 0;
  let tectonicAdjustedCells = 0;
  let impactAdjustedCells = 0;
  let weatheredCells = 0;
  let surfaceAgingSampleCount = 0;
  const impactHistory = createImpactHistory();

  mutable.solarSystem.stellarModel = stellarModel;
  mutable.primaryWorld.planetaryDynamics = planetaryDynamics;
  mutable.primaryWorld.geology = { cratons };
  onProgress?.({ phase: 'initializing', progress: 0.055, message: 'Applying authoritative continental fragment transforms' });
  const fragmentPlacement = applyAuthoritativeFragmentTransforms(mutable, fragmentLineageSeeds, topology, plateLookup);

  for (const epoch of epochs) {
    onProgress?.({
      phase: 'epoch',
      progress: 0.06 + ((epoch.index + 1) / epochs.length) * 0.7,
      message: `Deep-time epoch ${epoch.index + 1} of ${epochs.length}`,
      epochIndex: epoch.index,
      epochCount: epochs.length
    });
    for (let sampleIndex = 0; sampleIndex < Math.max(1, epoch.climateSamples); sampleIndex += 1) {
      const forcing = orbitalForcing(planetaryDynamics, stellarModel, epoch, sampleIndex);
      forcingSamples.push(forcing);
      surfaceAgingSampleCount += 1;
      const result = applyTopologyAging(
        mutable,
        topology,
        forcing,
        epoch,
        rng,
        resistance,
        resistanceByPlate,
        impactHistory
      );
      persistentIceCells = Math.max(persistentIceCells, result.iceCells);
      glaciallyErodedCells += result.eroded;
      floodedValleyCells += result.flooded;
      coastalAdjustedCells += result.coastal;
      tectonicAdjustedCells += result.tectonic;
      impactAdjustedCells += result.impacts;
      weatheredCells += result.weathered;
    }
  }

  onProgress?.({ phase: 'reconciling', progress: 0.77, message: 'Applying fragment-history terrain response' });
  const fragmentHistory = buildFragmentHistoryDiagnostics(mutable, topology, plateLookup, fragmentLineageSeeds, {
    applyTerrainResponse: true,
    terrainResponseScale: 0.95,
    applyVolcanismResponse: true,
    volcanismResponseScale: 0.35,
    surfaceAgingSampleCount,
    directTransformDiagnostics: fragmentPlacement
  });

  onProgress?.({ phase: 'reconciling', progress: 0.79, message: 'Resolving final sea level and water masks' });
  mutable.primaryWorld.seaLevel = finalSeaLevel(mutable.primaryWorld.topologyLayers.elevation, project.selectedValues.oceanPercentage);
  const topologyWaterMaskCorrections = assignFinalWater(mutable.primaryWorld);
  const marineDepthAdjustedCells = shapeFinalMarineDepths(mutable.primaryWorld, topology);

  onProgress?.({ phase: 'reconciling', progress: 0.84, message: 'Rebuilding present-day climate and moisture' });
  const climateCellsRefreshed = refreshTopologyClimate(mutable, topology);

  onProgress?.({ phase: 'reconciling', progress: 0.89, message: 'Rebuilding drainage, rivers, lakes, and wetlands' });
  const hydrology = rebuildTopologyHydrology(mutable, topology);
  mutable.primaryWorld.rivers = hydrology.rivers;
  const finalWater = buildFinalWaterDiagnostics(mutable, topology, topologyWaterMaskCorrections, marineDepthAdjustedCells);
  const presentClimate = buildPresentClimateDiagnostics(mutable, topology);

  onProgress?.({ phase: 'reconciling', progress: 0.93, message: 'Reclassifying final biomes and projecting aged topology' });
  const topologyBiomeCorrections = classifyTopologyBiomes(mutable);
  const projectedCellsRefreshed = projectFinalTopology(mutable, topology);
  applyBasinAwareCirculation(mutable);
  mutable.primaryWorld.rivers = projectRiverPaths(mutable, topology, mutable.primaryWorld.rivers);
  const consistency = refreshMetrics(mutable);
  if (fragmentPlacement.retainedCellRatio < 0.97) consistency.findings.push('Authoritative fragment placement retained less than 97 percent of source continental cells.');
  if (fragmentPlacement.mergedCollisionCellShare > 0.01) consistency.findings.push('Fragment placement required merged collision handling across more than one percent of topology cells.');
  consistency.topologyWaterMaskCorrections = topologyWaterMaskCorrections;
  consistency.biomeCorrections += topologyBiomeCorrections;
  consistency.climateCellsRefreshed = climateCellsRefreshed;
  consistency.hydrologyCellsRebuilt = hydrology.cells;
  consistency.projectedCellsRefreshed = projectedCellsRefreshed;
  mutable.primaryWorld.deepTime = {
    modelVersion: 'deep-time-foundation-v3',
    epochs,
    forcingSamples,
    cratons,
    persistentIceCells,
    glaciallyErodedCells,
    floodedValleyCells,
    coastalAdjustedCells,
    tectonicAdjustedCells,
    impactAdjustedCells,
    weatheredCells,
    impactHistory: finalizeImpactHistory(impactHistory, Math.max(250, project.selectedValues.systemAgeGy * 1000)),
    fragmentPlacement,
    fragmentHistory,
    finalWater,
    presentClimate,
    hydrology: hydrology.diagnostics,
    consistency,
    notes: [
      'Deep-time orchestration runs from generator-core for worker and fallback parity.',
      'Authoritative fragment placement establishes continental ownership before final sea-level, climate, hydrology, biome, and projection passes.',
      'Surface aging samples orbital, erosion, impact, glacial, and coastal history without the retired motion-coupled terrain and sparse ownership mutation paths.',
      'Mass-conserving whole-fragment transforms place continental membership, carried elevation, and carried volcanism before surface aging; stationary fragments use identity transforms and bounded spill placement resolves most overlap.',
      'Crust reconstruction is intentionally strong enough to create material continental separation and complementary margins over deep time.',
      'Impact history scales opportunities with elapsed geologic time while later erosion reduces older visible relief.',
      'Orbital forcing is parameterized rather than produced by an N-body integration.',
      'Legacy motion-driven terrain mutation, sparse ownership transfer, and their compatibility diagnostics are removed; plate splitting, merging, Euler-pole rotation, and full sediment transport remain deferred.'
    ]
  };
  onProgress?.({ phase: 'complete', progress: 1, message: 'Deep-time aging and final world reconciliation complete' });
  return mutable;
}

export function generateProjectWithDeepTime(
  input: Partial<GenerationConfig> = {},
  options: GenerateProjectOptions = {},
  onDeepTimeProgress?: (progress: DeepTimeProgress) => void
): DeepTimeProject {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const project = generateProject(input, options);
  const phaseStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const result = applyDeepTimeFoundation(project, onDeepTimeProgress);
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (result.diagnostics) {
    result.diagnostics.phases.push({ name: 'deep-time-and-final-reconciliation', ms: round(finishedAt - phaseStartedAt, 3) });
    result.diagnostics.totalMs = round(finishedAt - startedAt, 3);
  }
  return result;
}
