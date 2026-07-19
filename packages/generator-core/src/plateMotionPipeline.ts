import { buildCubedSphereTopology, clamp, type GenerationConfig, type GenerationDiagnostics, type WorldProject } from '@world-forge/shared';
import { type Craton, type DeepTimeContinentalDriftDiagnostics, type DeepTimeProgress, type DeepTimeProject } from './deepTimePipeline';
import { attachDeepTimeHistoricalProcessDiagnostics, captureHistoricalProcessBaseline } from './deepTimeHistoricalProcesses';
import { applyDeepTimeFoundationWithMutationLedger } from './deepTimeMutationLedger';
import { alignTerminalOrbitalPhase } from './deepTimePhaseAlignment';
import { attachDeepTimeStageIsolationDiagnostics, captureDeepTimeStageIsolationBaseline } from './deepTimeStageIsolation';
import { attachDeepTimeTerrainChangeDiagnostics, capturePreAgingTerrain } from './deepTimeTerrainDiagnostics';
import { generateProject, type GenerateProjectOptions } from './index';
export type { DeepTimeProgress, DeepTimeProject } from './deepTimePipeline';

type RandomSource = { next: () => number; range: (min: number, max: number) => number };
type MotionPreset = { medianCmPerYear: number; standardDeviation: number; hardMin: number; hardMax: number };
type ExtendedConfig = GenerationConfig & { worldPresetId?: string };
type CratonWithExposure = Craton & {
  geologicalCellCount: number;
  exposedCellCount: number;
  submergedCellCount: number;
  exposureShare: number;
};

const motionPresets: Record<string, MotionPreset> = {
  Earthlike: { medianCmPerYear: 4.2, standardDeviation: 2.0, hardMin: 0.05, hardMax: 16 },
  'Habitable World': { medianCmPerYear: 4.5, standardDeviation: 3.0, hardMin: 0.03, hardMax: 18 },
  Waterworld: { medianCmPerYear: 5.2, standardDeviation: 2.6, hardMin: 0.05, hardMax: 18 },
  Archipelago: { medianCmPerYear: 5.8, standardDeviation: 2.8, hardMin: 0.05, hardMax: 20 },
  'Desert World': { medianCmPerYear: 3.6, standardDeviation: 2.4, hardMin: 0.02, hardMax: 16 },
  Pangea: { medianCmPerYear: 2.8, standardDeviation: 2.5, hardMin: 0.005, hardMax: 15 },
  'Random World': { medianCmPerYear: 4.0, standardDeviation: 5.5, hardMin: 0.003, hardMax: 24 }
};

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
  return { next, range: (min, max) => min + (max - min) * next() };
}

