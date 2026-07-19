import type { GenerationConfig, WorldProject } from '@world-forge/shared';
import type { GenerationPreviewFrame, GenerateProjectOptions } from './index';
import { applyBiomeCohesion } from './biomeCohesion';
import { attachBiomeDiagnostics, type BiomeDiagnostics } from './biomeDiagnostics';
import {
  generateProjectWithMotionAwareDeepTime,
  type DeepTimeProgress,
  type DeepTimeProject
} from './plateMotionPipeline';

export const nativeGenerationStageIds = [
  'world.system-orbit',
  'world.primordial-crust',
  'world.tectonics-cratons',
  'world.initial-terrain',
  'world.deep-time-aging',
  'world.final-water',
  'world.present-climate',
  'world.hydrology',
  'world.biomes-features',
  'world.outputs-validation'
] as const;

export type NativeGenerationStageId = typeof nativeGenerationStageIds[number];
export type NativeGenerationStagePhase = 'started' | 'progress' | 'completed' | 'warning' | 'failed' | 'skipped';

export type NativeGenerationStageEvent = {
  stageId: NativeGenerationStageId;
  phase: NativeGenerationStagePhase;
  progress: number;
  overallProgress: number;
  label: string;
  startedAt: number;
  timestamp: number;
  elapsedMs?: number;
  message?: string;
  metrics?: Record<string, number | string | boolean>;
};

export type GenerateProjectWithNativeStagesOptions = GenerateProjectOptions & {
  onStageEvent?: (event: NativeGenerationStageEvent) => void;
};

const stageLabels: Record<NativeGenerationStageId, string> = {
  'world.system-orbit': 'System and orbit',
  'world.primordial-crust': 'Primordial crust',
  'world.tectonics-cratons': 'Plate and craton structure',
  'world.initial-terrain': 'Initial terrain',
  'world.deep-time-aging': 'Deep-time aging',
  'world.final-water': 'Final sea level and water',
  'world.present-climate': 'Present-day climate',
  'world.hydrology': 'Hydrology',
  'world.biomes-features': 'Biomes and features',
  'world.outputs-validation': 'Outputs and validation'
};

