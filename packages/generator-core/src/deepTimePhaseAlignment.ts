import { biomeToCode, buildCubedSphereTopology, clamp, type GenerationConfig } from '@world-forge/shared';
import type { DeepTimeProject, PlanetaryDynamicsModel, StellarModel } from './deepTimePipeline';

type ExtendedConfig = GenerationConfig & { worldPresetId?: string };

export type TerminalPhaseAlignmentDiagnostics = {
  presetId: string;
  evaluatedCandidates: number;
  searchCycleYears: number;
  sampleStepYears: number;
  initialAdvanceYears: number;
  selectedAdvanceYears: number;
  initialGlaciationPressure: number;
  selectedGlaciationPressure: number;
  targetGlaciationPressure: number;
  temperatureBeforeC: number;
  temperatureAfterC: number;
  targetTemperatureC: number;
  appliedTemperatureOffsetC: number;
  iceCellsAdded: number;
  iceCellsCleared: number;
  alignmentImprovement: number;
  advanced: boolean;
};

type Candidate = {
  advanceYears: number;
  glaciationPressure: number;
  predictedTemperatureC: number;
  score: number;
};

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function inferPreset(project: DeepTimeProject): string {
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

function targetGlaciationPressure(presetId: string, current: number): number {
  switch (presetId) {
    case 'Earthlike': return 0.2;
    case 'Habitable World': return 0.32;
    case 'Waterworld': return 0.24;
    case 'Archipelago': return 0.28;
    case 'Desert World': return 0.14;
    case 'Pangea': return 0.38;
    default: return current;
  }
}

function mean(values: Float32Array): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / Math.max(1, values.length);
}

function forcingAtTime(
  dynamics: PlanetaryDynamicsModel,
  stellar: StellarModel,
  absoluteTimeYears: number
): number {
  const eccentricity = clamp(
    dynamics.eccentricityMean
      + Math.sin((absoluteTimeYears / dynamics.eccentricityPeriodYears) * Math.PI * 2) * dynamics.eccentricityAmplitude,
    0,
    0.35
  );
  const obliquityDeg = clamp(
    dynamics.obliquityMeanDeg
      + Math.sin((absoluteTimeYears / dynamics.obliquityPeriodYears) * Math.PI * 2) * dynamics.obliquityAmplitudeDeg,
    0,
    55
  );
  const precessionIndex = Math.sin((absoluteTimeYears / dynamics.axialPrecessionPeriodYears + dynamics.precessionPhase) * Math.PI * 2);
  const stellarCycleIndex = Math.sin((absoluteTimeYears / stellar.cyclePeriodYears) * Math.PI * 2) * stellar.cycleAmplitude;
  const obliquityCooling = clamp((24 - obliquityDeg) / 18, -0.6, 1.1);
  const highLatitudeSummerInsolation = clamp(
    1 - obliquityCooling * 0.22 + precessionIndex * eccentricity * 0.8 + stellarCycleIndex,
    0.55,
    1.4
  );
  return clamp((1.04 - highLatitudeSummerInsolation) * 1.8 + obliquityCooling * 0.35, 0, 1);
}

function candidateScore(
  glaciationPressure: number,
  predictedTemperatureC: number,
  targetGlaciation: number,
  targetTemperatureC: number,
  advanceYears: number,
  maxAdvanceYears: number
): number {
  const glaciationError = Math.abs(glaciationPressure - targetGlaciation) * 2.2;
  const temperatureError = Math.abs(predictedTemperatureC - targetTemperatureC) / 8;
  const advancePenalty = (advanceYears / Math.max(1, maxAdvanceYears)) * 0.12;
  return glaciationError + temperatureError + advancePenalty;
}

function orbitalSearchPlan(dynamics: PlanetaryDynamicsModel): { cycleYears: number; stepYears: number } {
  const longestMode = Math.max(
    dynamics.eccentricityPeriodYears,
    dynamics.obliquityPeriodYears,
    dynamics.axialPrecessionPeriodYears,
    dynamics.apsidalPrecessionPeriodYears
  );
  const cycleYears = Math.round(clamp(longestMode, 36_000, 140_000));
  const rawStep = cycleYears / 13;
  const stepYears = Math.max(500, Math.round(rawStep / 100) * 100);
  return { cycleYears, stepYears };
}