function normal(rng: RandomSource): number {
  const u1 = Math.max(Number.EPSILON, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
}

function sampleSpeed(presetId: string, rng: RandomSource): number {
  const preset = motionPresets[presetId] ?? motionPresets.Earthlike;
  if (presetId === 'Random World') {
    const low = Math.log(preset.hardMin);
    const high = Math.log(preset.hardMax);
    return Math.exp(low + (high - low) * rng.next());
  }
  return clamp(preset.medianCmPerYear + normal(rng) * preset.standardDeviation, preset.hardMin, preset.hardMax);
}

function inferPreset(project: WorldProject): string {
  const config = project.config as ExtendedConfig;
  if (config.worldPresetId) return config.worldPresetId;
  const ranges = config.parameterRanges;
  if (ranges.continentCount.max <= 2 || ranges.continentScale.min >= 0.78) return 'Pangea';
  if (ranges.islandDensity.min >= 0.7) return 'Archipelago';
  if (ranges.oceanPercentage.min >= 78) return 'Waterworld';
  if (ranges.aridity.min >= 0.68) return 'Desert World';
  if (ranges.oceanPercentage.min >= 58 && ranges.oceanPercentage.max <= 72) return 'Earthlike';
  return 'Habitable World';
}

function applyPlateMotionMagnitude(project: WorldProject): void {
  const presetId = inferPreset(project);
  const rng = randomSource(`${project.seed}:${presetId}:plate-motion-v1`);
  const ageFactor = clamp(1.12 - project.selectedValues.systemAgeGy / 13, 0.35, 1.15);
  const sizeFactor = clamp(0.9 + (project.selectedValues.sizeClass - 1) * 0.28, 0.72, 1.28);
  const activityFactor = ageFactor * sizeFactor;
  for (const plate of project.primaryWorld.plates) {
    const directionLength = Math.max(0.000001, Math.hypot(plate.motionX, plate.motionY));
    const kindFactor = plate.kind === 'oceanic' ? 1.12 : 0.88;
    const speed = sampleSpeed(presetId, rng) * activityFactor * kindFactor;
    plate.motionX = (plate.motionX / directionLength) * speed;
    plate.motionY = (plate.motionY / directionLength) * speed;
  }
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function analyzeContinentalDrift(project: WorldProject): DeepTimeContinentalDriftDiagnostics {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const plateLayer = world.topologyLayers.plates;
  let boundaryPairs = 0;
  let activeBoundaryPairs = 0;
  let convergentPairs = 0;
  let divergentPairs = 0;
  let shearPairs = 0;
  let continentalCollisionPairs = 0;
  let continentalRiftPairs = 0;
  let subductionPairs = 0;
  let relativeSpeedTotal = 0;
  let collisionVelocityTotal = 0;
  let riftVelocityTotal = 0;
  let puzzleFitSignal = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const plateA = world.plates[plateLayer[cell]];
    if (!plateA) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor <= cell || neighbor < 0 || plateLayer[neighbor] === plateLayer[cell]) continue;
      const plateB = world.plates[plateLayer[neighbor]];
      if (!plateB) continue;
      const boundaryX = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]);
      const boundaryY = topology.latitudes[neighbor] - topology.latitudes[cell];
      const boundaryLength = Math.max(0.000001, Math.hypot(boundaryX, boundaryY));
      const nx = boundaryX / boundaryLength;
      const ny = boundaryY / boundaryLength;
      const relativeX = plateB.motionX - plateA.motionX;
      const relativeY = plateB.motionY - plateA.motionY;
      const relativeSpeed = Math.hypot(relativeX, relativeY);
      const normalVelocity = relativeX * nx + relativeY * ny;
      const shearVelocity = Math.abs(relativeX * -ny + relativeY * nx);
      const convergent = normalVelocity > 0.35;
      const divergent = normalVelocity < -0.35;
      const shear = shearVelocity > 0.65;
      const continentalPair = plateA.kind === 'continental' && plateB.kind === 'continental';
      const mixedPair = plateA.kind !== plateB.kind;

      boundaryPairs += 1;
      relativeSpeedTotal += relativeSpeed;
      if (convergent || divergent || shear) activeBoundaryPairs += 1;
      if (convergent) {
        convergentPairs += 1;
        collisionVelocityTotal += normalVelocity;
      }
      if (divergent) {
        divergentPairs += 1;
        riftVelocityTotal += Math.abs(normalVelocity);
      }
      if (shear) shearPairs += 1;
      if (continentalPair && convergent) {
        continentalCollisionPairs += 1;
        puzzleFitSignal += clamp(normalVelocity / Math.max(0.001, relativeSpeed), 0, 1) * clamp(relativeSpeed / 12, 0, 1);
      }
      if (continentalPair && divergent) {
        continentalRiftPairs += 1;
        puzzleFitSignal += clamp(Math.abs(normalVelocity) / Math.max(0.001, relativeSpeed), 0, 1) * clamp(relativeSpeed / 12, 0, 1) * 0.8;
      }
      if (mixedPair && convergent) subductionPairs += 1;
    }
  }

  const meanRelative = relativeSpeedTotal / Math.max(1, boundaryPairs);
  const activeShare = activeBoundaryPairs / Math.max(1, boundaryPairs);
  const puzzleFitPotential = clamp(puzzleFitSignal / Math.max(1, continentalCollisionPairs + continentalRiftPairs), 0, 1);
  const driftMode = activeShare < 0.12 || meanRelative < 0.8
    ? 'stagnant'
    : activeShare < 0.3
      ? 'subtle'
      : meanRelative > 11 || activeShare > 0.72
        ? 'hyperactive'
        : 'active';

  return {
    modelVersion: 'continental-drift-diagnostics-v1',
    boundaryPairs,
    activeBoundaryPairs,
    convergentBoundaryShare: round(convergentPairs / Math.max(1, boundaryPairs), 4),
    divergentBoundaryShare: round(divergentPairs / Math.max(1, boundaryPairs), 4),
    shearBoundaryShare: round(shearPairs / Math.max(1, boundaryPairs), 4),
    continentalCollisionPairs,
    continentalRiftPairs,
    subductionPairs,
    meanRelativePlateSpeedCmPerYear: round(meanRelative, 4),
    meanCollisionVelocityCmPerYear: round(collisionVelocityTotal / Math.max(1, convergentPairs), 4),
    meanRiftVelocityCmPerYear: round(riftVelocityTotal / Math.max(1, divergentPairs), 4),
    puzzleFitPotential: round(puzzleFitPotential, 4),
    driftMode,
    notes: [
      'Drift diagnostics measure retained plate motion and boundary interaction opportunities rather than drawing preview arrows.',
      'Puzzle-fit potential is a proxy built from continental collision and rifting margins with strong normal relative motion.',
      'These diagnostics validate plate-vector interaction opportunities consumed by authoritative fragment placement and stored-history response; they are not a separate terrain mutation pass.'
    ]
  };
}

