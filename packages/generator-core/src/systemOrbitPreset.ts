import {
  biomeNames,
  biomeToCode,
  clamp,
  codeToBiome,
  type GenerationConfig,
  type ParameterRanges,
  type WorldProject
} from '@world-forge/shared';
import type { DeepTimeProject, PlanetaryDynamicsModel, StellarActivityClass, StellarModel } from './deepTimePipeline';
import { sampleNumericDistribution, type NumericDistribution, type RandomSource } from './numericDistribution';

type StarPresetId = 'sol-like' | 'habitable' | 'exotic';
type ExtendedGenerationConfig = GenerationConfig & {
  starPresetId?: StarPresetId;
  worldPresetId?: string;
  seeds?: { star?: string; world?: string };
  randomWorldArchetype?: string;
  parameterDistributions?: Record<string, NumericDistribution>;
};

const randomWorldRanges: ParameterRanges = {
  systemAgeGy: { min: 0.8, max: 10.5, unit: 'Gy' },
  oceanPercentage: { min: 5, max: 95, unit: '%' },
  averageTemperatureC: { min: -25, max: 45, unit: 'C' },
  aridity: { min: 0.05, max: 0.95 },
  seaLevel: { min: -0.2, max: 0.2 },
  axialTiltDeg: { min: 0, max: 70, unit: 'deg' },
  orbitalEccentricity: { min: 0, max: 0.28 },
  sizeClass: { min: 0.45, max: 2.2 },
  moonCount: { min: 0, max: 5 },
  impactFrequency: { min: 0.2, max: 2.5 },
  plateCount: { min: 3, max: 68 },
  riverDensity: { min: 0.1, max: 3.5 },
  continentCount: { min: 1, max: 10 },
  continentScale: { min: 0.15, max: 1 },
  islandDensity: { min: 0, max: 1 }
};

