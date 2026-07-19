import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DeepTimeProject } from '@world-forge/generator-core/deepTimePipeline';
import { coreGenerationGraph } from '@world-forge/generation-runtime/graph/generationGraph';
import type { GenerationConfig, WorldProject } from '@world-forge/shared';
import {
  generationStageTelemetryEvent,
  generationTelemetryEvent,
  type GenerationStageTelemetryDetail,
  type GenerationTelemetryDetail
} from '../generation/generationEvents';
import type { GraphNode, GraphToolbarState } from './GraphWorkspace';

export const defaultGraphToolbar: GraphToolbarState = {
  workflowId: 'core.live-world',
  fidelity: 'standard',
  seed: '1001001',
  validationStatus: ''
};

type StageState = GenerationStageTelemetryDetail;
type ExtendedGenerationConfig = GenerationConfig & {
  starPresetId?: string;
  worldPresetId?: string;
  seeds?: { star?: string; world?: string };
};

function projectArtifactSummary(project: WorldProject | undefined): Record<string, string[]> {
  if (!project) return {};
  const world = project.primaryWorld;
  const deepTimeProject = project as Partial<DeepTimeProject>;
  const stellar = deepTimeProject.solarSystem?.stellarModel;
  const dynamics = deepTimeProject.primaryWorld?.planetaryDynamics;
  const deepTime = deepTimeProject.primaryWorld?.deepTime;
  const drift = deepTime?.continentalDrift;
  const cratons = deepTimeProject.primaryWorld?.geology?.cratons ?? [];
  const config = project.config as ExtendedGenerationConfig;
  return {
    'system.orbit': [
      `Star type ${config.starPresetId === 'habitable' ? 'Earthlike-Friendly' : 'Sol-Like'} · star seed ${config.seeds?.star ?? project.seed}`,
      `World type ${config.worldPresetId ?? 'Earthlike'} · world seed ${config.seeds?.world ?? project.seed}`,
      `${project.selectedValues.moonCount} moons`,
      `${project.selectedValues.systemAgeGy.toFixed(2)} Gy system age`,
      ...(stellar ? [
        `${stellar.spectralClass}${stellar.luminosityClass} · ${stellar.effectiveTemperatureK.toLocaleString()} K`,
        `${Math.round(stellar.massSolar * 100)}% solar mass · ${Math.round(stellar.radiusSolar * 100)}% solar radius · ${Math.round(stellar.luminositySolar * 100)}% solar luminosity`,
        `${stellar.activityClass} activity · ${stellar.cyclePeriodYears.toFixed(1)} year cycle`,
        `Habitable zone ${stellar.habitableZoneInnerAu.toFixed(2)}-${stellar.habitableZoneOuterAu.toFixed(2)} AU`
      ] : []),
      ...(dynamics ? [
        `${dynamics.orbitalPeriodDays.toFixed(1)} day year · ${dynamics.rotationPeriodHours.toFixed(1)} hour day · ${dynamics.semiMajorAxisAu.toFixed(3)} AU orbit`,
        `${dynamics.obliquityMeanDeg.toFixed(1)} deg axial tilt · ${dynamics.eccentricityMean.toFixed(3)} orbital eccentricity`
      ] : [])
    ],
    'system-orbit': [
      `Star type ${config.starPresetId === 'habitable' ? 'Earthlike-Friendly' : 'Sol-Like'} · star seed ${config.seeds?.star ?? project.seed}`,
      `World type ${config.worldPresetId ?? 'Earthlike'} · world seed ${config.seeds?.world ?? project.seed}`,
      `${project.selectedValues.moonCount} moons`,
      `${project.selectedValues.systemAgeGy.toFixed(2)} Gy system age`,
      ...(stellar ? [
        `${stellar.spectralClass}${stellar.luminosityClass} · ${stellar.effectiveTemperatureK.toLocaleString()} K`,
        `${Math.round(stellar.massSolar * 100)}% solar mass · ${Math.round(stellar.radiusSolar * 100)}% solar radius · ${Math.round(stellar.luminositySolar * 100)}% solar luminosity`,
        `${stellar.activityClass} activity · ${stellar.cyclePeriodYears.toFixed(1)} year cycle`,
        `Habitable zone ${stellar.habitableZoneInnerAu.toFixed(2)}–${stellar.habitableZoneOuterAu.toFixed(2)} AU`
      ] : []),
      ...(dynamics ? [
        `${dynamics.orbitalPeriodDays.toFixed(1)} day year · ${dynamics.rotationPeriodHours.toFixed(1)} hour day · ${dynamics.semiMajorAxisAu.toFixed(3)} AU orbit`,
        `${dynamics.obliquityMeanDeg.toFixed(1)}° axial tilt · ${dynamics.eccentricityMean.toFixed(3)} orbital eccentricity`
      ] : [])
    ],
    'primordial-crust': [
      `${world.topology.cellCount.toLocaleString()} topology cells`,
      `${world.mapModel.resolution.width} x ${world.mapModel.resolution.height} projected map`
    ],
    'tectonics-cratons': [
      `${world.plates.length} plates`,
      `${project.selectedValues.continentCount} regions`,
      ...(cratons.length ? [`${cratons.length} persistent cratons`] : []),
      ...(drift ? [
        `${drift.activeBoundaryPairs.toLocaleString()} active plate-boundary pairs`,
        `${drift.driftMode} drift · ${Math.round(drift.puzzleFitPotential * 100)}% puzzle-fit proxy`
      ] : [])
    ],
    'initial-terrain': [
      `${world.topologyLayers.elevation.length.toLocaleString()} elevation cells`,
      'Provisional-to-aged surface compatibility pass complete'
    ],
    'deep-time-aging': deepTime ? [
      `${deepTime.epochs.length} bounded aging epochs`,
      `${deepTime.forcingSamples.length} orbital-forcing samples`,
      `${deepTime.tectonicAdjustedCells.toLocaleString()} tectonic adjustments`,
      `${deepTime.impactAdjustedCells.toLocaleString()} impact adjustments`,
      `${deepTime.impactHistory.appliedEvents.toLocaleString()} impact events · ${deepTime.impactHistory.visibleEvents.toLocaleString()} visible`,
      `${Math.round(deepTime.impactHistory.meanSurvivalRatio * 100)}% mean impact relief survival`,
      ...(drift ? [`${drift.continentalCollisionPairs.toLocaleString()} continental collision pairs · ${drift.continentalRiftPairs.toLocaleString()} rift pairs`] : []),
      ...(deepTime.fragmentHistory ? [
        `${deepTime.fragmentHistory.fragmentCount.toLocaleString()} continental fragments · ${deepTime.fragmentHistory.conjugateMarginCandidatePairs.toLocaleString()} conjugate margin candidates`,
        `${deepTime.fragmentHistory.collisionEventCandidatePairs.toLocaleString()} keyframed collision candidates · ${deepTime.fragmentHistory.riftSplitCandidateFragments.toLocaleString()} rift split candidates`,
        `${Math.round(deepTime.fragmentHistory.terrainResponseCellShare * 100)}% fragment terrain-response cells · ${Math.round(deepTime.fragmentHistory.terrainResponseScale * 100)}% applied scale`,
        `${Math.round(deepTime.fragmentHistory.volcanismResponseCellShare * 100)}% fragment volcanism-response cells · ${Math.round(deepTime.fragmentHistory.volcanismResponseScale * 100)}% applied scale`,
        `${Math.round(deepTime.fragmentHistory.puzzleFitScore * 100)}% fragment-history puzzle-fit score · ${Math.round(deepTime.fragmentHistory.motionEventScore * 100)}% motion-event score`
      ] : []),
      `${deepTime.weatheredCells.toLocaleString()} weathered cells`,
      `${deepTime.glaciallyErodedCells.toLocaleString()} glacial erosion operations`
    ] : [],
    'final-water': [
      `${project.metrics.oceanPercentage.toFixed(1)}% final ocean`,
      ...(deepTime ? [
        `${deepTime.floodedValleyCells.toLocaleString()} flooded valley/coastal cells`,
        `${deepTime.consistency.topologyWaterMaskCorrections.toLocaleString()} topology water-mask corrections`,
        `${Math.round(deepTime.finalWater.deepOceanShareOfMarine * 100)}% deep-ocean marine share`,
        `${Math.round((deepTime.finalWater.immediateShelfShareOfMarine + deepTime.finalWater.continentalShelfShareOfMarine) * 100)}% shelf marine share`,
        `${Math.round(deepTime.finalWater.coastlineSharpnessIndex * 100)}% coastline sharpness index`
      ] : [])
    ],
    'present-climate': [
      `${world.layers.temperature.length.toLocaleString()} temperature samples`,
      `${world.layers.wetness.length.toLocaleString()} wetness samples`,
      `${world.climate?.pipelineVersion ?? 'reconciled climate'} pipeline`,
      ...(deepTime ? [
        `${deepTime.presentClimate.medianTemperatureC.toFixed(1)} C median land temperature`,
        `${Math.round(deepTime.presentClimate.meanLandPrecipitation * 100)}% mean land precipitation`,
        `${Math.round(deepTime.presentClimate.precipitationFlatnessIndex * 100)}% precipitation flatness`,
        `${Math.round(deepTime.presentClimate.rainShadowIndex * 100)}% rain-shadow dryland signal`
      ] : []),
      ...(dynamics ? [`Atmospheric retention index ${dynamics.atmosphericRetention.toFixed(2)}`] : []),
      ...(deepTime ? [`${deepTime.persistentIceCells.toLocaleString()} peak persistent ice cells`] : [])
    ],
    hydrology: [
      `${world.rivers.length} named rivers`,
      `${project.metrics.lakeCellCount.toLocaleString()} lake cells`,
      ...(deepTime ? [
        `${Math.round(deepTime.hydrology.terrainHeadwaterCandidateShare * 100)}% terrain/headwater support`,
        `${Math.round(deepTime.hydrology.topologyRiverCellShare * 100)}% topology river cells`,
        `${Math.round(deepTime.hydrology.namedRiverCapacityUse * 100)}% named-river capacity use`,
        `${Math.round(deepTime.hydrology.riverDistributionEvenness * 100)}% coarse river distribution`
      ] : []),
      `${project.metrics.validation.riverPathsValid ? 'River paths valid' : 'River path validation finding'}`
    ],
    'biomes-features': [
      `${world.layers.biomes.length.toLocaleString()} classified cells`,
      `${world.topologyLayers.volcanism.length.toLocaleString()} volcanism samples`,
      ...(deepTime ? [
        `${deepTime.consistency.biomeCorrections.toLocaleString()} biome corrections`,
        `${deepTime.coastalAdjustedCells.toLocaleString()} coastal morphology adjustments`
      ] : [])
    ],
    'outputs-validation': [
      project.projectName,
      `${project.diagnostics?.totalMs.toFixed(0) ?? 'n/a'} ms total generation`,
      `${project.metrics.validation.oceanWithinTolerance ? 'Ocean target within tolerance' : 'Ocean target outside tolerance'}`,
      ...(deepTime ? [deepTime.modelVersion, ...deepTime.consistency.findings] : [])
    ],
    'world.motion-coupling': [
      `${world.plates.length} motion-scaled plates`,
      ...(drift ? [
        `${drift.activeBoundaryPairs.toLocaleString()} active boundary pairs`,
        `${drift.driftMode} drift · ${Math.round(drift.puzzleFitPotential * 100)}% puzzle-fit proxy`
      ] : [])
    ],
    'world.deep-time-aging': deepTime ? [
      `${deepTime.epochs.length} bounded aging epochs`,
      `${deepTime.tectonicAdjustedCells.toLocaleString()} tectonic adjustments`,
      `${deepTime.impactAdjustedCells.toLocaleString()} impact adjustments`,
      `${deepTime.weatheredCells.toLocaleString()} weathered cells`,
      `${deepTime.glaciallyErodedCells.toLocaleString()} glacial erosion operations`
    ] : [],
    'world.outputs-validation': [
      project.projectName,
      `${project.diagnostics?.totalMs.toFixed(0) ?? 'n/a'} ms total generation`,
      `${project.metrics.validation.oceanWithinTolerance ? 'Ocean target within tolerance' : 'Ocean target outside tolerance'}`,
      `${project.metrics.validation.riverPathsValid ? 'River paths valid' : 'River path validation finding'}`,
      ...(deepTime ? [deepTime.modelVersion, ...deepTime.consistency.findings] : [])
    ]
  };
}