function reconcileCratonExposure(project: DeepTimeProject): void {
  const world = project.primaryWorld;
  const geologicalCells = new Map<number, number[]>();
  const exposedCounts = new Map<number, number>();
  const continentalIds = world.plates.filter((plate) => plate.kind === 'continental').map((plate) => plate.id).sort((a, b) => a - b);
  const continentalSet = new Set(continentalIds);

  for (let cell = 0; cell < world.topologyLayers.plates.length; cell += 1) {
    const plateId = world.topologyLayers.plates[cell];
    if (!continentalSet.has(plateId)) continue;
    const cells = geologicalCells.get(plateId) ?? [];
    cells.push(cell);
    geologicalCells.set(plateId, cells);
    if (world.topologyLayers.elevation[cell] > world.seaLevel) {
      exposedCounts.set(plateId, (exposedCounts.get(plateId) ?? 0) + 1);
    }
  }

  const totalCells = Math.max(1, world.topologyLayers.plates.length);
  const rng = randomSource(`${project.seed}:craton-selection-v2`);
  const selected: number[] = [];
  for (const plateId of continentalIds) {
    const cells = geologicalCells.get(plateId) ?? [];
    if (!cells.length) continue;
    const plateShare = cells.length / totalCells;
    const ageFactor = clamp(project.selectedValues.systemAgeGy / 8, 0.15, 1);
    const retentionChance = clamp(0.34 + ageFactor * 0.28 + Math.min(0.22, plateShare * 4), 0.35, 0.86);
    if (rng.next() <= retentionChance) selected.push(plateId);
  }
  if (!selected.length && continentalIds.length) {
    const largest = [...continentalIds].sort((a, b) => (geologicalCells.get(b)?.length ?? 0) - (geologicalCells.get(a)?.length ?? 0))[0];
    selected.push(largest);
  }

  const reconciled: CratonWithExposure[] = [];
  for (const plateId of selected) {
    const cells = geologicalCells.get(plateId) ?? [];
    const exposedCellCount = exposedCounts.get(plateId) ?? 0;
    const submergedCellCount = Math.max(0, cells.length - exposedCellCount);
    const stability = rng.range(0.72, 0.98);
    reconciled.push({
      id: `craton-${reconciled.length + 1}`,
      plateId,
      ageGy: Number(clamp(project.selectedValues.systemAgeGy * rng.range(0.55, 0.95), 0.4, project.selectedValues.systemAgeGy).toFixed(2)),
      stability: Number(stability.toFixed(3)),
      lithosphereThickness: Number(rng.range(1.15, 1.75).toFixed(3)),
      buoyancy: Number(rng.range(0.18, 0.52).toFixed(3)),
      erosionResistance: Number(clamp(stability * rng.range(0.78, 1.08), 0.5, 1).toFixed(3)),
      riftSusceptibility: Number(clamp(1 - stability + rng.range(0, 0.16), 0.04, 0.42).toFixed(3)),
      cellCount: cells.length,
      sampleCells: cells.slice(0, 4096),
      geologicalCellCount: cells.length,
      exposedCellCount,
      submergedCellCount,
      exposureShare: Number((exposedCellCount / Math.max(1, cells.length)).toFixed(4))
    });
  }

  world.geology.cratons = reconciled;
  world.deepTime.cratons = reconciled;
  world.deepTime.notes.push('Craton-bearing continental plates are selected independently of present-day sea level; exposure and submergence are tracked separately.');
}

