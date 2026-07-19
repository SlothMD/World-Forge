import { generateProjectWithNativeStages } from '@world-forge/generator-core/nativeStagePipeline';
import { plateCountDistributionsByPreset, prepareSystemOrbitConfig, reconcileSystemOrbitPresets } from '@world-forge/generator-core/systemOrbitPreset';
import { distributionCenter, distributionSpread } from '@world-forge/generator-core/numericDistribution';
import type { GenerationConfig } from '@world-forge/shared';
import { buildTestCases, configForTestCase, fingerprintProject, type PresetTestMode, type PresetTestResult, type PresetValidationReport, type WorldFingerprint } from './presetValidation';
import { fingerprintInitialTerrain, type InitialTerrainFingerprint } from './initialTerrainDiagnostics';
import { fingerprintDeepTimeLedger } from './deepTimeLedgerFingerprint';
import { APP_VERSION } from '../appVersion';

type TerrainFingerprint = WorldFingerprint & InitialTerrainFingerprint & Record<string, number | string | Record<string, number> | undefined>;
type StartMessage = { type: 'start'; mode: PresetTestMode; baseConfig: GenerationConfig };
type IncomingMessage = StartMessage | { type: 'cancel' };
type OutgoingMessage =
  | { type: 'progress'; completed: number; total: number; currentId: string; result?: PresetTestResult }
  | { type: 'complete'; report: PresetValidationReport }
  | { type: 'cancelled'; completed: number; total: number }
  | { type: 'error'; message: string };

type WorkerMessenger = { postMessage(message: OutgoingMessage): void };
const messenger = self as unknown as WorkerMessenger;
let cancelled = false;

const PRESETS = ['Earthlike', 'Habitable World', 'Waterworld', 'Archipelago', 'Desert World', 'Pangea', 'Random World'] as const;
const BIOME_SHARE_KEYS = ['IceCap', 'Tundra', 'Desert', 'Grassland', 'Forest', 'Rainforest', 'Wetland', 'Mountain'] as const;
const CLIMATE_REGIME_KEYS = ['Maritime', 'Continental', 'Monsoonal', 'AridSeasonal', 'StableTropical'] as const;
const BIOME_SUPPORT_CHECKS: Array<[string, string, number]> = [
  ['biomeDesertHighWetnessShare', 'desert cells with high wetness', 0.08],
  ['biomeRainforestLowWetnessShare', 'rainforest cells with weak wetness support', 0.08],
  ['biomeForestExtremeColdShare', 'forest cells under extreme cold', 0.08],
  ['biomeWetlandUnsupportedShare', 'wetland cells without strong hydrologic or saturation support', 0.05],
  ['biomeWarmIceShare', 'ice-cap cells under warm conditions', 0.03],
  ['biomeLegacyMountainBiomeShare', 'legacy mountain-biome cells after terrain/biome separation', 0]
];

function receivedStellarFlux(luminositySolar: number, semiMajorAxisAu: number): number {
  return luminositySolar / Math.max(0.0001, semiMajorAxisAu ** 2);
}

function terrainOf(result?: PresetTestResult): TerrainFingerprint | undefined {
  return result?.fingerprint as TerrainFingerprint | undefined;
}

