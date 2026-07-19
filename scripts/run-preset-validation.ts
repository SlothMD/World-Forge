import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { generateProjectWithNativeStages } from '../packages/generator-core/src/nativeStagePipeline';
import { plateCountDistributionsByPreset, prepareSystemOrbitConfig, reconcileSystemOrbitPresets } from '../packages/generator-core/src/systemOrbitPreset';
import { distributionCenter, distributionSpread } from '../packages/generator-core/src/numericDistribution';
import { createDefaultConfig, type GenerationConfig } from '../packages/shared/src/index';
import { APP_VERSION } from '../apps/desktop/src/appVersion';
import { fingerprintDeepTimeLedger } from '../apps/desktop/src/dev/deepTimeLedgerFingerprint';
import { fingerprintInitialTerrain, type InitialTerrainFingerprint } from '../apps/desktop/src/dev/initialTerrainDiagnostics';
import {
  buildTestCases,
  configForTestCase,
  fingerprintProject,
  type PresetTestMode,
  type PresetTestResult,
  type PresetValidationReport,
  type WorldFingerprint
} from '../apps/desktop/src/dev/presetValidation';

type TerrainFingerprint = WorldFingerprint & InitialTerrainFingerprint & Record<string, number | string | undefined>;

const PRESETS = ['Earthlike', 'Habitable World', 'Waterworld', 'Archipelago', 'Desert World', 'Pangea', 'Random World'] as const;
const BIOME_SHARE_KEYS = ['IceCap', 'Tundra', 'Desert', 'Grassland', 'Forest', 'Rainforest', 'Wetland', 'Mountain'] as const;
const CLIMATE_REGIME_KEYS = ['Maritime', 'Continental', 'Monsoonal', 'AridSeasonal', 'StableTropical'] as const;

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

function presetKey(preset: string): string {
  return preset.replace(/\s+/g, '').replace(/^./, (value) => value.toLowerCase());
}

function presetFingerprints(results: PresetTestResult[], preset: string): TerrainFingerprint[] {
  return results
    .filter((result) => result.testCase.starPresetId === 'sol-like' && result.testCase.worldPresetId === preset && result.fingerprint)
    .map((result) => result.fingerprint as TerrainFingerprint);
}

function expectedPlateAggregate(preset: string): { center: number; spread: number } {
  const distribution = plateCountDistributionsByPreset[preset];
  return { center: distribution ? distributionCenter(distribution) : 0, spread: distribution ? distributionSpread(distribution) : 0 };
}