function applyTemperatureAndIceAdjustment(project: DeepTimeProject, offsetC: number, selectedGlaciation: number): { added: number; cleared: number } {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const iceCap = biomeToCode('ice_cap');
  const tundra = biomeToCode('tundra');
  const grassland = biomeToCode('grassland');
  let added = 0;
  let cleared = 0;

  world.averageTemperatureC += offsetC;
  for (let cell = 0; cell < world.topologyLayers.temperature.length; cell += 1) {
    world.topologyLayers.temperature[cell] += offsetC;
    if (world.topologyLayers.water[cell]) continue;
    const latitude = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const altitude = Math.max(0, world.topologyLayers.elevation[cell] - world.seaLevel);
    const shouldClear = world.topologyLayers.ice[cell]
      && selectedGlaciation < 0.42
      && (latitude < 0.78 || world.topologyLayers.temperature[cell] > -1.5);
    const shouldAdd = !world.topologyLayers.ice[cell]
      && selectedGlaciation > 0.58
      && latitude + altitude * 0.16 > 0.84
      && world.topologyLayers.temperature[cell] < 1;
    if (shouldClear) {
      world.topologyLayers.ice[cell] = 0;
      if (world.topologyLayers.biomes[cell] === iceCap) world.topologyLayers.biomes[cell] = tundra;
      cleared += 1;
    } else if (shouldAdd) {
      world.topologyLayers.ice[cell] = 1;
      world.topologyLayers.biomes[cell] = iceCap;
      added += 1;
    }
  }

  const { width, height } = world.mapModel.resolution;
  for (let index = 0; index < world.layers.temperature.length; index += 1) {
    world.layers.temperature[index] += offsetC;
    if (world.layers.water[index]) continue;
    const y = Math.floor(index / width);
    const latitude = Math.abs(0.5 - (y + 0.5) / height) * 2;
    const shouldClear = world.layers.ice[index]
      && selectedGlaciation < 0.42
      && (latitude < 0.78 || world.layers.temperature[index] > -1.5);
    const shouldAdd = !world.layers.ice[index]
      && selectedGlaciation > 0.58
      && latitude > 0.84
      && world.layers.temperature[index] < 1;
    if (shouldClear) {
      world.layers.ice[index] = 0;
      if (world.layers.biomes[index] === iceCap) world.layers.biomes[index] = tundra;
    } else if (shouldAdd) {
      world.layers.ice[index] = 1;
      world.layers.biomes[index] = iceCap;
    } else if (!world.layers.ice[index] && world.layers.biomes[index] === tundra && world.layers.temperature[index] > 4) {
      world.layers.biomes[index] = grassland;
    }
  }

  return { added, cleared };
}

export function alignTerminalOrbitalPhase(project: DeepTimeProject): TerminalPhaseAlignmentDiagnostics {
  const world = project.primaryWorld;
  const presetId = inferPreset(project);
  const dynamics = world.planetaryDynamics;
  const stellar = project.solarSystem.stellarModel;
  const absoluteEndYears = project.selectedValues.systemAgeGy * 1_000_000_000;
  const { cycleYears, stepYears } = orbitalSearchPlan(dynamics);
  const currentTemperature = mean(world.layers.temperature);
  const targetTemperature = project.selectedValues.averageTemperatureC;
  const initialGlaciation = forcingAtTime(dynamics, stellar, absoluteEndYears);
  const desiredGlaciation = targetGlaciationPressure(presetId, initialGlaciation);
  const candidates: Candidate[] = [];

  for (let sample = 0; sample <= 13; sample += 1) {
    const advanceYears = sample === 13 ? cycleYears : Math.min(cycleYears, sample * stepYears);
    if (candidates.some((candidate) => candidate.advanceYears === advanceYears)) continue;
    const glaciationPressure = forcingAtTime(dynamics, stellar, absoluteEndYears + advanceYears);
    const phaseTemperatureEffect = (0.42 - glaciationPressure) * 4.2;
    const predictedTemperatureC = currentTemperature + phaseTemperatureEffect;
    candidates.push({
      advanceYears,
      glaciationPressure,
      predictedTemperatureC,
      score: candidateScore(glaciationPressure, predictedTemperatureC, desiredGlaciation, targetTemperature, advanceYears, cycleYears)
    });
  }

  const initial = candidates[0];
  const selected = [...candidates].sort((a, b) => a.score - b.score || a.advanceYears - b.advanceYears)[0] ?? initial;
  const improvement = Math.max(0, initial.score - selected.score);
  const advanced = selected.advanceYears > 0 && improvement >= 0.03 && presetId !== 'Random World';
  const chosen = advanced ? selected : initial;
  const targetCorrection = clamp(targetTemperature - currentTemperature, -4, 4) * 0.55;
  const phaseCorrection = clamp((0.42 - chosen.glaciationPressure) * 4.2, -2.5, 2.5);
  const offsetC = advanced ? clamp(targetCorrection + phaseCorrection * 0.45, -3.5, 3.5) : 0;
  const ice = advanced ? applyTemperatureAndIceAdjustment(project, offsetC, chosen.glaciationPressure) : { added: 0, cleared: 0 };
  const finalTemperature = advanced ? mean(world.layers.temperature) : currentTemperature;

  const diagnostics: TerminalPhaseAlignmentDiagnostics = {
    presetId,
    evaluatedCandidates: candidates.length,
    searchCycleYears: cycleYears,
    sampleStepYears: stepYears,
    initialAdvanceYears: 0,
    selectedAdvanceYears: chosen.advanceYears,
    initialGlaciationPressure: round(initial.glaciationPressure),
    selectedGlaciationPressure: round(chosen.glaciationPressure),
    targetGlaciationPressure: round(desiredGlaciation),
    temperatureBeforeC: round(currentTemperature),
    temperatureAfterC: round(finalTemperature),
    targetTemperatureC: round(targetTemperature),
    appliedTemperatureOffsetC: round(offsetC),
    iceCellsAdded: ice.added,
    iceCellsCleared: ice.cleared,
    alignmentImprovement: round(improvement),
    advanced
  };

  const extended = world.deepTime as typeof world.deepTime & { terminalPhaseAlignment?: TerminalPhaseAlignmentDiagnostics };
  extended.terminalPhaseAlignment = diagnostics;
  world.deepTime.notes.push(
    advanced
      ? `Terminal orbital phase advanced ${chosen.advanceYears} years after sampling ${candidates.length} points across a ${cycleYears}-year Milankovitch-like search cycle.`
      : `Terminal orbital phase retained its natural stopping point; no temperature, ice, or biome state was changed.`
  );
  return diagnostics;
}