const stageOverallStart: Record<NativeGenerationStageId, number> = {
  'world.system-orbit': 0,
  'world.primordial-crust': 0.05,
  'world.tectonics-cratons': 0.12,
  'world.initial-terrain': 0.22,
  'world.deep-time-aging': 0.48,
  'world.final-water': 0.78,
  'world.present-climate': 0.83,
  'world.hydrology': 0.88,
  'world.biomes-features': 0.93,
  'world.outputs-validation': 0.98
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function previewStageId(preview: GenerationPreviewFrame): NativeGenerationStageId {
  if (preview.stage === 'primordial') return 'world.primordial-crust';
  if (preview.stage === 'plates') return 'world.tectonics-cratons';
  return 'world.initial-terrain';
}

function deepTimeStageId(progress: DeepTimeProgress): NativeGenerationStageId {
  if (progress.phase === 'initializing' || progress.phase === 'epoch') return 'world.deep-time-aging';
  if (progress.phase === 'complete') return 'world.outputs-validation';
  const message = progress.message.toLowerCase();
  if (message.includes('sea level') || message.includes('water mask')) return 'world.final-water';
  if (message.includes('climate') || message.includes('moisture')) return 'world.present-climate';
  if (message.includes('drainage') || message.includes('river') || message.includes('hydrology')) return 'world.hydrology';
  return 'world.biomes-features';
}

function completionMetrics(stageId: NativeGenerationStageId, project: DeepTimeProject): Record<string, number | string | boolean> | undefined {
  const world = project.primaryWorld;
  const deepTime = world.deepTime;
  if (stageId === 'world.system-orbit') {
    return {
      starClass: `${project.solarSystem.stellarModel.spectralClass}${project.solarSystem.stellarModel.luminosityClass}`,
      bodyCount: project.solarSystem.bodies.length,
      moonCount: project.selectedValues.moonCount
    };
  }
  if (stageId === 'world.tectonics-cratons') {
    const speeds = world.plates.map((plate) => Math.hypot(plate.motionX, plate.motionY));
    const meanSpeed = speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length);
    const drift = world.deepTime?.continentalDrift;
    return {
      plateCount: world.plates.length,
      cratonCount: world.geology.cratons.length,
      meanPlateSpeedCmPerYear: Number(meanSpeed.toFixed(2)),
      ...(drift ? {
        activeBoundaryPairs: drift.activeBoundaryPairs,
        driftMode: drift.driftMode,
        puzzleFitPotential: drift.puzzleFitPotential
      } : {})
    };
  }
  if (stageId === 'world.deep-time-aging') {
    return {
      epochCount: deepTime.epochs.length,
      tectonicAdjustedCells: deepTime.tectonicAdjustedCells,
      impactAdjustedCells: deepTime.impactAdjustedCells,
      impactEvents: deepTime.impactHistory.appliedEvents,
      visibleImpactEvents: deepTime.impactHistory.visibleEvents,
      impactMeanSurvivalRatio: deepTime.impactHistory.meanSurvivalRatio,
      driftMode: deepTime.continentalDrift?.driftMode ?? 'missing',
      puzzleFitPotential: deepTime.continentalDrift?.puzzleFitPotential ?? 0,
      fragmentHistoryVersion: deepTime.fragmentHistory?.modelVersion ?? 'missing',
      fragmentHistoryPuzzleFitScore: deepTime.fragmentHistory?.puzzleFitScore ?? 0,
      fragmentHistoryConjugateMarginPairs: deepTime.fragmentHistory?.conjugateMarginCandidatePairs ?? 0,
      fragmentHistoryCollisionEventPairs: deepTime.fragmentHistory?.collisionEventCandidatePairs ?? 0,
      fragmentHistoryRiftSplitCandidates: deepTime.fragmentHistory?.riftSplitCandidateFragments ?? 0,
      fragmentHistoryMotionEventScore: deepTime.fragmentHistory?.motionEventScore ?? 0,
      fragmentHistoryTerrainResponseApplied: deepTime.fragmentHistory?.terrainResponseApplied ?? false,
      fragmentHistoryTerrainResponseScale: deepTime.fragmentHistory?.terrainResponseScale ?? 0,
      fragmentHistoryTerrainResponseCellShare: deepTime.fragmentHistory?.terrainResponseCellShare ?? 0,
      fragmentHistoryMeanAbsTerrainResponseDelta: deepTime.fragmentHistory?.meanAbsTerrainResponseDelta ?? 0,
      fragmentHistoryVolcanismResponseApplied: deepTime.fragmentHistory?.volcanismResponseApplied ?? false,
      fragmentHistoryVolcanismResponseScale: deepTime.fragmentHistory?.volcanismResponseScale ?? 0,
      fragmentHistoryVolcanismResponseCellShare: deepTime.fragmentHistory?.volcanismResponseCellShare ?? 0,
      fragmentHistoryMeanVolcanismResponseDelta: deepTime.fragmentHistory?.meanVolcanismResponseDelta ?? 0,
      weatheredCells: deepTime.weatheredCells,
      glaciallyErodedCells: deepTime.glaciallyErodedCells
    };
  }
  if (stageId === 'world.final-water') {
    return {
      oceanPercentage: project.metrics.oceanPercentage,
      oceanErrorPercentagePoints: deepTime.finalWater.oceanErrorPercentagePoints,
      deepOceanShareOfMarine: deepTime.finalWater.deepOceanShareOfMarine,
      shelfShareOfMarine: deepTime.finalWater.immediateShelfShareOfMarine + deepTime.finalWater.continentalShelfShareOfMarine,
      coastlineSharpnessIndex: deepTime.finalWater.coastlineSharpnessIndex,
      broadShelfAwayFromCoastShare: deepTime.finalWater.broadShelfAwayFromCoastShare,
      marineDepthAdjustedCells: deepTime.finalWater.marineDepthAdjustedCells,
      floodedValleyCells: deepTime.floodedValleyCells,
      waterMaskCorrections: deepTime.consistency.waterMaskCorrections + deepTime.consistency.topologyWaterMaskCorrections
    };
  }
  if (stageId === 'world.present-climate') {
    let iceCells = 0;
    for (const value of world.topologyLayers.ice) iceCells += value ? 1 : 0;
    return {
      climateCells: deepTime.consistency.climateCellsRefreshed,
      iceCells,
      medianTemperatureC: deepTime.presentClimate.medianTemperatureC,
      meanLandPrecipitation: deepTime.presentClimate.meanLandPrecipitation,
      precipitationFlatnessIndex: deepTime.presentClimate.precipitationFlatnessIndex,
      rainShadowIndex: deepTime.presentClimate.rainShadowIndex,
      desertRiskShare: deepTime.presentClimate.desertRiskShare,
      desertWetlandOverlapShare: deepTime.presentClimate.desertWetlandOverlapShare
    };
  }
  if (stageId === 'world.hydrology') {
    return {
      riverCount: world.rivers.length,
      lakeCells: project.metrics.lakeCellCount,
      sourceCandidateCount: deepTime.hydrology.sourceCandidateCount,
      topologyRiverCellShare: deepTime.hydrology.topologyRiverCellShare,
      terrainHeadwaterCandidateShare: deepTime.hydrology.terrainHeadwaterCandidateShare,
      namedRiverCapacityUse: deepTime.hydrology.namedRiverCapacityUse,
      riverDistributionEvenness: deepTime.hydrology.riverDistributionEvenness,
      riverPathsValid: project.metrics.validation.riverPathsValid
    };
  }
  if (stageId === 'world.biomes-features') {
    const biomeDiagnostics = (deepTime as typeof deepTime & { biomeDiagnostics?: BiomeDiagnostics }).biomeDiagnostics;
    return {
      biomeDiagnosticsVersion: biomeDiagnostics?.modelVersion ?? 'missing',
      biomeCorrections: deepTime.consistency.biomeCorrections,
      projectedCells: deepTime.consistency.projectedCellsRefreshed,
      transitionDensity: biomeDiagnostics?.transitionDensity ?? 0,
      tinyPatchCellShare: biomeDiagnostics?.tinyPatchCellShare ?? 0,
      temperatureVarianceProxyC: biomeDiagnostics?.meanTemperatureVarianceProxyC ?? 0,
      highVarianceLandShare: biomeDiagnostics?.highVarianceLandShare ?? 0,
      unsupportedBiomeFindingCount: biomeDiagnostics?.findings.length ?? 0
    };
  }
  if (stageId === 'world.outputs-validation') {
    return {
      totalMs: project.diagnostics?.totalMs ?? 0,
      oceanWithinTolerance: project.metrics.validation.oceanWithinTolerance,
      riverPathsValid: project.metrics.validation.riverPathsValid,
      findingCount: deepTime.consistency.findings.length
    };
  }
  return undefined;
}