export const plateCountDistributionsByPreset: Record<string, NumericDistribution> = {
  Earthlike: { kind: 'normal', median: 23, standardDeviation: 7, hardMin: 6, hardMax: 64 },
  'Habitable World': { kind: 'normal', median: 19, standardDeviation: 6, hardMin: 4, hardMax: 64 },
  Waterworld: { kind: 'normal', median: 25, standardDeviation: 5, hardMin: 4, hardMax: 64 },
  Archipelago: { kind: 'normal', median: 31, standardDeviation: 5, hardMin: 4, hardMax: 68 },
  'Desert World': { kind: 'normal', median: 18, standardDeviation: 5, hardMin: 4, hardMax: 60 },
  Pangea: { kind: 'normal', median: 9, standardDeviation: 3, hardMin: 2, hardMax: 48 },
  'Random World': { kind: 'uniform', min: 3, max: 68 }
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

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function inferWorldPreset(config: ExtendedGenerationConfig): string {
  if (config.worldPresetId) return config.worldPresetId;
  const ranges = config.parameterRanges;
  const ocean = ranges.oceanPercentage;
  if (ranges.continentCount.max <= 2 || ranges.continentScale.min >= 0.78) return 'Pangea';
  if (ranges.islandDensity.min >= 0.7 || (ranges.continentCount.min >= 5 && ranges.continentScale.max <= 0.35)) return 'Archipelago';
  if (ocean.min >= 78) return 'Waterworld';
  if (ranges.aridity.min >= 0.68) return 'Desert World';
  if (ocean.min >= 58 && ocean.max <= 72) return 'Earthlike';
  return 'Habitable World';
}

function chooseHabitableClass(rng: RandomSource): 'F' | 'G' | 'K' {
  const roll = rng.next();
  if (roll < 0.15) return 'F';
  if (roll < 0.65) return 'G';
  return 'K';
}

function stellarBase(spectralClass: 'F' | 'G' | 'K') {
  if (spectralClass === 'F') return { temperature: 6420, mass: 1.17, radius: 1.2, luminosity: 1.65 };
  if (spectralClass === 'K') return { temperature: 5030, mass: 0.79, radius: 0.78, luminosity: 0.43 };
  return { temperature: 5772, mass: 1, radius: 1, luminosity: 1 };
}

function spectralSubtype(spectralClass: 'F' | 'G' | 'K', temperatureK: number): number {
  const ranges = spectralClass === 'F' ? [6000, 7500] : spectralClass === 'G' ? [5200, 6000] : [3700, 5200];
  const hotToCool = 1 - clamp((temperatureK - ranges[0]) / (ranges[1] - ranges[0]), 0, 1);
  return Math.max(0, Math.min(9, Math.round(hotToCool * 9)));
}

function buildPresetStellarModel(project: DeepTimeProject, config: ExtendedGenerationConfig, rng: RandomSource): StellarModel {
  const preset = config.starPresetId ?? 'sol-like';
  const spectralClass: 'F' | 'G' | 'K' = preset === 'sol-like' ? 'G' : chooseHabitableClass(rng);
  const base = stellarBase(spectralClass);
  const spread = preset === 'sol-like' ? 0.045 : 0.1;
  const effectiveTemperatureK = Math.round(base.temperature * rng.range(1 - spread * 0.35, 1 + spread * 0.35));
  const ageGy = project.selectedValues.systemAgeGy;
  const activityScore = clamp(1.15 - ageGy / 7.5 + rng.range(-0.12, 0.12), 0, 1.25);
  const activityClass: StellarActivityClass = activityScore > 1.02 ? 'flare-active' : activityScore > 0.72 ? 'active' : activityScore > 0.38 ? 'moderate' : 'quiet';
  const luminositySolar = base.luminosity * rng.range(1 - spread, 1 + spread);
  const habitableScale = Math.sqrt(luminositySolar);
  return {
    spectralClass: `${spectralClass}${spectralSubtype(spectralClass, effectiveTemperatureK)}`,
    luminosityClass: 'V',
    effectiveTemperatureK,
    massSolar: round(base.mass * rng.range(1 - spread * 0.45, 1 + spread * 0.45)),
    radiusSolar: round(base.radius * rng.range(1 - spread * 0.5, 1 + spread * 0.5)),
    luminositySolar: round(luminositySolar),
    ageGy,
    metallicity: round(rng.range(-0.2, 0.2), 2),
    activityClass,
    cyclePeriodYears: round(rng.range(8, 16), 1),
    cycleAmplitude: round(clamp(activityScore * rng.range(0.006, 0.02), 0.002, 0.035), 4),
    flareFrequency: round(activityScore * rng.range(0.12, 0.9), 3),
    habitableZoneInnerAu: round(0.95 * habitableScale),
    habitableZoneOuterAu: round(1.67 * habitableScale)
  };
}

function buildPresetPlanetaryDynamics(project: DeepTimeProject, stellar: StellarModel, previous: PlanetaryDynamicsModel, worldPreset: string, rng: RandomSource): PlanetaryDynamicsModel {
  const earthlike = worldPreset === 'Earthlike';
  const random = worldPreset === 'Random World';
  const habitableCenterAu = Math.sqrt(stellar.luminositySolar);
  const orbitalFactor = earthlike ? rng.range(0.96, 1.04) : random ? rng.range(0.72, 1.35) : rng.range(0.9, 1.1);
  const lowerBound = random ? stellar.habitableZoneInnerAu * 0.78 : stellar.habitableZoneInnerAu * 1.03;
  const upperBound = random ? stellar.habitableZoneOuterAu * 1.18 : stellar.habitableZoneOuterAu * 0.97;
  const semiMajorAxisAu = clamp(habitableCenterAu * orbitalFactor, lowerBound, upperBound);
  const eccentricityMean = random
    ? round(clamp(project.primaryWorld.orbitalEccentricity, 0, 0.28), 4)
    : earthlike ? round(clamp(project.primaryWorld.orbitalEccentricity, 0, 0.07), 4) : round(clamp(project.primaryWorld.orbitalEccentricity, 0, 0.12), 4);
  return {
    ...previous,
    rotationPeriodHours: earthlike ? round(rng.range(20, 30), 2) : random ? round(rng.range(8, 72), 2) : round(rng.range(16, 40), 2),
    orbitalPeriodDays: round(365.256 * Math.sqrt(semiMajorAxisAu ** 3 / stellar.massSolar), 2),
    semiMajorAxisAu: round(semiMajorAxisAu, 4),
    eccentricityMean,
    obliquityMeanDeg: round(project.primaryWorld.axialTiltDeg, 3)
  };
}

function classifyRandomArchetype(project: WorldProject): string {
  const values = project.selectedValues;
  if (values.averageTemperatureC < -8) return values.oceanPercentage > 65 ? 'frozen_oceanic' : 'cold_supercontinent';
  if (values.averageTemperatureC > 30) return values.aridity > 0.7 ? 'hot_arid_extreme' : 'hot_greenhouse';
  if (values.axialTiltDeg > 45) return 'high_obliquity_seasonal';
  if (values.orbitalEccentricity > 0.16) return 'eccentric_seasonal';
  if (values.oceanPercentage > 82) return 'deep_oceanic';
  if (values.oceanPercentage < 22) return 'dry_marginal';
  return 'marginal_habitable';
}

export function prepareSystemOrbitConfig(input: GenerationConfig): GenerationConfig {
  const config = input as ExtendedGenerationConfig;
  const preset = inferWorldPreset(config);
  const baseRanges = preset === 'Random World' ? randomWorldRanges : input.parameterRanges;
  const distribution = config.parameterDistributions?.plateCount ?? plateCountDistributionsByPreset[preset] ?? plateCountDistributionsByPreset.Earthlike;
  const worldSeed = config.seeds?.world || input.seed;
  const distributionRng = randomSource(`${worldSeed}:${preset}:plate-count-distribution-v1`);
  const sampledPlateCount = input.selectedValues?.plateCount ?? Math.round(sampleNumericDistribution(distribution, distributionRng));
  return {
    ...input,
    parameterRanges: {
      ...baseRanges,
      plateCount: distribution.kind === 'uniform'
        ? { min: distribution.min, max: distribution.max }
        : { min: distribution.hardMin, max: distribution.hardMax }
    },
    selectedValues: {
      ...input.selectedValues,
      plateCount: sampledPlateCount,
      oceanTolerancePercentagePoints: input.selectedValues?.oceanTolerancePercentagePoints ?? (preset === 'Random World' ? 12 : 5)
    },
    parameterDistributions: {
      ...config.parameterDistributions,
      plateCount: distribution
    }
  } as GenerationConfig;
}

function propagateSystemOrbitForcing(project: DeepTimeProject, stellar: StellarModel, dynamics: PlanetaryDynamicsModel): void {
  const world = project.primaryWorld;
  const flux = stellar.luminositySolar / Math.max(0.05, dynamics.semiMajorAxisAu ** 2);
  const fluxTemperatureDelta = clamp(72 * (Math.pow(flux, 0.25) - 1), -14, 14);
  const eccentricitySeasonality = clamp(dynamics.eccentricityMean * 16, 0, 5);
  const tiltSeasonality = clamp(Math.abs(dynamics.obliquityMeanDeg - 23.4) / 18, 0, 2.5);
  const rotationMoisture = clamp((24 / Math.max(8, dynamics.rotationPeriodHours) - 1) * 0.035, -0.045, 0.06);
  let iceCount = 0;
  const biomeCounts = Object.fromEntries(biomeNames.map((biome) => [biome, 0])) as Record<string, number>;

  for (let index = 0; index < world.layers.temperature.length; index += 1) {
    const latitude = Math.abs((index / world.mapModel.resolution.width) / world.mapModel.resolution.height - 0.5) * 2;
    const seasonalDelta = (eccentricitySeasonality + tiltSeasonality) * Math.max(0, latitude - 0.45) * -0.55;
    world.layers.temperature[index] += fluxTemperatureDelta + seasonalDelta;
    world.layers.wetness[index] = clamp(world.layers.wetness[index] + rotationMoisture + fluxTemperatureDelta * 0.002, 0, 1);
    world.layers.climateMoisture[index] = clamp(world.layers.climateMoisture[index] + rotationMoisture, 0, 1);
    world.layers.climatePrecipitation[index] = clamp(world.layers.climatePrecipitation[index] + rotationMoisture * 0.8, 0, 1);
    if (!world.layers.water[index]) {
      if (world.layers.temperature[index] < -2) world.layers.ice[index] = 1;
      else if (world.layers.temperature[index] > 4) world.layers.ice[index] = 0;
    }
    if (world.layers.ice[index]) iceCount += 1;

    let biome = codeToBiome(world.layers.biomes[index]);
    if (!world.layers.water[index] && !world.layers.ice[index]) {
      if (world.layers.temperature[index] <= 1.5) biome = 'tundra';
      else if (world.layers.wetness[index] < 0.2) biome = 'desert';
      else if (world.layers.temperature[index] > 20 && world.layers.wetness[index] > 0.72) biome = 'rainforest';
      else if (world.layers.wetness[index] > 0.5) biome = 'forest';
      else if (biome === 'ice_cap' || biome === 'tundra' || biome === 'desert' || biome === 'forest' || biome === 'rainforest') biome = 'grassland';
      world.layers.biomes[index] = biomeToCode(biome);
    } else if (world.layers.ice[index] && !world.layers.water[index]) {
      biome = 'ice_cap';
      world.layers.biomes[index] = biomeToCode(biome);
    }
    biomeCounts[codeToBiome(world.layers.biomes[index])] += 1;
  }

  project.metrics.icePercentage = round((iceCount / Math.max(1, world.layers.ice.length)) * 100, 2);
  project.metrics.biomeCounts = biomeCounts as typeof project.metrics.biomeCounts;
  if (world.climate) {
    world.climate.notes = [
      ...world.climate.notes.filter((note) => !note.startsWith('Stellar forcing integrated')),
      `Stellar forcing integrated from ${stellar.spectralClass}${stellar.luminosityClass}: relative flux ${round(flux, 3)}, temperature adjustment ${round(fluxTemperatureDelta, 2)} C.`
    ];
  }
}

export function reconcileSystemOrbitPresets(project: WorldProject): DeepTimeProject {
  const mutable = project as DeepTimeProject;
  const config = project.config as ExtendedGenerationConfig;
  const starSeed = config.seeds?.star || `${project.seed}:star`;
  const worldSeed = config.seeds?.world || project.seed;
  const worldPreset = inferWorldPreset(config);
  const stellarRng = randomSource(`${starSeed}:${config.starPresetId ?? 'sol-like'}:system-orbit-v2`);
  const orbitRng = randomSource(`${worldSeed}:${worldPreset}:orbit-v2`);
  const stellar = buildPresetStellarModel(mutable, config, stellarRng);
  const dynamics = buildPresetPlanetaryDynamics(mutable, stellar, mutable.primaryWorld.planetaryDynamics, worldPreset, orbitRng);

  mutable.solarSystem.stellarModel = stellar;
  mutable.solarSystem.star.type = `${stellar.spectralClass}${stellar.luminosityClass}`;
  mutable.solarSystem.star.massClass = stellar.massSolar.toFixed(2);
  mutable.solarSystem.star.luminosityClass = stellar.luminosityClass;
  mutable.solarSystem.star.ageGy = stellar.ageGy;
  mutable.solarSystem.star.colorTemperatureClass = `${stellar.effectiveTemperatureK} K`;
  mutable.primaryWorld.planetaryDynamics = dynamics;
  propagateSystemOrbitForcing(mutable, stellar, dynamics);
  mutable.config = {
    ...mutable.config,
    starPresetId: config.starPresetId ?? 'sol-like',
    worldPresetId: worldPreset,
    randomWorldArchetype: worldPreset === 'Random World' ? classifyRandomArchetype(mutable) : undefined,
    seeds: { star: starSeed, world: worldSeed }
  } as GenerationConfig;
  return mutable;
}