function readMetric(item: TerrainFingerprint, key: string): number {
  const value = item[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readText(item: TerrainFingerprint, key: string): string {
  const value = item[key];
  return typeof value === 'string' ? value : '';
}

function metricSum(item: TerrainFingerprint, keys: string[]): number {
  return keys.reduce((sum, key) => sum + readMetric(item, key), 0);
}

function compareResult(result: PresetTestResult, starBaseline?: PresetTestResult, worldBaseline?: PresetTestResult): PresetTestResult {
  if (!result.fingerprint) return result;
  const findings: string[] = [];
  let status: PresetTestResult['status'] = 'pass';
  const b = result.fingerprint as TerrainFingerprint;
  const warn = (message: string): void => { if (status !== 'fail') status = 'warning'; findings.push(message); };
  const fail = (message: string): void => { status = 'fail'; findings.push(message); };

  if (result.testCase.starPresetId !== 'sol-like' && starBaseline?.fingerprint) {
    const a = starBaseline.fingerprint;
    const starChanged = a.starClass !== b.starClass || Math.abs(a.stellarMass - b.stellarMass) >= 0.04 || Math.abs(a.stellarLuminosity - b.stellarLuminosity) >= 0.08;
    const climateChanged = Math.abs(a.meanTemperatureC - b.meanTemperatureC) >= 0.15 || Math.abs(a.meanWetness - b.meanWetness) >= 0.005 || Math.abs(a.icePercentage - b.icePercentage) >= 0.25;
    const baselineFlux = receivedStellarFlux(a.stellarLuminosity, a.semiMajorAxisAu);
    const variantFlux = receivedStellarFlux(b.stellarLuminosity, b.semiMajorAxisAu);
    const relativeFluxDelta = Math.abs(variantFlux - baselineFlux) / Math.max(0.0001, baselineFlux);
    if (!starChanged) findings.push('Earthlike-Friendly landed inside the Sol-Like overlap range for this seed.');
    if (relativeFluxDelta >= 0.03 && !climateChanged) warn(`Received stellar flux changed by ${(relativeFluxDelta * 100).toFixed(1)}%, but downstream climate and surface fingerprints were unchanged.`);
    const climateDelta = Math.abs(a.meanTemperatureC - b.meanTemperatureC);
    if (climateDelta > 10) warn(`Changing only Star Type moved mean temperature by ${climateDelta.toFixed(1)} C; review for excessive downstream amplification.`);
  }

  const worldTerrainBaseline = terrainOf(worldBaseline);
  if (result.testCase.worldPresetId !== 'Earthlike' && worldBaseline?.fingerprint && worldTerrainBaseline) {
    const a = worldBaseline.fingerprint;
    const oceanDelta = Math.abs(b.oceanPercentage - a.oceanPercentage);
    const riverDelta = Math.abs(b.riverCount - a.riverCount);
    const biomeDelta = Object.keys({ ...a.biomePercentages, ...b.biomePercentages }).reduce((sum, key) => sum + Math.abs((a.biomePercentages[key] ?? 0) - (b.biomePercentages[key] ?? 0)), 0) / 2;
    const orbitalDelta = Math.abs(b.orbitalPeriodDays - a.orbitalPeriodDays);
    if (oceanDelta < 2 && riverDelta < 3 && biomeDelta < 5 && orbitalDelta < 10 && b.plateCount === a.plateCount) fail('World preset produced no material output change across water, hydrology, biomes, orbit, or plates.');
    if (result.testCase.worldPresetId === 'Random World' && !b.randomWorldArchetype) fail('Random World did not record a generated archetype.');
  }

  if (b.topologyCellCount <= 0 || !Number.isFinite(b.elevationStdDev) || b.elevationStdDev <= 0.0001) fail('Primordial crust fingerprint is missing or effectively flat.');
  else {
    if (b.elevationRoughness < 0.0005) warn('Crust surface roughness is unusually low.');
    if (b.lowBasinShare < 0.02 || b.lowBasinShare > 0.45) warn(`Low-basin share ${Math.round(b.lowBasinShare * 100)}% is outside the broad diagnostic envelope.`);
    if (b.highReliefShare < 0.01 || b.highReliefShare > 0.35) warn(`High-relief share ${Math.round(b.highReliefShare * 100)}% is outside the broad diagnostic envelope.`);
  }

  const shareMetrics: Array<[string, number]> = [
    ['ruggedTerrainShare', b.ruggedTerrainShare], ['flatTerrainShare', b.flatTerrainShare], ['plateauShare', b.plateauShare],
    ['basinFloorShare', b.basinFloorShare], ['coastlineCellShare', b.coastlineCellShare], ['largestLandmassShare', b.largestLandmassShare],
    ['islandLandShare', b.islandLandShare], ['continentalPlateShare', b.continentalPlateShare], ['largestPlateShare', b.largestPlateShare],
    ['smallestPlateShare', b.smallestPlateShare], ['plateBoundaryCellShare', b.plateBoundaryCellShare], ['convergentBoundaryShare', b.convergentBoundaryShare],
    ['divergentBoundaryShare', b.divergentBoundaryShare], ['transformBoundaryShare', b.transformBoundaryShare], ['subductionBoundaryShare', b.subductionBoundaryShare],
    ['collisionUpliftBoundaryShare', b.collisionUpliftBoundaryShare], ['faultZoneBoundaryShare', b.faultZoneBoundaryShare], ['cratonPlateShare', b.cratonPlateShare],
    ['cratonExposureShare', b.cratonExposureShare], ['cratonSubmergedShare', b.cratonSubmergedShare]
  ];
  for (const [name, value] of shareMetrics) if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${name} must be a finite value between 0 and 1; received ${String(value)}.`);

  if (!Number.isFinite(b.meanLocalRelief) || !Number.isFinite(b.p95LocalRelief) || b.p95LocalRelief <= 0) fail('Initial-terrain morphology fingerprint is missing or invalid.');
  else if (result.testCase.worldPresetId === 'Earthlike') {
    if (b.p95LocalRelief < 0.035) warn(`Earthlike P95 local relief ${b.p95LocalRelief.toFixed(3)} is unusually subdued.`);
    if (b.boundaryReliefRatio < 1.02) warn(`Earthlike plate-boundary relief ratio ${b.boundaryReliefRatio.toFixed(2)} does not exceed plate interiors.`);
    if (b.ruggedTerrainShare < 0.01) warn('Earthlike baseline contains almost no rugged terrain cells.');
    if (b.landmassCount <= 0 || b.largestLandmassShare <= 0) fail('Earthlike baseline retained no connected landmass.');
  }

  const motionVersion = readText(b, 'agingMotionLifecycleVersion');
  if (!motionVersion || motionVersion === 'missing') fail('Plate-motion lifecycle diagnostics are missing.');
  if (readMetric(b, 'agingMotionMeanPlateSpeedCmPerYear') <= 0) fail('Plate-motion lifecycle diagnostics report no speed magnitude.');
  if (readMetric(b, 'agingMotionDrivenTerrainChangedCellShare') <= 0) warn('Plate motion produced no measurable pre-aging terrain change.');
  if (readMetric(b, 'agingMotionPassCount') <= 0) fail('Deep-time aging ran no motion-coupled tectonic passes.');
  if (readMetric(b, 'agingMotionChangedCellShare') <= 0) fail('Motion-coupled aging produced no measurable terrain change.');
  const agingBoundaryShareTotal = readMetric(b, 'agingMotionConvergentBoundaryShare') + readMetric(b, 'agingMotionDivergentBoundaryShare') + readMetric(b, 'agingMotionShearBoundaryShare');
  if (agingBoundaryShareTotal <= 0) fail('Motion-coupled aging recorded no active boundary classifications.');
  if (readMetric(b, 'agingMotionMaxAbsElevationDelta') > 0.08) warn('Motion-coupled aging produced an unusually large single-pass elevation delta.');
  if (b.plateCount >= 4 && readMetric(b, 'agingMotionOccupiedDirectionSectors') < 3) warn('Plate motion directions occupy fewer than three of eight direction sectors.');
  if (readMetric(b, 'agingMotionDirectionResultant') > 0.9) warn('Plate motion directions are strongly unidirectional.');

  const boundaryTotal = b.convergentBoundaryShare + b.divergentBoundaryShare + b.transformBoundaryShare;
  if (b.plateCount < 4 || b.plateBoundaryCellShare <= 0 || Math.abs(boundaryTotal - 1) > 0.02) fail('Plate boundary classification is incomplete or invalid.');
  if (result.testCase.worldPresetId === 'Earthlike') {
    if (b.meanPlateSpeed < 0.5 || b.meanPlateSpeed > 9) warn(`Earthlike mean plate speed ${b.meanPlateSpeed.toFixed(2)} cm/year is outside the broad first-pass envelope.`);
    if (b.plateSpeedStdDev < 0.2) warn('Earthlike plate-speed variation is still effectively flat.');
    if (b.cratonCount <= 0 || b.cratonPlateShare <= 0) fail('Earthlike baseline retained no cratons.');
    if (Math.abs((b.cratonExposureShare + b.cratonSubmergedShare) - 1) > 0.02) fail('Craton exposure and submergence shares do not reconcile.');
  }

  const biomeVersion = readText(b, 'biomeDiagnosticsVersion');
  if (!biomeVersion || biomeVersion === 'missing') {
    fail('Biome diagnostic ledger is missing.');
  } else {
    const landCells = readMetric(b, 'biomeLandCellCount');
    const marineCells = readMetric(b, 'biomeMarineCellCount');
    if (landCells + marineCells !== b.topologyCellCount) fail(`Biome diagnostic cell accounting does not match topology (${landCells + marineCells} versus ${b.topologyCellCount}).`);
    const landShareTotal = metricSum(b, BIOME_SHARE_KEYS.map((name) => `biomeLandShare${name}`));
    if (landCells > 0 && Math.abs(landShareTotal - 1) > 0.02) fail(`Land-biome shares do not sum to one (${landShareTotal.toFixed(3)}).`);
    const regimeShareTotal = metricSum(b, CLIMATE_REGIME_KEYS.map((name) => `biomeClimateRegimeShare${name}`));
    if (landCells > 0 && Math.abs(regimeShareTotal - 1) > 0.02) fail(`Climate-regime shares do not sum to one (${regimeShareTotal.toFixed(3)}).`);
    for (const name of CLIMATE_REGIME_KEYS) {
      const share = readMetric(b, `biomeClimateRegimeShare${name}`);
      const variance = readMetric(b, `biomeClimateRegimeVariance${name}C`);
      if (!Number.isFinite(share) || share < 0 || share > 1) fail(`Climate-regime share ${name} must be a finite value between 0 and 1; received ${String(share)}.`);
      if (!Number.isFinite(variance) || variance < 0) fail(`Climate-regime variance ${name} must be finite and non-negative; received ${String(variance)}.`);
    }
    const maritimeShare = readMetric(b, 'biomeClimateRegimeShareMaritime');
    const continentalShare = readMetric(b, 'biomeClimateRegimeShareContinental');
    const maritimeVariance = readMetric(b, 'biomeClimateRegimeVarianceMaritimeC');
    const continentalVariance = readMetric(b, 'biomeClimateRegimeVarianceContinentalC');
    if (maritimeShare >= 0.02 && continentalShare >= 0.02 && maritimeVariance > continentalVariance + 0.5) {
      warn(`Climate regimes report maritime variance (${maritimeVariance.toFixed(2)} C) above continental variance (${continentalVariance.toFixed(2)} C).`);
    }

    const transitionDensity = readMetric(b, 'biomeTransitionDensity');
    const isolatedShare = readMetric(b, 'biomeIsolatedCellShare');
    const tinyPatchShare = readMetric(b, 'biomeTinyPatchCellShare');
    const meanVariance = readMetric(b, 'biomeMeanTemperatureVarianceProxyC');
    const p90Variance = readMetric(b, 'biomeP90TemperatureVarianceProxyC');
    const seasonalSwing = readMetric(b, 'biomeLandSeasonalTemperatureSwingC');
    if (transitionDensity > 0.7) warn(`Biome transition density is very high (${transitionDensity.toFixed(2)}), suggesting threshold chatter or poor regional cohesion.`);
    if (isolatedShare > 0.08) warn(`Isolated biome-cell share is high (${isolatedShare.toFixed(2)}).`);
    if (tinyPatchShare > 0.2) warn(`Tiny biome-patch share is high (${tinyPatchShare.toFixed(2)}).`);
    if (seasonalSwing > 0 && meanVariance <= 0) fail('Biome temperature-variance diagnostics are missing despite nonzero seasonal climate swing.');
    if (p90Variance + 0.001 < meanVariance) fail('Biome temperature-variance percentile is below its mean.');
    for (const [key, label, threshold] of BIOME_SUPPORT_CHECKS) {
      const value = readMetric(b, key);
      if (value > threshold) warn(`Biome diagnostics found ${label} (${value.toFixed(2)} share).`);
    }
  }

  return { ...result, status, findings };
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)))];
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function presetKey(preset: string): string { return preset.replace(/\s+/g, '').replace(/^./, (value) => value.toLowerCase()); }
function presetFingerprints(results: PresetTestResult[], preset: string): TerrainFingerprint[] { return results.filter((result) => result.testCase.starPresetId === 'sol-like' && result.testCase.worldPresetId === preset && result.fingerprint).map((result) => result.fingerprint as TerrainFingerprint); }
function medianFor(results: PresetTestResult[], preset: string, read: (fingerprint: TerrainFingerprint) => number): number { return percentile(presetFingerprints(results, preset).map(read), 0.5); }
function expectedPlateAggregate(preset: string): { center: number; spread: number } { const distribution = plateCountDistributionsByPreset[preset]; return { center: distribution ? distributionCenter(distribution) : 0, spread: distribution ? distributionSpread(distribution) : 0 }; }
function aggregateMedian(samples: TerrainFingerprint[], key: string): number { return percentile(samples.map((item) => readMetric(item, key)), 0.5); }
function aggregateShare(samples: TerrainFingerprint[], predicate: (item: TerrainFingerprint) => boolean): number { return samples.length ? samples.filter(predicate).length / samples.length : 0; }

function aggregateResults(results: PresetTestResult[]): Record<string, number | string> {
  const fingerprints = results.flatMap((result) => result.fingerprint ? [result.fingerprint as TerrainFingerprint] : []);
  const earthlike = presetFingerprints(results, 'Earthlike');
  const earthlikeFriendly = results.filter((result) => result.testCase.starPresetId === 'habitable' && result.fingerprint);
  const classCounts = { F: 0, G: 0, K: 0 };
  for (const result of earthlikeFriendly) { const letter = result.fingerprint!.starClass.charAt(0) as keyof typeof classCounts; if (letter in classCounts) classCounts[letter] += 1; }
  const byWorld = new Map<string, string>();
  for (const result of results) if (result.fingerprint) { const item = result.fingerprint; byWorld.set(`${result.testCase.seed}:${result.testCase.worldPresetId}`, [item.elevationStdDev, item.elevationRoughness, item.lowBasinShare, item.highReliefShare].join(':')); }
  const expected = Object.fromEntries(PRESETS.map((preset) => [preset, expectedPlateAggregate(preset)]));
  const varianceValues = fingerprints.map((item) => readMetric(item, 'biomeMeanTemperatureVarianceProxyC'));
  const diagnosticsPresent = fingerprints.filter((item) => readText(item, 'biomeDiagnosticsVersion') !== '' && readText(item, 'biomeDiagnosticsVersion') !== 'missing');
  const aggregates: Record<string, number | string> = {
    earthlikeFriendlyFShare: earthlikeFriendly.length ? classCounts.F / earthlikeFriendly.length : 0,
    earthlikeFriendlyGShare: earthlikeFriendly.length ? classCounts.G / earthlikeFriendly.length : 0,
    earthlikeFriendlyKShare: earthlikeFriendly.length ? classCounts.K / earthlikeFriendly.length : 0,
    elevationStdDevP05: percentile(fingerprints.map((item) => item.elevationStdDev), 0.05),
    elevationStdDevMedian: percentile(fingerprints.map((item) => item.elevationStdDev), 0.5),
    elevationStdDevP95: percentile(fingerprints.map((item) => item.elevationStdDev), 0.95),
    roughnessP05: percentile(fingerprints.map((item) => item.elevationRoughness), 0.05),
    roughnessMedian: percentile(fingerprints.map((item) => item.elevationRoughness), 0.5),
    roughnessP95: percentile(fingerprints.map((item) => item.elevationRoughness), 0.95),
    uniqueCrustFingerprintShareBySeedAndWorld: byWorld.size ? new Set(byWorld.values()).size / byWorld.size : 0,
    earthlikeMeanLocalReliefP05: percentile(earthlike.map((item) => item.meanLocalRelief), 0.05),
    earthlikeMeanLocalReliefMedian: percentile(earthlike.map((item) => item.meanLocalRelief), 0.5),
    earthlikeMeanLocalReliefP95: percentile(earthlike.map((item) => item.meanLocalRelief), 0.95),
    earthlikeP95LocalReliefMedian: percentile(earthlike.map((item) => item.p95LocalRelief), 0.5),
    earthlikeBoundaryReliefRatioMedian: percentile(earthlike.map((item) => item.boundaryReliefRatio), 0.5),
    earthlikeRuggedTerrainShareMedian: percentile(earthlike.map((item) => item.ruggedTerrainShare), 0.5),
    earthlikeFlatTerrainShareMedian: percentile(earthlike.map((item) => item.flatTerrainShare), 0.5),
    earthlikePlateauShareMedian: percentile(earthlike.map((item) => item.plateauShare), 0.5),
    earthlikeBasinFloorShareMedian: percentile(earthlike.map((item) => item.basinFloorShare), 0.5),
    earthlikeCoastlineCellShareMedian: percentile(earthlike.map((item) => item.coastlineCellShare), 0.5),
    earthlikeLandmassCountMedian: percentile(earthlike.map((item) => item.landmassCount), 0.5),
    earthlikeLargestLandmassShareMedian: percentile(earthlike.map((item) => item.largestLandmassShare), 0.5),
    earthlikeIslandLandShareMedian: percentile(earthlike.map((item) => item.islandLandShare), 0.5),
    earthlikeConvergentBoundaryMedian: medianFor(results, 'Earthlike', (item) => item.convergentBoundaryShare),
    earthlikeSubductionBoundaryMedian: medianFor(results, 'Earthlike', (item) => item.subductionBoundaryShare),
    earthlikeCollisionUpliftBoundaryMedian: medianFor(results, 'Earthlike', (item) => item.collisionUpliftBoundaryShare),
    earthlikeFaultZoneBoundaryMedian: medianFor(results, 'Earthlike', (item) => item.faultZoneBoundaryShare),
    earthlikeBoundaryVolcanismRatioMedian: medianFor(results, 'Earthlike', (item) => item.boundaryVolcanismRatio),
    earthlikeMovementScoreMedian: medianFor(results, 'Earthlike', (item) => item.movementScore),
    earthlikeBoundaryDensityScoreMedian: medianFor(results, 'Earthlike', (item) => item.boundaryDensityScore),
    earthlikeCollisionEnergyScoreMedian: medianFor(results, 'Earthlike', (item) => item.collisionEnergyScore),
    earthlikeVolcanismScoreMedian: medianFor(results, 'Earthlike', (item) => item.volcanismScore),
    earthlikeMeanPlateSpeedP05: percentile(earthlike.map((item) => item.meanPlateSpeed), 0.05),
    earthlikeMeanPlateSpeedMedian: percentile(earthlike.map((item) => item.meanPlateSpeed), 0.5),
    earthlikeMeanPlateSpeedP95: percentile(earthlike.map((item) => item.meanPlateSpeed), 0.95),
    earthlikePlateSpeedStdDevMedian: percentile(earthlike.map((item) => item.plateSpeedStdDev), 0.5),
    earthlikeCratonCountP05: percentile(earthlike.map((item) => item.cratonCount), 0.05),
    earthlikeCratonCountMedian: percentile(earthlike.map((item) => item.cratonCount), 0.5),
    earthlikeCratonCountP95: percentile(earthlike.map((item) => item.cratonCount), 0.95),
    earthlikeCratonPlateShareMedian: percentile(earthlike.map((item) => item.cratonPlateShare), 0.5),
    earthlikeMeanCratonAgeGyMedian: percentile(earthlike.map((item) => item.meanCratonAgeGy), 0.5),
    earthlikeOldestCratonAgeGyMedian: percentile(earthlike.map((item) => item.oldestCratonAgeGy), 0.5),
    earthlikeMeanCratonStabilityMedian: percentile(earthlike.map((item) => item.meanCratonStability), 0.5),
    earthlikeCratonLithosphereThicknessMedian: percentile(earthlike.map((item) => item.meanCratonLithosphereThickness), 0.5),
    earthlikeCratonRiftSusceptibilityMedian: percentile(earthlike.map((item) => item.meanCratonRiftSusceptibility), 0.5),
    earthlikeCratonExposureShareMedian: percentile(earthlike.map((item) => item.cratonExposureShare), 0.5),
    earthlikeCratonSubmergedShareMedian: percentile(earthlike.map((item) => item.cratonSubmergedShare), 0.5),
    biomeDiagnosticsCoverageShare: fingerprints.length ? diagnosticsPresent.length / fingerprints.length : 0,
    motionLifecycleCoverageShare: aggregateShare(fingerprints, (item) => readText(item, 'agingMotionLifecycleVersion') !== '' && readText(item, 'agingMotionLifecycleVersion') !== 'missing'),
    motionMeanPlateSpeedMedian: aggregateMedian(fingerprints, 'agingMotionMeanPlateSpeedCmPerYear'),
    motionDirectionResultantMedian: aggregateMedian(fingerprints, 'agingMotionDirectionResultant'),
    motionOccupiedDirectionSectorsMedian: aggregateMedian(fingerprints, 'agingMotionOccupiedDirectionSectors'),
    motionDrivenTerrainChangedCellShareMedian: aggregateMedian(fingerprints, 'agingMotionDrivenTerrainChangedCellShare'),
    motionDrivenTerrainMeanAbsElevationDeltaMedian: aggregateMedian(fingerprints, 'agingMotionDrivenTerrainMeanAbsElevationDelta'),
    motionAgingPassCountMedian: aggregateMedian(fingerprints, 'agingMotionPassCount'),
    motionPlateOwnershipChangedCellShareMax: fingerprints.length ? Math.max(...fingerprints.map((item) => readMetric(item, 'agingMotionPlateOwnershipChangedCellShare'))) : 0,
    motionVectorChangedShareMax: fingerprints.length ? Math.max(...fingerprints.map((item) => readMetric(item, 'agingMotionVectorChangedShare'))) : 0,
    motionContinentalCentroidDisplacementMaxRadians: fingerprints.length ? Math.max(...fingerprints.map((item) => readMetric(item, 'agingMotionMaxContinentalCentroidDisplacementRadians'))) : 0,
    biomeTransitionDensityP05: percentile(fingerprints.map((item) => readMetric(item, 'biomeTransitionDensity')), 0.05),
    biomeTransitionDensityMedian: percentile(fingerprints.map((item) => readMetric(item, 'biomeTransitionDensity')), 0.5),
    biomeTransitionDensityP95: percentile(fingerprints.map((item) => readMetric(item, 'biomeTransitionDensity')), 0.95),
    biomeIsolatedCellShareMedian: percentile(fingerprints.map((item) => readMetric(item, 'biomeIsolatedCellShare')), 0.5),
    biomeIsolatedCellShareP95: percentile(fingerprints.map((item) => readMetric(item, 'biomeIsolatedCellShare')), 0.95),
    biomeTinyPatchCellShareMedian: percentile(fingerprints.map((item) => readMetric(item, 'biomeTinyPatchCellShare')), 0.5),
    biomeTinyPatchCellShareP95: percentile(fingerprints.map((item) => readMetric(item, 'biomeTinyPatchCellShare')), 0.95),
    biomeMeanTemperatureVarianceProxyP25: percentile(varianceValues, 0.25),
    biomeMeanTemperatureVarianceProxyMedian: percentile(varianceValues, 0.5),
    biomeMeanTemperatureVarianceProxyP75: percentile(varianceValues, 0.75),
    biomeP90TemperatureVarianceProxyMedian: percentile(fingerprints.map((item) => readMetric(item, 'biomeP90TemperatureVarianceProxyC')), 0.5),
    biomeLegacyLowVarianceSaturationShare: aggregateShare(fingerprints, (item) => readMetric(item, 'biomeLowVarianceLandShare') >= 0.98),
    biomeLegacyHighVarianceEmptyShare: aggregateShare(fingerprints, (item) => readMetric(item, 'biomeHighVarianceLandShare') <= 0.001),
    biomeClimateRegimeShareMaritimeMedian: aggregateMedian(fingerprints, 'biomeClimateRegimeShareMaritime'),
    biomeClimateRegimeShareContinentalMedian: aggregateMedian(fingerprints, 'biomeClimateRegimeShareContinental'),
    biomeClimateRegimeShareMonsoonalMedian: aggregateMedian(fingerprints, 'biomeClimateRegimeShareMonsoonal'),
    biomeClimateRegimeShareAridSeasonalMedian: aggregateMedian(fingerprints, 'biomeClimateRegimeShareAridSeasonal'),
    biomeClimateRegimeShareStableTropicalMedian: aggregateMedian(fingerprints, 'biomeClimateRegimeShareStableTropical'),
    biomeClimateRegimeVarianceMaritimeMedianC: aggregateMedian(fingerprints, 'biomeClimateRegimeVarianceMaritimeC'),
    biomeClimateRegimeVarianceContinentalMedianC: aggregateMedian(fingerprints, 'biomeClimateRegimeVarianceContinentalC'),
    biomeClimateRegimeVarianceMonsoonalMedianC: aggregateMedian(fingerprints, 'biomeClimateRegimeVarianceMonsoonalC'),
    biomeClimateRegimeVarianceAridSeasonalMedianC: aggregateMedian(fingerprints, 'biomeClimateRegimeVarianceAridSeasonalC'),
    biomeClimateRegimeVarianceStableTropicalMedianC: aggregateMedian(fingerprints, 'biomeClimateRegimeVarianceStableTropicalC')
  };

  for (const preset of PRESETS) {
    const key = presetKey(preset);
    const samples = presetFingerprints(results, preset);
    const metric = (name: string): number => aggregateMedian(samples, name);
    aggregates[`${key}PlateCountMedian`] = percentile(samples.map((item) => item.plateCount), 0.5);
    aggregates[`${key}PlateCountStdDev`] = Number(standardDeviation(samples.map((item) => item.plateCount)).toFixed(3));
    aggregates[`${key}MeanPlateSpeedMedian`] = percentile(samples.map((item) => item.meanPlateSpeed), 0.5);
    aggregates[`${key}MovementScoreMedian`] = percentile(samples.map((item) => item.movementScore), 0.5);
    aggregates[`${key}BoundaryDensityScoreMedian`] = percentile(samples.map((item) => item.boundaryDensityScore), 0.5);
    aggregates[`${key}CollisionEnergyScoreMedian`] = percentile(samples.map((item) => item.collisionEnergyScore), 0.5);
    aggregates[`${key}VolcanismScoreMedian`] = percentile(samples.map((item) => item.volcanismScore), 0.5);
    aggregates[`${key}CratonCountMedian`] = percentile(samples.map((item) => item.cratonCount), 0.5);
    aggregates[`${key}CratonPlateShareMedian`] = percentile(samples.map((item) => item.cratonPlateShare), 0.5);
    aggregates[`${key}CratonExposureShareMedian`] = percentile(samples.map((item) => item.cratonExposureShare), 0.5);
    aggregates[`${key}CratonSubmergedShareMedian`] = percentile(samples.map((item) => item.cratonSubmergedShare), 0.5);
    aggregates[`${key}MeanLocalReliefMedian`] = percentile(samples.map((item) => item.meanLocalRelief), 0.5);
    aggregates[`${key}P95LocalReliefMedian`] = percentile(samples.map((item) => item.p95LocalRelief), 0.5);
    aggregates[`${key}BoundaryReliefRatioMedian`] = percentile(samples.map((item) => item.boundaryReliefRatio), 0.5);
    aggregates[`${key}RuggedTerrainShareMedian`] = percentile(samples.map((item) => item.ruggedTerrainShare), 0.5);
    aggregates[`${key}FlatTerrainShareMedian`] = percentile(samples.map((item) => item.flatTerrainShare), 0.5);
    aggregates[`${key}PlateauShareMedian`] = percentile(samples.map((item) => item.plateauShare), 0.5);
    aggregates[`${key}BasinFloorShareMedian`] = percentile(samples.map((item) => item.basinFloorShare), 0.5);
    aggregates[`${key}CoastlineCellShareMedian`] = percentile(samples.map((item) => item.coastlineCellShare), 0.5);
    aggregates[`${key}LandmassCountMedian`] = percentile(samples.map((item) => item.landmassCount), 0.5);
    aggregates[`${key}LargestLandmassShareMedian`] = percentile(samples.map((item) => item.largestLandmassShare), 0.5);
    aggregates[`${key}IslandLandShareMedian`] = percentile(samples.map((item) => item.islandLandShare), 0.5);

    for (const [suffix, source] of [
      ['ImpactAppliedEventsMedian', 'agingImpactAppliedEvents'], ['ImpactVisibleEventsMedian', 'agingImpactVisibleEvents'], ['ImpactMeanSurvivalRatioMedian', 'agingImpactMeanSurvivalRatio'], ['ImpactTotalOpportunitiesMedian', 'agingImpactTotalOpportunities'],
      ['DriftActiveBoundaryPairsMedian', 'agingDriftActiveBoundaryPairs'], ['DriftPuzzleFitPotentialMedian', 'agingDriftPuzzleFitPotential'], ['DriftContinentalCollisionPairsMedian', 'agingDriftContinentalCollisionPairs'], ['DriftContinentalRiftPairsMedian', 'agingDriftContinentalRiftPairs'], ['DriftSubductionPairsMedian', 'agingDriftSubductionPairs'],
      ['MotionMeanPlateSpeedMedian', 'agingMotionMeanPlateSpeedCmPerYear'], ['MotionDirectionResultantMedian', 'agingMotionDirectionResultant'], ['MotionOccupiedDirectionSectorsMedian', 'agingMotionOccupiedDirectionSectors'], ['MotionDrivenTerrainChangedCellShareMedian', 'agingMotionDrivenTerrainChangedCellShare'], ['MotionDrivenTerrainMeanAbsElevationDeltaMedian', 'agingMotionDrivenTerrainMeanAbsElevationDelta'], ['MotionAgingPassCountMedian', 'agingMotionPassCount'], ['MotionPlateOwnershipChangedCellShareMedian', 'agingMotionPlateOwnershipChangedCellShare'], ['MotionVectorChangedShareMedian', 'agingMotionVectorChangedShare'], ['MotionContinentalCentroidDisplacementMedianRadians', 'agingMotionMeanContinentalCentroidDisplacementRadians'],
      ['FinalWaterOceanErrorMedian', 'finalWaterOceanErrorPercentagePoints'], ['FinalWaterDeepOceanShareMedian', 'finalWaterDeepOceanShareOfMarine'], ['FinalWaterBroadShelfAwayFromCoastMedian', 'finalWaterBroadShelfAwayFromCoastShare'], ['FinalWaterCoastlineSharpnessMedian', 'finalWaterCoastlineSharpnessIndex'], ['FinalWaterNearSeaLevelBandMedian', 'finalWaterNearSeaLevelBandShare'], ['FinalWaterP90MarineDepthMedian', 'finalWaterP90MarineDepth'],
      ['PresentClimateMedianTemperatureMedian', 'presentClimateMedianTemperatureC'], ['PresentClimateMeanLandPrecipitationMedian', 'presentClimateMeanLandPrecipitation'], ['PresentClimatePrecipitationStdDevMedian', 'presentClimateLandPrecipitationStdDev'], ['PresentClimateFlatnessMedian', 'presentClimatePrecipitationFlatnessIndex'], ['PresentClimateRainShadowMedian', 'presentClimateRainShadowIndex'], ['PresentClimateDesertRiskMedian', 'presentClimateDesertRiskShare'], ['PresentClimateDesertWetlandOverlapMedian', 'presentClimateDesertWetlandOverlapShare'],
      ['HydrologyHeadwaterCandidateMedian', 'hydrologyTerrainHeadwaterCandidateShare'], ['HydrologyHighReliefWetMedian', 'hydrologyTerrainHighReliefWetShare'], ['HydrologyMountainHeadwaterMedian', 'hydrologyTerrainMountainHeadwaterShare'], ['HydrologySourceCandidateCountMedian', 'hydrologySourceCandidateCount'], ['HydrologyAcceptedRiverCountMedian', 'hydrologyAcceptedRiverCount'], ['HydrologyCapacityUseMedian', 'hydrologyNamedRiverCapacityUse'], ['HydrologyTopologyRiverCellShareMedian', 'hydrologyTopologyRiverCellShare'], ['HydrologyMinorRiverCellShareMedian', 'hydrologyTopologyMinorRiverCellShare'], ['HydrologyNavigableRiverCellShareMedian', 'hydrologyTopologyNavigableRiverCellShare'], ['HydrologyNamedRiverPathCellShareMedian', 'hydrologyNamedRiverPathCellShare'], ['HydrologyShortRiverShareMedian', 'hydrologyShortRiverShare'], ['HydrologySourceToMouthDropMedian', 'hydrologyMedianSourceToMouthDrop'], ['HydrologyMedianRiverPathLengthMedian', 'hydrologyMedianRiverPathLength'], ['HydrologyOceanTerminusShareMedian', 'hydrologyOceanTerminusShare'], ['HydrologyBasinTerminusShareMedian', 'hydrologyBasinTerminusShare'], ['HydrologyDistributionEvennessMedian', 'hydrologyRiverDistributionEvenness']
    ] as Array<[string, string]>) aggregates[`${key}${suffix}`] = metric(source);

    aggregates[`${key}FinalWaterShelfShareMedian`] = metric('finalWaterImmediateShelfShareOfMarine') + metric('finalWaterContinentalShelfShareOfMarine');
    aggregates[`${key}BiomeDiagnosticsCoverageShare`] = aggregateShare(samples, (item) => readText(item, 'biomeDiagnosticsVersion') !== '' && readText(item, 'biomeDiagnosticsVersion') !== 'missing');
    aggregates[`${key}BiomeTransitionDensityMedian`] = metric('biomeTransitionDensity');
    aggregates[`${key}BiomeTransitionDensityP95`] = percentile(samples.map((item) => readMetric(item, 'biomeTransitionDensity')), 0.95);
    aggregates[`${key}BiomeIsolatedCellShareMedian`] = metric('biomeIsolatedCellShare');
    aggregates[`${key}BiomeIsolatedCellShareP95`] = percentile(samples.map((item) => readMetric(item, 'biomeIsolatedCellShare')), 0.95);
    aggregates[`${key}BiomeTinyPatchCellShareMedian`] = metric('biomeTinyPatchCellShare');
    aggregates[`${key}BiomeTinyPatchCellShareP95`] = percentile(samples.map((item) => readMetric(item, 'biomeTinyPatchCellShare')), 0.95);
    aggregates[`${key}BiomeMeanTemperatureVarianceMedian`] = metric('biomeMeanTemperatureVarianceProxyC');
    aggregates[`${key}BiomeP90TemperatureVarianceMedian`] = metric('biomeP90TemperatureVarianceProxyC');
    aggregates[`${key}BiomeLowVarianceLandShareMedian`] = metric('biomeLowVarianceLandShare');
    aggregates[`${key}BiomeHighVarianceLandShareMedian`] = metric('biomeHighVarianceLandShare');
    aggregates[`${key}TerrainMountainousShareOfLandMedian`] = metric('terrainMountainousShareOfLand');
    for (const biomeName of ['IceCap', 'Tundra', 'Desert', 'Grassland', 'Forest', 'Rainforest', 'Wetland']) aggregates[`${key}TerrainMountainousBiomeShare${biomeName}Median`] = metric(`terrainMountainousBiomeShare${biomeName}`);
    for (const regimeName of CLIMATE_REGIME_KEYS) {
      aggregates[`${key}BiomeClimateRegimeShare${regimeName}Median`] = metric(`biomeClimateRegimeShare${regimeName}`);
      aggregates[`${key}BiomeClimateRegimeVariance${regimeName}MedianC`] = metric(`biomeClimateRegimeVariance${regimeName}C`);
    }
    for (const [source] of BIOME_SUPPORT_CHECKS) {
      const suffix = source.replace(/^biome/, '').replace(/Share$/, '');
      aggregates[`${key}Biome${suffix}Median`] = metric(source);
      aggregates[`${key}Biome${suffix}CaseShare`] = aggregateShare(samples, (item) => readMetric(item, source) > 0);
    }
    aggregates[`${key}BiomeSupportedFindingCaseShare`] = aggregateShare(samples, (item) => BIOME_SUPPORT_CHECKS.some(([source]) => readMetric(item, source) > 0));
    for (const biomeName of BIOME_SHARE_KEYS) aggregates[`${key}BiomeLandShare${biomeName}Median`] = metric(`biomeLandShare${biomeName}`);
    if (expected[preset]) { aggregates[`${key}PlateCountExpectedMedian`] = expected[preset].center; aggregates[`${key}PlateCountExpectedStdDev`] = expected[preset].spread; }
  }
  return aggregates;
}

function aggregateNumber(aggregates: Record<string, number | string>, key: string): number {
  const value = aggregates[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function evaluateAggregateFindings(aggregates: Record<string, number | string>): string[] {
  const findings: string[] = [];
  const motionCoverage = aggregateNumber(aggregates, 'motionLifecycleCoverageShare');
  const motionTerrainShare = aggregateNumber(aggregates, 'motionDrivenTerrainChangedCellShareMedian');
  const motionAgingPasses = aggregateNumber(aggregates, 'motionAgingPassCountMedian');
  const plateOwnershipChange = aggregateNumber(aggregates, 'motionPlateOwnershipChangedCellShareMax');
  const vectorChange = aggregateNumber(aggregates, 'motionVectorChangedShareMax');
  const continentDisplacement = aggregateNumber(aggregates, 'motionContinentalCentroidDisplacementMaxRadians');
  if (motionCoverage < 0.99) findings.push(`Plate-motion lifecycle diagnostic coverage is incomplete (${motionCoverage.toFixed(2)}).`);
  if (motionTerrainShare <= 0) findings.push('Plate motion produces no measurable pre-aging terrain mutation.');
  if (motionAgingPasses <= 0) findings.push('Plate motion vectors are assigned and used before aging, but no motion-coupled pass runs during aging epochs.');
  if (plateOwnershipChange <= 0 && vectorChange <= 0) findings.push('Plate ownership and plate motion vectors remain unchanged throughout aging.');
  if (continentDisplacement <= 0) findings.push('Continental centroid displacement is zero; current continental drift metrics describe boundary interaction opportunities rather than moving continents.');
  const earthPlate = aggregateNumber(aggregates, 'earthlikePlateCountMedian');
  const earthLargest = aggregateNumber(aggregates, 'earthlikeLargestLandmassShareMedian');
  const earthLandmass = aggregateNumber(aggregates, 'earthlikeLandmassCountMedian');
  const earthIsland = aggregateNumber(aggregates, 'earthlikeIslandLandShareMedian');
  const earthSubduction = aggregateNumber(aggregates, 'earthlikeSubductionBoundaryMedian');
  const earthDriftActive = aggregateNumber(aggregates, 'earthlikeDriftActiveBoundaryPairsMedian');
  const earthPuzzle = aggregateNumber(aggregates, 'earthlikeDriftPuzzleFitPotentialMedian');
  const earthImpactEvents = aggregateNumber(aggregates, 'earthlikeImpactAppliedEventsMedian');
  const earthOceanError = Math.abs(aggregateNumber(aggregates, 'earthlikeFinalWaterOceanErrorMedian'));
  const earthDeepOcean = aggregateNumber(aggregates, 'earthlikeFinalWaterDeepOceanShareMedian');
  const earthShelf = aggregateNumber(aggregates, 'earthlikeFinalWaterShelfShareMedian');
  const earthBroadShelf = aggregateNumber(aggregates, 'earthlikeFinalWaterBroadShelfAwayFromCoastMedian');
  const earthCoastSharpness = aggregateNumber(aggregates, 'earthlikeFinalWaterCoastlineSharpnessMedian');
  const earthClimateFlatness = aggregateNumber(aggregates, 'earthlikePresentClimateFlatnessMedian');
  const earthClimatePrecipStdDev = aggregateNumber(aggregates, 'earthlikePresentClimatePrecipitationStdDevMedian');
  const earthDesertRisk = aggregateNumber(aggregates, 'earthlikePresentClimateDesertRiskMedian');
  const earthDesertWetlandOverlap = aggregateNumber(aggregates, 'earthlikePresentClimateDesertWetlandOverlapMedian');
  const earthHeadwater = aggregateNumber(aggregates, 'earthlikeHydrologyHeadwaterCandidateMedian');
  const earthRiverCells = aggregateNumber(aggregates, 'earthlikeHydrologyTopologyRiverCellShareMedian');
  const earthNamedPathCells = aggregateNumber(aggregates, 'earthlikeHydrologyNamedRiverPathCellShareMedian');
  const earthShortRivers = aggregateNumber(aggregates, 'earthlikeHydrologyShortRiverShareMedian');
  const earthCapacity = aggregateNumber(aggregates, 'earthlikeHydrologyCapacityUseMedian');
  const earthDistribution = aggregateNumber(aggregates, 'earthlikeHydrologyDistributionEvennessMedian');
  const maritimeShare = aggregateNumber(aggregates, 'biomeClimateRegimeShareMaritimeMedian');
  const continentalShare = aggregateNumber(aggregates, 'biomeClimateRegimeShareContinentalMedian');
  const maritimeVariance = aggregateNumber(aggregates, 'biomeClimateRegimeVarianceMaritimeMedianC');
  const continentalVariance = aggregateNumber(aggregates, 'biomeClimateRegimeVarianceContinentalMedianC');

  if (earthSubduction <= 0.02) findings.push(`Earthlike aggregate subduction-capable boundary median is low (${earthSubduction.toFixed(3)}).`);
  if (earthDriftActive <= 0) findings.push('Earthlike aggregate drift diagnostics report no active boundary pairs.');
  if (earthPuzzle <= 0.02) findings.push(`Earthlike aggregate puzzle-fit proxy is low (${earthPuzzle.toFixed(3)}).`);
  if (earthImpactEvents <= 0) findings.push('Earthlike aggregate impact history reports no applied impact events.');
  if (earthOceanError > 2.5) findings.push(`Earthlike aggregate final ocean error is high (${earthOceanError.toFixed(2)} percentage points).`);
  if (earthDeepOcean <= 0.28) findings.push(`Earthlike aggregate deep-ocean marine share is low (${earthDeepOcean.toFixed(2)}).`);
  if (earthShelf >= 0.55) findings.push(`Earthlike aggregate shelf marine share is high (${earthShelf.toFixed(2)}).`);
  if (earthBroadShelf >= 0.18) findings.push(`Earthlike aggregate broad shelf away from coast is high (${earthBroadShelf.toFixed(2)}).`);
  if (earthCoastSharpness <= 0.35) findings.push(`Earthlike aggregate coastline sharpness index is low (${earthCoastSharpness.toFixed(2)}).`);
  if (earthClimateFlatness >= 0.72 || earthClimatePrecipStdDev <= 0.08) findings.push(`Earthlike aggregate land rainfall variation is low (flatness ${earthClimateFlatness.toFixed(2)}, stddev ${earthClimatePrecipStdDev.toFixed(2)}).`);
  if (earthDesertRisk >= 0.72) findings.push(`Earthlike aggregate desert-risk share is high (${earthDesertRisk.toFixed(2)}).`);
  if (earthDesertWetlandOverlap >= 0.04) findings.push(`Earthlike aggregate desert/wetland overlap is high (${earthDesertWetlandOverlap.toFixed(2)}).`);
  if (earthHeadwater < 0.08) findings.push(`Earthlike aggregate hydrology headwater support is low (${earthHeadwater.toFixed(2)}).`);
  if (earthRiverCells < 0.04 && earthHeadwater >= 0.08) findings.push(`Earthlike aggregate topology river-cell share is low despite headwater support (${earthRiverCells.toFixed(2)}).`);
  if (earthNamedPathCells < 0.025 && earthRiverCells >= 0.04) findings.push(`Earthlike aggregate named-river path coverage is low despite topology river signal (${earthNamedPathCells.toFixed(2)}).`);
  if (earthShortRivers > 0.55) findings.push(`Earthlike aggregate named rivers are mostly short (${earthShortRivers.toFixed(2)}).`);
  if (earthCapacity < 0.35 && aggregateNumber(aggregates, 'earthlikeHydrologySourceCandidateCountMedian') >= aggregateNumber(aggregates, 'earthlikeHydrologyAcceptedRiverCountMedian')) findings.push(`Earthlike aggregate named river capacity use is low (${earthCapacity.toFixed(2)}).`);
  if (earthDistribution < 0.45 && earthRiverCells >= 0.04) findings.push(`Earthlike aggregate river distribution is clustered (${earthDistribution.toFixed(2)} sector evenness).`);
  if (maritimeShare >= 0.02 && continentalShare >= 0.02 && maritimeVariance > continentalVariance + 0.5) findings.push(`Climate-regime aggregate has maritime variance above continental variance (${maritimeVariance.toFixed(2)} C vs ${continentalVariance.toFixed(2)} C).`);

  const waterOcean = aggregateNumber(aggregates, 'waterworldCoastlineCellShareMedian');
  if (waterOcean >= aggregateNumber(aggregates, 'earthlikeCoastlineCellShareMedian') + 0.08) findings.push('Waterworld aggregate coastline share is unexpectedly higher than Earthlike.');
  const archLandmass = aggregateNumber(aggregates, 'archipelagoLandmassCountMedian');
  const archIsland = aggregateNumber(aggregates, 'archipelagoIslandLandShareMedian');
  if (archLandmass <= earthLandmass && archIsland <= earthIsland + 0.015) findings.push('Archipelago aggregate did not increase landmass count or island share versus Earthlike.');
  const pangeaPlate = aggregateNumber(aggregates, 'pangeaPlateCountMedian');
  const pangeaLargest = aggregateNumber(aggregates, 'pangeaLargestLandmassShareMedian');
  if (pangeaPlate >= earthPlate) findings.push(`Pangea aggregate did not reduce plate count versus Earthlike (${pangeaPlate} vs ${earthPlate}).`);
  if (pangeaLargest + 0.05 < earthLargest) findings.push(`Pangea aggregate largest-landmass share ${pangeaLargest.toFixed(2)} is below Earthlike ${earthLargest.toFixed(2)}.`);
  if (aggregateNumber(aggregates, 'pangeaBiomeClimateRegimeShareContinentalMedian') < 0.05) findings.push(`Pangea aggregate continental climate-regime share is effectively absent (${aggregateNumber(aggregates, 'pangeaBiomeClimateRegimeShareContinentalMedian').toFixed(2)}).`);
  if (aggregateNumber(aggregates, 'desertWorldBiomeClimateRegimeShareAridSeasonalMedian') < aggregateNumber(aggregates, 'earthlikeBiomeClimateRegimeShareAridSeasonalMedian') + 0.03) findings.push(`Desert World does not materially increase arid-seasonal climate-regime share versus Earthlike (${aggregateNumber(aggregates, 'desertWorldBiomeClimateRegimeShareAridSeasonalMedian').toFixed(2)} vs ${aggregateNumber(aggregates, 'earthlikeBiomeClimateRegimeShareAridSeasonalMedian').toFixed(2)}).`);
  const randomPlateSpread = aggregateNumber(aggregates, 'randomWorldPlateCountStdDev');
  const randomExpectedSpread = aggregateNumber(aggregates, 'randomWorldPlateCountExpectedStdDev');
  if (randomExpectedSpread > 0 && randomPlateSpread < randomExpectedSpread * 0.35) findings.push('Random World aggregate plate-count spread is too narrow for stress-test coverage.');

  if (aggregateNumber(aggregates, 'biomeDiagnosticsCoverageShare') < 1) findings.push('Biome diagnostics are missing from one or more completed cases.');
  if (aggregateNumber(aggregates, 'biomeIsolatedCellShareP95') > 0.08) findings.push(`Biome isolated-cell share has a high upper tail (${aggregateNumber(aggregates, 'biomeIsolatedCellShareP95').toFixed(2)} P95).`);
  if (aggregateNumber(aggregates, 'biomeTinyPatchCellShareP95') > 0.2) findings.push(`Biome tiny-patch share has a high upper tail (${aggregateNumber(aggregates, 'biomeTinyPatchCellShareP95').toFixed(2)} P95).`);
  if (aggregateNumber(aggregates, 'biomeMeanTemperatureVarianceProxyMedian') <= 0) findings.push('Biome temperature-variance proxy is not producing a meaningful signal.');
  if (aggregateNumber(aggregates, 'biomeLegacyLowVarianceSaturationShare') > 0.8 && aggregateNumber(aggregates, 'biomeLegacyHighVarianceEmptyShare') > 0.8) findings.push(`Legacy biome temperature-variance bands are saturated; use observed P25/P75 values (${aggregateNumber(aggregates, 'biomeMeanTemperatureVarianceProxyP25').toFixed(2)} C / ${aggregateNumber(aggregates, 'biomeMeanTemperatureVarianceProxyP75').toFixed(2)} C) for the next calibration pass.`);
  const earthDesert = aggregateNumber(aggregates, 'earthlikeBiomeLandShareDesertMedian');
  const desertWorldDesert = aggregateNumber(aggregates, 'desertWorldBiomeLandShareDesertMedian');
  if (desertWorldDesert <= earthDesert) findings.push(`Desert World does not increase median desert share versus Earthlike (${desertWorldDesert.toFixed(2)} vs ${earthDesert.toFixed(2)}).`);
  const waterWetland = aggregateNumber(aggregates, 'waterworldBiomeLandShareWetlandMedian');
  if (waterWetland > 0.2) findings.push(`Waterworld wetland share is high (${waterWetland.toFixed(2)} of land); verify hydrologic support is not merely coast adjacency.`);
  const earthMountain = aggregateNumber(aggregates, 'earthlikeBiomeLandShareMountainMedian');
  const desertMountain = aggregateNumber(aggregates, 'desertWorldBiomeLandShareMountainMedian');
  const earthMountainousTerrain = aggregateNumber(aggregates, 'earthlikeTerrainMountainousShareOfLandMedian');
  const desertMountainousTerrain = aggregateNumber(aggregates, 'desertWorldTerrainMountainousShareOfLandMedian');
  if (earthMountain > 0 || desertMountain > 0) findings.push(`Legacy mountain biome output remains (Earthlike ${earthMountain.toFixed(2)}, Desert World ${desertMountain.toFixed(2)}); terrain and ecology are not fully separated.`);
  if (earthMountainousTerrain <= 0.01) findings.push('Earthlike mountainous terrain coverage is effectively absent after terrain/biome separation.');
  if (desertMountainousTerrain <= 0.01) findings.push('Desert World mountainous terrain coverage is effectively absent after terrain/biome separation.');
  for (const preset of PRESETS) {
    const key = presetKey(preset);
    if (aggregateNumber(aggregates, `${key}BiomeSupportedFindingCaseShare`) > 0) findings.push(`${preset} has named biome support failures in ${(aggregateNumber(aggregates, `${key}BiomeSupportedFindingCaseShare`) * 100).toFixed(0)}% of cases.`);
  }
  return findings;
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  if (event.data.type === 'cancel') { cancelled = true; return; }
  cancelled = false;
  const { mode, baseConfig } = event.data;
  const cases = buildTestCases(mode);
  const rawResults = new Map<string, PresetTestResult>();
  const results: PresetTestResult[] = [];
  try {
    for (let index = 0; index < cases.length; index += 1) {
      if (cancelled) { messenger.postMessage({ type: 'cancelled', completed: index, total: cases.length }); return; }
      const testCase = cases[index];
      const started = performance.now();
      let result: PresetTestResult;
      try {
        const config = prepareSystemOrbitConfig(configForTestCase(baseConfig, testCase));
        const project = reconcileSystemOrbitPresets(generateProjectWithNativeStages(config, { appVersion: APP_VERSION }));
        const fingerprint = { ...fingerprintProject(project), ...fingerprintInitialTerrain(project), ...fingerprintDeepTimeLedger(project) } as TerrainFingerprint;
        result = { testCase, fingerprint, status: 'pass', findings: [], elapsedMs: performance.now() - started };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = { testCase, status: 'error', findings: [message], error: message, elapsedMs: performance.now() - started };
      }
      rawResults.set(testCase.id, result);
      const compared = compareResult(result, rawResults.get(`${testCase.seed}:sol-like:${testCase.worldPresetId}`), rawResults.get(`${testCase.seed}:${testCase.starPresetId}:Earthlike`));
      results.push(compared);
      messenger.postMessage({ type: 'progress', completed: index + 1, total: cases.length, currentId: testCase.id, result: compared });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const aggregates = aggregateResults(results);
    const aggregateFindings = evaluateAggregateFindings(aggregates);
    const summary = { pass: 0, warning: 0, fail: 0, error: 0 };
    for (const result of results) summary[result.status] += 1;
    summary.warning += aggregateFindings.length;
    messenger.postMessage({ type: 'complete', report: { reportVersion: 2, generatedAt: new Date().toISOString(), appVersion: APP_VERSION, mode, resolution: { width: 512, height: 256 }, topologyResolution: 64, seeds: [...new Set(cases.map((item) => item.seed))], totalCases: cases.length, results, summary, aggregates, aggregateFindings } });
  } catch (error) {
    messenger.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