export function generateProjectWithNativeStages(
  input: Partial<GenerationConfig> = {},
  options: GenerateProjectWithNativeStagesOptions = {}
): WorldProject {
  const { onStageEvent, onProgress: originalProgress, ...coreOptions } = options;
  let activeIndex = 0;
  let activeStageId: NativeGenerationStageId = nativeGenerationStageIds[0];
  let stageStartedAt = nowMs();
  let completedProject: DeepTimeProject | undefined;

  const emit = (
    stageId: NativeGenerationStageId,
    phase: NativeGenerationStagePhase,
    progress: number,
    overallProgress: number,
    message?: string,
    metrics?: Record<string, number | string | boolean>
  ) => {
    const timestamp = nowMs();
    onStageEvent?.({
      stageId,
      phase,
      progress: Math.max(0, Math.min(1, progress)),
      overallProgress: Math.max(0, Math.min(1, overallProgress)),
      label: stageLabels[stageId],
      startedAt: stageId === activeStageId ? stageStartedAt : timestamp,
      timestamp,
      elapsedMs: phase === 'completed' || phase === 'failed' ? Math.max(0, timestamp - stageStartedAt) : undefined,
      message,
      metrics
    });
  };

  const transitionTo = (stageId: NativeGenerationStageId, overallProgress: number, message?: string) => {
    const targetIndex = nativeGenerationStageIds.indexOf(stageId);
    if (targetIndex < activeIndex) {
      emit(activeStageId, 'progress', 0.5, overallProgress, message);
      return;
    }
    while (activeIndex < targetIndex) {
      emit(activeStageId, 'completed', 1, overallProgress, undefined, completedProject ? completionMetrics(activeStageId, completedProject) : undefined);
      activeIndex += 1;
      activeStageId = nativeGenerationStageIds[activeIndex];
      stageStartedAt = nowMs();
      emit(activeStageId, 'started', 0, overallProgress, message);
    }
  };

  emit(activeStageId, 'started', 0, 0, 'Resolving generation configuration, stellar system, orbit, and selected values');

  try {
    const project = generateProjectWithMotionAwareDeepTime(input, {
      ...coreOptions,
      onProgress: (preview) => {
        const stageId = previewStageId(preview);
        transitionTo(stageId, Math.min(0.47, stageOverallStart[stageId]), preview.label);
        const stageProgress = stageId === 'world.initial-terrain'
          ? Math.max(0.02, Math.min(0.98, preview.progress / 0.94))
          : preview.stage === 'primordial' ? 0.7 : 0.75;
        emit(activeStageId, 'progress', stageProgress, Math.min(0.47, preview.progress * 0.5), preview.label);
        originalProgress?.(preview);
      }
    }, (progress) => {
      const stageId = deepTimeStageId(progress);
      const overall = stageOverallStart[stageId] + Math.min(0.045, progress.progress * 0.045);
      transitionTo(stageId, overall, progress.message);
      const localProgress = progress.phase === 'epoch'
        ? (progress.epochIndex ?? 0) / Math.max(1, progress.epochCount ?? 1)
        : progress.phase === 'complete' ? 0.2 : Math.max(0.05, Math.min(0.95, progress.progress));
      emit(activeStageId, 'progress', localProgress, overall, progress.message, {
        epochIndex: progress.epochIndex ?? -1,
        epochCount: progress.epochCount ?? 0,
        nestedDeepTime: progress.phase === 'epoch'
      });
    });

    applyBiomeCohesion(project);
    attachBiomeDiagnostics(project);
    completedProject = project;
    transitionTo('world.outputs-validation', 0.99, 'Assembling final project and validation results');
    emit(activeStageId, 'completed', 1, 1, 'World project complete', completionMetrics(activeStageId, project));
    return project;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(activeStageId, 'failed', 1, Math.max(stageOverallStart[activeStageId], 0.01), message);
    for (let index = activeIndex + 1; index < nativeGenerationStageIds.length; index += 1) {
      const stageId = nativeGenerationStageIds[index];
      const timestamp = nowMs();
      onStageEvent?.({
        stageId,
        phase: 'skipped',
        progress: 0,
        overallProgress: Math.max(stageOverallStart[activeStageId], 0.01),
        label: stageLabels[stageId],
        startedAt: timestamp,
        timestamp,
        message: `Skipped because ${stageLabels[activeStageId]} failed.`
      });
    }
    throw error;
  }
}