export function useDevGraphWorkspace() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toolbar, setToolbar] = useState<GraphToolbarState>(defaultGraphToolbar);
  const [telemetry, setTelemetry] = useState<GenerationTelemetryDetail | null>(null);
  const [stageStates, setStageStates] = useState<Record<string, StageState>>({});
  const [lastProject, setLastProject] = useState<WorldProject | undefined>();

  useEffect(() => {
    const handleTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<GenerationTelemetryDetail>).detail;
      setTelemetry(detail);
      setToolbar((current) => ({ ...current, seed: detail.seed, validationStatus: '' }));
      if (detail.phase === 'started') setStageStates({});
      if (detail.phase === 'completed' && detail.project) setLastProject(detail.project);
    };
    const handleStageTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<GenerationStageTelemetryDetail>).detail;
      setStageStates((current) => ({ ...current, [detail.nodeId]: detail }));
    };
    window.addEventListener(generationTelemetryEvent, handleTelemetry);
    window.addEventListener(generationStageTelemetryEvent, handleStageTelemetry);
    return () => {
      window.removeEventListener(generationTelemetryEvent, handleTelemetry);
      window.removeEventListener(generationStageTelemetryEvent, handleStageTelemetry);
    };
  }, []);

  const markDirty = useCallback((patch: Partial<GraphToolbarState>) => {
    setToolbar((current) => ({ ...current, ...patch, validationStatus: '' }));
  }, []);

  const artifactSummary = useMemo(() => projectArtifactSummary(lastProject), [lastProject]);
  const requestedStartIndex = telemetry?.startNodeId ? coreGenerationGraph.findIndex((node) => node.id === telemetry.startNodeId) : 0;
  const graphDiagnosticsByNode = useMemo(() => {
    const entries = lastProject?.diagnostics?.graph?.nodes ?? [];
    return new Map(entries.map((entry) => [entry.nodeId, entry]));
  }, [lastProject]);

  const nodes = useMemo<GraphNode[]>(() => coreGenerationGraph.map((definition, index) => {
    const graphDiagnostic = graphDiagnosticsByNode.get(definition.id);
    const retained = Boolean(telemetry?.startNodeId) && index < Math.max(0, requestedStartIndex) && Boolean(lastProject);
    const stage = stageStates[definition.id];
    let status: GraphNode['status'] = retained ? 'retained' : graphDiagnostic || (lastProject && !telemetry) ? 'complete' : 'waiting';
    if (!retained && stage) {
      if (stage.phase === 'started' || stage.phase === 'progress') status = 'running';
      else if (stage.phase === 'completed') status = 'complete';
      else if (stage.phase === 'warning') status = 'warning';
      else if (stage.phase === 'failed') status = 'failed';
      else if (stage.phase === 'skipped') status = 'skipped';
    } else if (!retained && telemetry?.phase === 'completed') status = 'complete';

    const progress = status === 'complete' || status === 'retained' ? 1 : status === 'running' ? Math.max(0.02, Math.min(0.99, stage?.progress ?? 0)) : 0;
    const findings: string[] = [];
    if (stage?.message && (stage.phase === 'warning' || stage.phase === 'failed')) findings.push(stage.message);
    for (const issue of graphDiagnostic?.validation?.issues ?? []) findings.push(`${issue.severity}: ${issue.message}`);
    if (stage && !stage.measured) findings.push('Legacy stage boundary was not measured by generator-core.');

    return {
      ...definition,
      status,
      progress,
      elapsedMs: stage?.elapsedMs ?? graphDiagnostic?.durationMs,
      artifactSummary: graphDiagnostic?.outputs ?? artifactSummary[definition.id] ?? [],
      findings
    };
  }), [artifactSummary, graphDiagnosticsByNode, lastProject, requestedStartIndex, stageStates, telemetry]);

  const actions = useMemo(() => ({
    selectNode: (id: string) => setSelectedNodeId((current) => current === id ? null : id),
    setWorkflow: (workflowId: string) => markDirty({ workflowId }),
    setFidelity: (fidelity: string) => markDirty({ fidelity }),
    setSeed: (seed: string) => markDirty({ seed }),
    validate: () => setToolbar((current) => ({ ...current, validationStatus: 'valid' })),
    reset: () => {
      setToolbar(defaultGraphToolbar);
      setSelectedNodeId(null);
      setTelemetry(null);
      setStageStates({});
      setLastProject(undefined);
    }
  }), [markDirty]);

  return { node: nodes, selectedNodeId, toolbar, telemetry, actions };
}