export function generateProjectWithMotionAwareDeepTime(
  input: Partial<GenerationConfig> = {},
  options: GenerateProjectOptions = {},
  onDeepTimeProgress?: (progress: DeepTimeProgress) => void
): DeepTimeProject {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const project = generateProject(input, options);
  const motionStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  applyPlateMotionMagnitude(project);
  const historicalProcessBaseline = captureHistoricalProcessBaseline(project);
  const preAgingTerrain = capturePreAgingTerrain(project);
  const stageIsolationBaseline = captureDeepTimeStageIsolationBaseline(project);
  const deepTimeStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const result = applyDeepTimeFoundationWithMutationLedger(project, onDeepTimeProgress);
  result.primaryWorld.deepTime.continentalDrift = analyzeContinentalDrift(result);
  attachDeepTimeTerrainChangeDiagnostics(result, preAgingTerrain);
  attachDeepTimeStageIsolationDiagnostics(result, stageIsolationBaseline);
  attachDeepTimeHistoricalProcessDiagnostics(result, historicalProcessBaseline);
  const alignmentStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  alignTerminalOrbitalPhase(result);
  reconcileCratonExposure(result);
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (result.diagnostics) {
    result.diagnostics.phases.push({ name: 'plate-motion-vector-scaling', ms: Number((deepTimeStartedAt - motionStartedAt).toFixed(3)) });
    result.diagnostics.phases.push({ name: 'deep-time-aging', ms: Number((alignmentStartedAt - deepTimeStartedAt).toFixed(3)) });
    result.diagnostics.phases.push({ name: 'terminal-orbital-phase-alignment-and-reconciliation', ms: Number((finishedAt - alignmentStartedAt).toFixed(3)) });
    result.diagnostics.totalMs = Number((finishedAt - startedAt).toFixed(3));
    augmentGenerationGraphDiagnostics(result.diagnostics, result, {
      systemOrbitMs: phaseDuration(result.diagnostics, 'select-values') + phaseDuration(result.diagnostics, 'solar-system'),
      motionCouplingMs: motionStartedAt - startedAt,
      deepTimeMs: alignmentStartedAt - deepTimeStartedAt,
      outputsValidationMs: finishedAt - alignmentStartedAt
    });
  }
  result.primaryWorld.deepTime.notes.push('Plate motion magnitude uses deterministic cm/year-scale velocities as vector input to authoritative fragment placement, stored-history terrain response, and continental-drift diagnostics without a separate pre-aging terrain mutation pass.');
  return result;
}

function augmentGenerationGraphDiagnostics(
  diagnostics: GenerationDiagnostics,
  project: DeepTimeProject,
  timings: {
    systemOrbitMs: number;
    motionCouplingMs: number;
    deepTimeMs: number;
    outputsValidationMs: number;
  }
): void {
  const graph = diagnostics.graph;
  if (!graph) return;
  const nodes = graph.nodes.filter((node) =>
    !['system.orbit', 'world.motion-coupling', 'world.deep-time-aging', 'world.outputs-validation'].includes(node.nodeId)
  );
  diagnostics.graph = {
    targetNodeId: 'world.outputs-validation',
    nodes: [
      {
        nodeId: 'system.orbit',
        version: '1',
        dependencies: [],
        durationMs: roundMs(timings.systemOrbitMs),
        outputs: [
          `${project.selectedValues.moonCount} moons`,
          `${project.selectedValues.systemAgeGy.toFixed(2)} Gy system age`,
          `${project.solarSystem.bodies.length} system bodies`
        ]
      },
      ...nodes,
      {
        nodeId: 'world.motion-coupling',
        version: '1',
        dependencies: ['projection.equirectangular-assembly'],
        durationMs: roundMs(timings.motionCouplingMs),
        outputs: [
          `${project.primaryWorld.plates.length} motion-scaled plates`,
          `${project.primaryWorld.geology?.cratons?.length ?? 0} cratons tracked`
        ]
      },
      {
        nodeId: 'world.deep-time-aging',
        version: '1',
        dependencies: ['world.motion-coupling'],
        durationMs: roundMs(timings.deepTimeMs),
        outputs: [
          `${project.primaryWorld.deepTime.epochs.length} bounded epochs`,
          `${project.primaryWorld.deepTime.tectonicAdjustedCells.toLocaleString()} tectonic adjustments`,
          `${project.primaryWorld.deepTime.weatheredCells.toLocaleString()} weathered cells`
        ]
      },
      {
        nodeId: 'world.outputs-validation',
        version: '1',
        dependencies: ['world.deep-time-aging'],
        durationMs: roundMs(timings.outputsValidationMs),
        validation: {
          valid: project.metrics.validation.oceanWithinTolerance && project.metrics.validation.riverPathsValid,
          issues: project.primaryWorld.deepTime.consistency.findings.map((message) => ({ severity: 'warning' as const, message }))
        },
        outputs: [
          `${project.diagnostics?.totalMs.toFixed(0) ?? 'n/a'} ms total generation`,
          `${project.metrics.oceanPercentage.toFixed(1)}% ocean`,
          `${project.primaryWorld.rivers.length} projected rivers`
        ]
      }
    ]
  };
}

function phaseDuration(diagnostics: GenerationDiagnostics, name: string): number {
  return diagnostics.phases.filter((phase) => phase.name === name).reduce((sum, phase) => sum + phase.ms, 0);
}

function roundMs(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}