function readMetric(item: TerrainFingerprint, key: string): number {
  const value = item[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readText(item: TerrainFingerprint, key: string): string {
  const value = item[key];
  return typeof value === 'string' ? value : '';
}

function aggregateMedian(samples: TerrainFingerprint[], key: string): number {
  return percentile(samples.map((item) => readMetric(item, key)), 0.5);
}

function aggregateShare(samples: TerrainFingerprint[], predicate: (item: TerrainFingerprint) => boolean): number {
  return samples.length ? samples.filter(predicate).length / samples.length : 0;
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
    if (!starChanged) findings.push('Earthlike-Friendly landed inside the Sol-Like overlap range for this seed.');
  }

  if (result.testCase.worldPresetId !== 'Earthlike' && worldBaseline?.fingerprint) {
    const a = worldBaseline.fingerprint;
    const oceanDelta = Math.abs(b.oceanPercentage - a.oceanPercentage);
    const riverDelta = Math.abs(b.riverCount - a.riverCount);
    const biomeDelta = Object.keys({ ...a.biomePercentages, ...b.biomePercentages }).reduce((sum, key) => sum + Math.abs((a.biomePercentages[key] ?? 0) - (b.biomePercentages[key] ?? 0)), 0) / 2;
    const orbitalDelta = Math.abs(b.orbitalPeriodDays - a.orbitalPeriodDays);
    if (oceanDelta < 2 && riverDelta < 3 && biomeDelta < 5 && orbitalDelta < 10 && b.plateCount === a.plateCount) fail('World preset produced no material output change across water, hydrology, biomes, orbit, or plates.');
    if (result.testCase.worldPresetId === 'Random World' && !b.randomWorldArchetype) fail('Random World did not record a generated archetype.');
  }

  if (b.topologyCellCount <= 0 || !Number.isFinite(b.elevationStdDev) || b.elevationStdDev <= 0.0001) fail('Primordial crust fingerprint is missing or effectively flat.');
  if (result.testCase.seed === '1001001' && result.testCase.starPresetId === 'sol-like' && result.testCase.worldPresetId === 'Earthlike') {
    const landBiomes = ['tundra', 'desert', 'grassland', 'forest', 'rainforest', 'wetland', 'mountain'];
    const representedLandBiomes = landBiomes.filter((biome) => (b.biomePercentages[biome] ?? 0) >= 0.5);
    const tundraShareOfLand = (b.biomePercentages.tundra ?? 0) / Math.max(0.0001, b.landPercentage);
    if (representedLandBiomes.length < 2) fail('First-launch Earthlike seed does not present multiple supported land biomes.');
    if (b.meanTemperatureC > 5 && tundraShareOfLand > 0.85) fail(`First-launch Earthlike seed collapsed to tundra despite a temperate mean climate (${(tundraShareOfLand * 100).toFixed(1)}% of land).`);
  }
  if (result.testCase.worldPresetId === 'Earthlike') {
    if (b.meanPlateSpeed < 0.5 || b.meanPlateSpeed > 9) warn(`Earthlike mean plate speed ${b.meanPlateSpeed.toFixed(2)} cm/year is outside the broad first-pass envelope.`);
    if (b.plateSpeedStdDev < 0.2) warn('Earthlike plate-speed variation is still effectively flat.');
    if (b.cratonCount <= 0 || b.cratonPlateShare <= 0) fail('Earthlike baseline retained no cratons.');
  }

  const advectionVersion = readText(b, 'plateAdvectionDiagnosticsVersion');
  if (advectionVersion !== 'plate-advection-v3') {
    fail(`Plate-advection diagnostics are missing or unexpected (${advectionVersion || 'missing'}).`);
  } else {
    const ownershipChanged = readMetric(b, 'plateAdvectionOwnershipChangedCellShare');
    const frontierAdvance = readMetric(b, 'plateAdvectionCoherentFrontierAdvanceShare');
    const marginContinuity = readMetric(b, 'plateAdvectionMarginContinuityScore');
    const orphanRisk = readMetric(b, 'plateAdvectionOrphanRiskCellShare');
    if (ownershipChanged > 0.01 && frontierAdvance <= 0) warn('Plate advection changed ownership without reporting coherent frontier advance.');
    if (ownershipChanged > 0.01 && marginContinuity < 0.25) warn(`Plate-advection margin continuity is low (${marginContinuity.toFixed(2)}).`);
    if (orphanRisk > 0.08) warn(`Plate-advection orphan-risk share is high (${orphanRisk.toFixed(2)}).`);
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

    const supportChecks: Array<[string, string, number]> = [
      ['biomeDesertHighWetnessShare', 'desert cells with high wetness', 0.08],
      ['biomeRainforestLowWetnessShare', 'rainforest cells with weak wetness support', 0.08],
      ['biomeForestExtremeColdShare', 'forest cells under extreme cold', 0.08],
      ['biomeWetlandUnsupportedShare', 'wetland cells without strong hydrologic or saturation support', 0.05],
      ['biomeWarmIceShare', 'ice-cap cells under warm conditions', 0.03],
      ['biomeMountainLowReliefShare', 'mountain-biome cells without sufficient relief or elevation', 0.08]
    ];
    for (const [key, label, threshold] of supportChecks) {
      const value = readMetric(b, key);
      if (value > threshold) warn(`Biome diagnostics found ${label} (${value.toFixed(2)} share).`);
    }
  }

  return { ...result, status, findings };
}

function aggregateResults(results: PresetTestResult[]): Record<string, number | string> {
  const fingerprints = results.flatMap((result) => result.fingerprint ? [result.fingerprint as TerrainFingerprint] : []);
  const earthlikeFriendly = results.filter((result) => result.testCase.starPresetId === 'habitable' && result.fingerprint);
  const classCounts = { F: 0, G: 0, K: 0 };
  for (const result of earthlikeFriendly) {
    const letter = result.fingerprint!.starClass.charAt(0) as keyof typeof classCounts;
    if (letter in classCounts) classCounts[letter] += 1;
  }
  const byWorld = new Map<string, string>();
  for (const result of results) {
    if (!result.fingerprint) continue;
    const item = result.fingerprint;
    byWorld.set(`${result.testCase.seed}:${result.testCase.worldPresetId}`, [item.elevationStdDev, item.elevationRoughness, item.lowBasinShare, item.highReliefShare].join(':'));
  }

  const varianceValues = fingerprints.map((item) => readMetric(item, 'biomeMeanTemperatureVarianceProxyC'));
  const diagnosticsPresent = fingerprints.filter((item) => readText(item, 'biomeDiagnosticsVersion') !== '' && readText(item, 'biomeDiagnosticsVersion') !== 'missing');
  const aggregates: Record<string, number | string> = {
    earthlikeFriendlyFShare: earthlikeFriendly.length ? classCounts.F / earthlikeFriendly.length : 0,
    earthlikeFriendlyGShare: earthlikeFriendly.length ? classCounts.G / earthlikeFriendly.length : 0,
    earthlikeFriendlyKShare: earthlikeFriendly.length ? classCounts.K / earthlikeFriendly.length : 0,
    elevationStdDevMedian: percentile(fingerprints.map((item) => item.elevationStdDev), 0.5),
    roughnessMedian: percentile(fingerprints.map((item) => item.elevationRoughness), 0.5),
    uniqueCrustFingerprintShareBySeedAndWorld: byWorld.size ? new Set(byWorld.values()).size / byWorld.size : 0,
    plateAdvectionDiagnosticsCoverageShare: fingerprints.length ? fingerprints.filter((item) => readText(item, 'plateAdvectionDiagnosticsVersion') === 'plate-advection-v3').length / fingerprints.length : 0,
    plateAdvectionPassCountMedian: aggregateMedian(fingerprints, 'plateAdvectionPassCount'),
    plateAdvectionOwnershipChangedCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionOwnershipChangedCellShare'),
    plateAdvectionContinentalOwnershipChangedCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionContinentalOwnershipChangedCellShare'),
    plateAdvectionMeanOwnershipChangesPerPassMedian: aggregateMedian(fingerprints, 'plateAdvectionMeanOwnershipChangesPerPass'),
    plateAdvectionMaxOwnershipChangesPerPassMedian: aggregateMedian(fingerprints, 'plateAdvectionMaxOwnershipChangesPerPass'),
    plateAdvectionCoherentFrontierAdvanceShareMedian: aggregateMedian(fingerprints, 'plateAdvectionCoherentFrontierAdvanceShare'),
    plateAdvectionOpenedOceanCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionOpenedOceanCellShare'),
    plateAdvectionCompressedBoundaryCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionCompressedBoundaryCellShare'),
    plateAdvectionSubductedCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionSubductedCellShare'),
    plateAdvectionYoungOceanCrustCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionYoungOceanCrustCellShare'),
    plateAdvectionCoherentRiftCorridorCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionCoherentRiftCorridorCellShare'),
    plateAdvectionMarginContinuityScoreMedian: aggregateMedian(fingerprints, 'plateAdvectionMarginContinuityScore'),
    plateAdvectionFragmentReleaseSuppressionCountMedian: aggregateMedian(fingerprints, 'plateAdvectionFragmentReleaseSuppressionCount'),
    plateAdvectionOrphanRiskCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionOrphanRiskCellShare'),
    plateAdvectionTerrainCarriedMeanAbsElevationDeltaMedian: aggregateMedian(fingerprints, 'plateAdvectionTerrainCarriedMeanAbsElevationDelta'),
    plateAdvectionTerrainCarriedMaxAbsElevationDeltaMedian: aggregateMedian(fingerprints, 'plateAdvectionTerrainCarriedMaxAbsElevationDelta'),
    plateAdvectionVolcanismCarriedCellShareMedian: aggregateMedian(fingerprints, 'plateAdvectionVolcanismCarriedCellShare'),
    biomeDiagnosticsCoverageShare: fingerprints.length ? diagnosticsPresent.length / fingerprints.length : 0,
    biomeUnsupportedCaseShare: fingerprints.length ? fingerprints.filter((item) => readMetric(item, 'biomeUnsupportedFindingCount') > 0).length / fingerprints.length : 0,
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
    const expected = expectedPlateAggregate(preset);
    aggregates[`${key}PlateCountMedian`] = percentile(samples.map((item) => item.plateCount), 0.5);
    aggregates[`${key}PlateCountStdDev`] = Number(standardDeviation(samples.map((item) => item.plateCount)).toFixed(3));
    aggregates[`${key}MeanPlateSpeedMedian`] = percentile(samples.map((item) => item.meanPlateSpeed), 0.5);
    aggregates[`${key}SubductionBoundaryMedian`] = percentile(samples.map((item) => item.subductionBoundaryShare), 0.5);
    aggregates[`${key}LandmassCountMedian`] = percentile(samples.map((item) => item.landmassCount), 0.5);
    aggregates[`${key}LargestLandmassShareMedian`] = percentile(samples.map((item) => item.largestLandmassShare), 0.5);
    aggregates[`${key}IslandLandShareMedian`] = percentile(samples.map((item) => item.islandLandShare), 0.5);
    aggregates[`${key}ImpactAppliedEventsMedian`] = aggregateMedian(samples, 'agingImpactAppliedEvents');
    aggregates[`${key}ImpactVisibleEventsMedian`] = aggregateMedian(samples, 'agingImpactVisibleEvents');
    aggregates[`${key}ImpactMeanSurvivalRatioMedian`] = aggregateMedian(samples, 'agingImpactMeanSurvivalRatio');
    aggregates[`${key}ImpactTotalOpportunitiesMedian`] = aggregateMedian(samples, 'agingImpactTotalOpportunities');
    aggregates[`${key}DriftActiveBoundaryPairsMedian`] = aggregateMedian(samples, 'agingDriftActiveBoundaryPairs');
    aggregates[`${key}DriftPuzzleFitPotentialMedian`] = aggregateMedian(samples, 'agingDriftPuzzleFitPotential');
    aggregates[`${key}DriftContinentalCollisionPairsMedian`] = aggregateMedian(samples, 'agingDriftContinentalCollisionPairs');
    aggregates[`${key}DriftContinentalRiftPairsMedian`] = aggregateMedian(samples, 'agingDriftContinentalRiftPairs');
    aggregates[`${key}DriftSubductionPairsMedian`] = aggregateMedian(samples, 'agingDriftSubductionPairs');
    aggregates[`${key}PlateAdvectionDiagnosticsCoverageShare`] = samples.length ? samples.filter((item) => readText(item, 'plateAdvectionDiagnosticsVersion') === 'plate-advection-v3').length / samples.length : 0;
    aggregates[`${key}PlateAdvectionPassCountMedian`] = aggregateMedian(samples, 'plateAdvectionPassCount');
    aggregates[`${key}PlateAdvectionOwnershipChangedCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionOwnershipChangedCellShare');
    aggregates[`${key}PlateAdvectionContinentalOwnershipChangedCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionContinentalOwnershipChangedCellShare');
    aggregates[`${key}PlateAdvectionMeanOwnershipChangesPerPassMedian`] = aggregateMedian(samples, 'plateAdvectionMeanOwnershipChangesPerPass');
    aggregates[`${key}PlateAdvectionMaxOwnershipChangesPerPassMedian`] = aggregateMedian(samples, 'plateAdvectionMaxOwnershipChangesPerPass');
    aggregates[`${key}PlateAdvectionCoherentFrontierAdvanceShareMedian`] = aggregateMedian(samples, 'plateAdvectionCoherentFrontierAdvanceShare');
    aggregates[`${key}PlateAdvectionOpenedOceanCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionOpenedOceanCellShare');
    aggregates[`${key}PlateAdvectionCompressedBoundaryCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionCompressedBoundaryCellShare');
    aggregates[`${key}PlateAdvectionSubductedCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionSubductedCellShare');
    aggregates[`${key}PlateAdvectionYoungOceanCrustCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionYoungOceanCrustCellShare');
    aggregates[`${key}PlateAdvectionCoherentRiftCorridorCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionCoherentRiftCorridorCellShare');
    aggregates[`${key}PlateAdvectionMarginContinuityScoreMedian`] = aggregateMedian(samples, 'plateAdvectionMarginContinuityScore');
    aggregates[`${key}PlateAdvectionFragmentReleaseSuppressionCountMedian`] = aggregateMedian(samples, 'plateAdvectionFragmentReleaseSuppressionCount');
    aggregates[`${key}PlateAdvectionOrphanRiskCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionOrphanRiskCellShare');
    aggregates[`${key}PlateAdvectionTerrainCarriedMeanAbsElevationDeltaMedian`] = aggregateMedian(samples, 'plateAdvectionTerrainCarriedMeanAbsElevationDelta');
    aggregates[`${key}PlateAdvectionTerrainCarriedMaxAbsElevationDeltaMedian`] = aggregateMedian(samples, 'plateAdvectionTerrainCarriedMaxAbsElevationDelta');
    aggregates[`${key}PlateAdvectionVolcanismCarriedCellShareMedian`] = aggregateMedian(samples, 'plateAdvectionVolcanismCarriedCellShare');
    aggregates[`${key}FinalWaterOceanErrorMedian`] = aggregateMedian(samples, 'finalWaterOceanErrorPercentagePoints');
    aggregates[`${key}FinalWaterDeepOceanShareMedian`] = aggregateMedian(samples, 'finalWaterDeepOceanShareOfMarine');
    aggregates[`${key}FinalWaterShelfShareMedian`] = aggregateMedian(samples, 'finalWaterImmediateShelfShareOfMarine') + aggregateMedian(samples, 'finalWaterContinentalShelfShareOfMarine');
    aggregates[`${key}FinalWaterBroadShelfAwayFromCoastMedian`] = aggregateMedian(samples, 'finalWaterBroadShelfAwayFromCoastShare');
    aggregates[`${key}FinalWaterCoastlineSharpnessMedian`] = aggregateMedian(samples, 'finalWaterCoastlineSharpnessIndex');
    aggregates[`${key}FinalWaterNearSeaLevelBandMedian`] = aggregateMedian(samples, 'finalWaterNearSeaLevelBandShare');
    aggregates[`${key}FinalWaterP90MarineDepthMedian`] = aggregateMedian(samples, 'finalWaterP90MarineDepth');
    aggregates[`${key}PresentClimateMedianTemperatureMedian`] = aggregateMedian(samples, 'presentClimateMedianTemperatureC');
    aggregates[`${key}PresentClimateMeanLandPrecipitationMedian`] = aggregateMedian(samples, 'presentClimateMeanLandPrecipitation');
    aggregates[`${key}PresentClimatePrecipitationStdDevMedian`] = aggregateMedian(samples, 'presentClimateLandPrecipitationStdDev');
    aggregates[`${key}PresentClimateFlatnessMedian`] = aggregateMedian(samples, 'presentClimatePrecipitationFlatnessIndex');
    aggregates[`${key}PresentClimateRainShadowMedian`] = aggregateMedian(samples, 'presentClimateRainShadowIndex');
    aggregates[`${key}PresentClimateDesertRiskMedian`] = aggregateMedian(samples, 'presentClimateDesertRiskShare');
    aggregates[`${key}PresentClimateDesertWetlandOverlapMedian`] = aggregateMedian(samples, 'presentClimateDesertWetlandOverlapShare');
    aggregates[`${key}HydrologyHeadwaterCandidateMedian`] = aggregateMedian(samples, 'hydrologyTerrainHeadwaterCandidateShare');
    aggregates[`${key}HydrologyHighReliefWetMedian`] = aggregateMedian(samples, 'hydrologyTerrainHighReliefWetShare');
    aggregates[`${key}HydrologyMountainHeadwaterMedian`] = aggregateMedian(samples, 'hydrologyTerrainMountainHeadwaterShare');
    aggregates[`${key}HydrologySourceCandidateCountMedian`] = aggregateMedian(samples, 'hydrologySourceCandidateCount');
    aggregates[`${key}HydrologyAcceptedRiverCountMedian`] = aggregateMedian(samples, 'hydrologyAcceptedRiverCount');
    aggregates[`${key}HydrologyCapacityUseMedian`] = aggregateMedian(samples, 'hydrologyNamedRiverCapacityUse');
    aggregates[`${key}HydrologyTopologyRiverCellShareMedian`] = aggregateMedian(samples, 'hydrologyTopologyRiverCellShare');
    aggregates[`${key}HydrologyMinorRiverCellShareMedian`] = aggregateMedian(samples, 'hydrologyTopologyMinorRiverCellShare');
    aggregates[`${key}HydrologyNavigableRiverCellShareMedian`] = aggregateMedian(samples, 'hydrologyTopologyNavigableRiverCellShare');
    aggregates[`${key}HydrologyNamedRiverPathCellShareMedian`] = aggregateMedian(samples, 'hydrologyNamedRiverPathCellShare');
    aggregates[`${key}HydrologyShortRiverShareMedian`] = aggregateMedian(samples, 'hydrologyShortRiverShare');
    aggregates[`${key}HydrologySourceToMouthDropMedian`] = aggregateMedian(samples, 'hydrologyMedianSourceToMouthDrop');
    aggregates[`${key}HydrologyMedianRiverPathLengthMedian`] = aggregateMedian(samples, 'hydrologyMedianRiverPathLength');
    aggregates[`${key}HydrologyOceanTerminusShareMedian`] = aggregateMedian(samples, 'hydrologyOceanTerminusShare');
    aggregates[`${key}HydrologyBasinTerminusShareMedian`] = aggregateMedian(samples, 'hydrologyBasinTerminusShare');
    aggregates[`${key}HydrologyDistributionEvennessMedian`] = aggregateMedian(samples, 'hydrologyRiverDistributionEvenness');

    aggregates[`${key}BiomeDiagnosticsCoverageShare`] = samples.length ? samples.filter((item) => readText(item, 'biomeDiagnosticsVersion') !== 'missing').length / samples.length : 0;
    aggregates[`${key}BiomeUnsupportedCaseShare`] = samples.length ? samples.filter((item) => readMetric(item, 'biomeUnsupportedFindingCount') > 0).length / samples.length : 0;
    aggregates[`${key}BiomeTransitionDensityMedian`] = aggregateMedian(samples, 'biomeTransitionDensity');
    aggregates[`${key}BiomeIsolatedCellShareMedian`] = aggregateMedian(samples, 'biomeIsolatedCellShare');
    aggregates[`${key}BiomeTinyPatchCellShareMedian`] = aggregateMedian(samples, 'biomeTinyPatchCellShare');
    aggregates[`${key}BiomeMeanTemperatureVarianceMedian`] = aggregateMedian(samples, 'biomeMeanTemperatureVarianceProxyC');
    aggregates[`${key}BiomeP90TemperatureVarianceMedian`] = aggregateMedian(samples, 'biomeP90TemperatureVarianceProxyC');
    aggregates[`${key}BiomeHighVarianceLandShareMedian`] = aggregateMedian(samples, 'biomeHighVarianceLandShare');
    aggregates[`${key}BiomeDesertHighWetnessMedian`] = aggregateMedian(samples, 'biomeDesertHighWetnessShare');
    aggregates[`${key}BiomeRainforestLowWetnessMedian`] = aggregateMedian(samples, 'biomeRainforestLowWetnessShare');
    aggregates[`${key}BiomeForestExtremeColdMedian`] = aggregateMedian(samples, 'biomeForestExtremeColdShare');
    aggregates[`${key}BiomeWetlandUnsupportedMedian`] = aggregateMedian(samples, 'biomeWetlandUnsupportedShare');
    aggregates[`${key}BiomeWarmIceMedian`] = aggregateMedian(samples, 'biomeWarmIceShare');
    aggregates[`${key}BiomeMountainLowReliefMedian`] = aggregateMedian(samples, 'biomeMountainLowReliefShare');
    for (const regimeName of CLIMATE_REGIME_KEYS) {
      aggregates[`${key}BiomeClimateRegimeShare${regimeName}Median`] = aggregateMedian(samples, `biomeClimateRegimeShare${regimeName}`);
      aggregates[`${key}BiomeClimateRegimeVariance${regimeName}MedianC`] = aggregateMedian(samples, `biomeClimateRegimeVariance${regimeName}C`);
    }
    aggregates[`${key}BiomeSupportedFindingCaseShare`] = aggregateShare(samples, (item) => [
      'biomeDesertHighWetnessShare',
      'biomeRainforestLowWetnessShare',
      'biomeForestExtremeColdShare',
      'biomeWetlandUnsupportedShare',
      'biomeWarmIceShare',
      'biomeMountainLowReliefShare'
    ].some((source) => readMetric(item, source) > 0));
    for (const biomeName of BIOME_SHARE_KEYS) aggregates[`${key}BiomeLandShare${biomeName}Median`] = aggregateMedian(samples, `biomeLandShare${biomeName}`);

    if (expected.center) {
      aggregates[`${key}PlateCountExpectedMedian`] = expected.center;
      aggregates[`${key}PlateCountExpectedStdDev`] = expected.spread;
    }
  }
  return aggregates;
}

function aggregateNumber(aggregates: Record<string, number | string>, key: string): number {
  const value = aggregates[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function evaluateAggregateFindings(aggregates: Record<string, number | string>): string[] {
  const findings: string[] = [];
  const earthPlate = aggregateNumber(aggregates, 'earthlikePlateCountMedian');
  const earthLargest = aggregateNumber(aggregates, 'earthlikeLargestLandmassShareMedian');
  const earthLandmass = aggregateNumber(aggregates, 'earthlikeLandmassCountMedian');
  const earthIsland = aggregateNumber(aggregates, 'earthlikeIslandLandShareMedian');
  if (aggregateNumber(aggregates, 'earthlikeSubductionBoundaryMedian') <= 0.02) findings.push('Earthlike aggregate subduction-capable boundary median is low.');
  if (aggregateNumber(aggregates, 'earthlikeDriftActiveBoundaryPairsMedian') <= 0) findings.push('Earthlike aggregate drift diagnostics report no active boundary pairs.');
  if (aggregateNumber(aggregates, 'earthlikeDriftPuzzleFitPotentialMedian') <= 0.02) findings.push('Earthlike aggregate puzzle-fit proxy is low.');
  if (aggregateNumber(aggregates, 'earthlikeImpactAppliedEventsMedian') <= 0) findings.push('Earthlike aggregate impact history reports no applied impact events.');
  if (Math.abs(aggregateNumber(aggregates, 'earthlikeFinalWaterOceanErrorMedian')) > 2.5) findings.push('Earthlike aggregate final ocean error is high.');
  if (aggregateNumber(aggregates, 'earthlikeFinalWaterDeepOceanShareMedian') <= 0.28) findings.push('Earthlike aggregate deep-ocean marine share is low.');
  if (aggregateNumber(aggregates, 'earthlikeFinalWaterShelfShareMedian') >= 0.55) findings.push('Earthlike aggregate shelf marine share is high.');
  if (aggregateNumber(aggregates, 'earthlikeFinalWaterBroadShelfAwayFromCoastMedian') >= 0.18) findings.push('Earthlike aggregate broad shelf away from coast is high.');
  if (aggregateNumber(aggregates, 'earthlikeFinalWaterCoastlineSharpnessMedian') <= 0.35) findings.push('Earthlike aggregate coastline sharpness index is low.');
  const earthClimateFlatness = aggregateNumber(aggregates, 'earthlikePresentClimateFlatnessMedian');
  const earthClimatePrecipStdDev = aggregateNumber(aggregates, 'earthlikePresentClimatePrecipitationStdDevMedian');
  if (earthClimateFlatness >= 0.72 || earthClimatePrecipStdDev <= 0.08) findings.push(`Earthlike aggregate land rainfall variation is low (flatness ${earthClimateFlatness.toFixed(2)}, stddev ${earthClimatePrecipStdDev.toFixed(2)}).`);
  if (aggregateNumber(aggregates, 'earthlikePresentClimateDesertRiskMedian') >= 0.72) findings.push('Earthlike aggregate desert-risk share is high.');
  if (aggregateNumber(aggregates, 'earthlikePresentClimateDesertWetlandOverlapMedian') >= 0.04) findings.push('Earthlike aggregate desert/wetland overlap is high.');
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
  if (earthHeadwater < 0.08) findings.push(`Earthlike aggregate hydrology headwater support is low (${earthHeadwater.toFixed(2)}).`);
  if (earthRiverCells < 0.04 && earthHeadwater >= 0.08) findings.push(`Earthlike aggregate topology river-cell share is low despite headwater support (${earthRiverCells.toFixed(2)}).`);
  if (earthNamedPathCells < 0.025 && earthRiverCells >= 0.04) findings.push(`Earthlike aggregate named-river path coverage is low despite topology river signal (${earthNamedPathCells.toFixed(2)}).`);
  if (earthShortRivers > 0.55) findings.push(`Earthlike aggregate named rivers are mostly short (${earthShortRivers.toFixed(2)}).`);
  if (earthCapacity < 0.35 && aggregateNumber(aggregates, 'earthlikeHydrologySourceCandidateCountMedian') >= aggregateNumber(aggregates, 'earthlikeHydrologyAcceptedRiverCountMedian')) findings.push(`Earthlike aggregate named river capacity use is low (${earthCapacity.toFixed(2)}).`);
  if (earthDistribution < 0.45 && earthRiverCells >= 0.04) findings.push(`Earthlike aggregate river distribution is clustered (${earthDistribution.toFixed(2)} sector evenness).`);
  if (maritimeShare >= 0.02 && continentalShare >= 0.02 && maritimeVariance > continentalVariance + 0.5) findings.push(`Climate-regime aggregate has maritime variance above continental variance (${maritimeVariance.toFixed(2)} C vs ${continentalVariance.toFixed(2)} C).`);
  if (aggregateNumber(aggregates, 'archipelagoLandmassCountMedian') <= earthLandmass && aggregateNumber(aggregates, 'archipelagoIslandLandShareMedian') <= earthIsland + 0.015) findings.push('Archipelago aggregate did not increase landmass count or island share versus Earthlike.');
  if (aggregateNumber(aggregates, 'pangeaPlateCountMedian') >= earthPlate) findings.push('Pangea aggregate did not reduce plate count versus Earthlike.');
  if (aggregateNumber(aggregates, 'pangeaLargestLandmassShareMedian') + 0.05 < earthLargest) findings.push('Pangea aggregate largest-landmass share is below Earthlike.');
  if (aggregateNumber(aggregates, 'pangeaBiomeClimateRegimeShareContinentalMedian') < 0.05) findings.push(`Pangea aggregate continental climate-regime share is effectively absent (${aggregateNumber(aggregates, 'pangeaBiomeClimateRegimeShareContinentalMedian').toFixed(2)}).`);

  if (aggregateNumber(aggregates, 'plateAdvectionDiagnosticsCoverageShare') < 1) findings.push('Plate-advection-v3 diagnostics are missing from one or more completed cases.');
  if (aggregateNumber(aggregates, 'earthlikePlateAdvectionOwnershipChangedCellShareMedian') > 0.01 && aggregateNumber(aggregates, 'earthlikePlateAdvectionCoherentFrontierAdvanceShareMedian') <= 0) findings.push('Earthlike plate advection reports ownership movement without coherent frontier advance.');
  if (aggregateNumber(aggregates, 'earthlikePlateAdvectionMarginContinuityScoreMedian') < 0.25) findings.push('Earthlike plate-advection margin continuity median is low.');
  if (aggregateNumber(aggregates, 'earthlikePlateAdvectionOrphanRiskCellShareMedian') > 0.08) findings.push('Earthlike plate-advection orphan-risk median is high.');
  if (aggregateNumber(aggregates, 'biomeDiagnosticsCoverageShare') < 1) findings.push('Biome diagnostics are missing from one or more completed cases.');
  if (aggregateNumber(aggregates, 'biomeTransitionDensityP95') > 0.7) findings.push('Biome transition density has a high upper tail, suggesting fragmented assignment in some worlds.');
  if (aggregateNumber(aggregates, 'biomeIsolatedCellShareP95') > 0.08) findings.push('Biome isolated-cell share has a high upper tail.');
  if (aggregateNumber(aggregates, 'biomeTinyPatchCellShareP95') > 0.2) findings.push('Biome tiny-patch share has a high upper tail.');
  if (aggregateNumber(aggregates, 'biomeMeanTemperatureVarianceProxyMedian') <= 0) findings.push('Biome temperature-variance proxy is not producing a meaningful signal.');
  if (aggregateNumber(aggregates, 'earthlikeBiomeUnsupportedCaseShare') > 0.5) findings.push('Most Earthlike cases expose at least one unsupported biome assignment.');
  if (aggregateNumber(aggregates, 'desertWorldBiomeLandShareDesertMedian') <= aggregateNumber(aggregates, 'earthlikeBiomeLandShareDesertMedian')) findings.push('Desert World does not increase median desert share versus Earthlike.');
  if (aggregateNumber(aggregates, 'desertWorldBiomeClimateRegimeShareAridSeasonalMedian') < aggregateNumber(aggregates, 'earthlikeBiomeClimateRegimeShareAridSeasonalMedian') + 0.03) findings.push(`Desert World does not materially increase arid-seasonal climate-regime share versus Earthlike (${aggregateNumber(aggregates, 'desertWorldBiomeClimateRegimeShareAridSeasonalMedian').toFixed(2)} vs ${aggregateNumber(aggregates, 'earthlikeBiomeClimateRegimeShareAridSeasonalMedian').toFixed(2)}).`);
  if (aggregateNumber(aggregates, 'waterworldBiomeLandShareWetlandMedian') > 0.35) findings.push('Waterworld land is dominated by wetland classification; verify this is supported rather than ocean-adjacent overreach.');
  if (aggregateNumber(aggregates, 'earthlikeBiomeLandShareMountainMedian') > 0.2) findings.push('Earthlike mountain biome share is high; confirm terrain support rather than using biome as relief.');
  return findings;
}

function fmt(value: number | string | undefined): string {
  if (typeof value === 'number') return String(Number(value.toFixed(4)));
  return value ?? '';
}

function markdown(report: PresetValidationReport): string {
  const lines = [
    '# Preset Validation Report',
    '',
    `- App version: ${report.appVersion}`,
    `- Generated: ${report.generatedAt}`,
    `- Matrix: ${report.mode}`,
    `- Resolution: ${report.resolution.width} x ${report.resolution.height}; topology ${report.topologyResolution}`,
    `- Cases: ${report.totalCases}`,
    `- Passed: ${report.summary.pass}`,
    `- Warnings: ${report.summary.warning}`,
    `- Failed: ${report.summary.fail}`,
    `- Errors: ${report.summary.error}`,
    '',
    '## Aggregate diagnostics',
    ''
  ];
  for (const [key, value] of Object.entries(report.aggregates ?? {})) lines.push(`- ${key}: ${fmt(value)}`);
  if (report.aggregateFindings?.length) {
    lines.push('', '## Aggregate findings', '');
    for (const finding of report.aggregateFindings) lines.push(`- ${finding}`);
  }

  lines.push('', '## Plate advection validation summary', '');
  lines.push('| Preset | Coverage | Ownership changed | Continental changed | Frontier advance | Opened ocean | Rift corridor | Margin continuity | Suppressed releases | Orphan risk |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const preset of PRESETS) {
    const key = presetKey(preset);
    const a = report.aggregates ?? {};
    lines.push(`| ${preset} | ${fmt(a[`${key}PlateAdvectionDiagnosticsCoverageShare`])} | ${fmt(a[`${key}PlateAdvectionOwnershipChangedCellShareMedian`])} | ${fmt(a[`${key}PlateAdvectionContinentalOwnershipChangedCellShareMedian`])} | ${fmt(a[`${key}PlateAdvectionCoherentFrontierAdvanceShareMedian`])} | ${fmt(a[`${key}PlateAdvectionOpenedOceanCellShareMedian`])} | ${fmt(a[`${key}PlateAdvectionCoherentRiftCorridorCellShareMedian`])} | ${fmt(a[`${key}PlateAdvectionMarginContinuityScoreMedian`])} | ${fmt(a[`${key}PlateAdvectionFragmentReleaseSuppressionCountMedian`])} | ${fmt(a[`${key}PlateAdvectionOrphanRiskCellShareMedian`])} |`);
  }

  lines.push('', '## Biome validation summary', '');
  lines.push('| Preset | Transition | Isolated | Tiny patches | Mean temp variance C | Unsupported cases | Desert | Grassland | Forest | Rainforest | Wetland | Mountain |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const preset of PRESETS) {
    const key = presetKey(preset);
    const a = report.aggregates ?? {};
    lines.push(`| ${preset} | ${fmt(a[`${key}BiomeTransitionDensityMedian`])} | ${fmt(a[`${key}BiomeIsolatedCellShareMedian`])} | ${fmt(a[`${key}BiomeTinyPatchCellShareMedian`])} | ${fmt(a[`${key}BiomeMeanTemperatureVarianceMedian`])} | ${fmt(a[`${key}BiomeUnsupportedCaseShare`])} | ${fmt(a[`${key}BiomeLandShareDesertMedian`])} | ${fmt(a[`${key}BiomeLandShareGrasslandMedian`])} | ${fmt(a[`${key}BiomeLandShareForestMedian`])} | ${fmt(a[`${key}BiomeLandShareRainforestMedian`])} | ${fmt(a[`${key}BiomeLandShareWetlandMedian`])} | ${fmt(a[`${key}BiomeLandShareMountainMedian`])} |`);
  }

  const casesWithFindings = report.results.filter((result) => result.findings.length || result.status !== 'pass');
  if (casesWithFindings.length) {
    lines.push('', '## Case findings', '');
    lines.push('| Case | Status | Findings |');
    lines.push('|---|---|---|');
    for (const result of casesWithFindings) {
      const escaped = result.findings.join(' / ').replace(/\|/g, '\\|');
      lines.push(`| ${result.testCase.id} | ${result.status} | ${escaped} |`);
    }
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const modeArgument = process.argv[2] === '--mode' ? process.argv[3] : process.argv[2];
  const mode = (modeArgument ?? 'full') as PresetTestMode;
  const cases = buildTestCases(mode);
  const baseConfig: GenerationConfig = createDefaultConfig('preset-validation-cli', { width: 512, height: 256 });
  const rawResults = new Map<string, PresetTestResult>();
  const results: PresetTestResult[] = [];
  const started = performance.now();

  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    const caseStarted = performance.now();
    let result: PresetTestResult;
    try {
      const config = prepareSystemOrbitConfig(configForTestCase(baseConfig, testCase));
      const project = reconcileSystemOrbitPresets(generateProjectWithNativeStages(config, { appVersion: APP_VERSION }));
      const fingerprint = { ...fingerprintProject(project), ...fingerprintInitialTerrain(project), ...fingerprintDeepTimeLedger(project) } as TerrainFingerprint;
      result = { testCase, fingerprint, status: 'pass', findings: [], elapsedMs: performance.now() - caseStarted };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { testCase, status: 'error', findings: [message], error: message, elapsedMs: performance.now() - caseStarted };
    }
    rawResults.set(testCase.id, result);
    results.push(compareResult(result, rawResults.get(`${testCase.seed}:sol-like:${testCase.worldPresetId}`), rawResults.get(`${testCase.seed}:${testCase.starPresetId}:Earthlike`)));
    if ((index + 1) % 10 === 0 || index + 1 === cases.length) console.log(`[preset-validation] ${index + 1}/${cases.length} ${testCase.id}`);
  }

  const aggregates = aggregateResults(results);
  const aggregateFindings = evaluateAggregateFindings(aggregates);
  const summary = { pass: 0, warning: 0, fail: 0, error: 0 };
  for (const result of results) summary[result.status] += 1;
  const report: PresetValidationReport = {
    reportVersion: 2,
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    mode,
    resolution: { width: 512, height: 256 },
    topologyResolution: 64,
    seeds: [...new Set(cases.map((item) => item.seed))],
    totalCases: cases.length,
    results,
    summary,
    aggregates,
    aggregateFindings
  };
  const elapsedMs = performance.now() - started;
  const timestamp = report.generatedAt.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const outDir = join(process.cwd(), 'validation-reports');
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `preset-validation-${timestamp}.json`);
  const mdPath = join(outDir, `preset-validation-${timestamp}.md`);
  writeFileSync(jsonPath, JSON.stringify({ ...report, elapsedMs }, null, 2));
  writeFileSync(mdPath, `${markdown(report)}\n\n- Elapsed: ${(elapsedMs / 1000).toFixed(2)} seconds\n`);
  console.log(JSON.stringify({ appVersion: APP_VERSION, mode, cases: cases.length, elapsedMs: Number(elapsedMs.toFixed(2)), summary, aggregateFindings, jsonPath, mdPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
