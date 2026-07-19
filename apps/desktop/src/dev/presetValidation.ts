import { buildCubedSphereTopology, type GenerationConfig, type ParameterRanges, type WorldProject } from '@world-forge/shared';

export type PresetTestMode = 'short' | 'full' | 'deep';
export type PresetTestStatus = 'pass' | 'warning' | 'fail' | 'error';
export type TestStarPreset = 'sol-like' | 'habitable';

export type PresetTestCase = { id: string; seed: string; starPresetId: TestStarPreset; worldPresetId: string; baselineId: string };

export type WorldFingerprint = {
  starClass: string; stellarMass: number; stellarLuminosity: number; stellarTemperatureK: number;
  orbitalPeriodDays: number; rotationPeriodHours: number; semiMajorAxisAu: number; axialTiltDeg: number; eccentricity: number;
  meanTemperatureC: number; meanWetness: number; oceanPercentage: number; landPercentage: number; icePercentage: number;
  riverCount: number; lakeCellCount: number; randomWorldArchetype?: string; topologyCellCount: number;
  elevationMin: number; elevationMax: number; elevationMean: number; elevationStdDev: number; elevationRoughness: number;
  lowBasinShare: number; highReliefShare: number; volcanismMean: number; activeVolcanismShare: number; impactFrequency: number;
  plateCount: number; continentalPlateShare: number; largestPlateShare: number; smallestPlateShare: number;
  plateSizeCoefficientOfVariation: number; plateBoundaryCellShare: number; meanPlateSpeed: number; plateSpeedStdDev: number;
  convergentBoundaryShare: number; divergentBoundaryShare: number; transformBoundaryShare: number;
  subductionBoundaryShare: number; collisionUpliftBoundaryShare: number; faultZoneBoundaryShare: number;
  boundaryVolcanismRatio: number; tectonicActivityIndex: number;
  movementScore: number; boundaryDensityScore: number; collisionEnergyScore: number; volcanismScore: number;
  cratonCount: number; cratonPlateShare: number; meanCratonAgeGy: number; meanCratonStability: number;
  meanCratonLithosphereThickness: number; meanCratonRiftSusceptibility: number; oldestCratonAgeGy: number;
  cratonExposureShare: number; cratonSubmergedShare: number; exposedCratonCellCount: number; submergedCratonCellCount: number;
  biomePercentages: Record<string, number>;
};

export type PresetTestResult = { testCase: PresetTestCase; fingerprint?: WorldFingerprint; status: PresetTestStatus; findings: string[]; elapsedMs: number; error?: string };
export type PresetValidationReport = {
  reportVersion: 2; generatedAt: string; appVersion: string; mode: PresetTestMode;
  resolution: { width: 512; height: 256 }; topologyResolution: 64; seeds: string[]; totalCases: number;
  results: PresetTestResult[]; summary: { pass: number; warning: number; fail: number; error: number };
  aggregates?: Record<string, number | string>;
  aggregateFindings?: string[];
};

const habitableWorldRanges: ParameterRanges = {
  systemAgeGy: { min: 2.5, max: 7.5, unit: 'Gy' }, oceanPercentage: { min: 45, max: 72, unit: '%' },
  averageTemperatureC: { min: 10, max: 22, unit: 'C' }, aridity: { min: 0.35, max: 0.65 }, seaLevel: { min: -0.08, max: 0.08 },
  axialTiltDeg: { min: 10, max: 32, unit: 'deg' }, orbitalEccentricity: { min: 0, max: 0.08 }, sizeClass: { min: 0.85, max: 1.15 },
  moonCount: { min: 0, max: 3 }, impactFrequency: { min: 0.6, max: 1.4 }, plateCount: { min: 10, max: 32 },
  riverDensity: { min: 1.2, max: 2.2 }, continentCount: { min: 3, max: 7 }, continentScale: { min: 0.45, max: 0.65 }, islandDensity: { min: 0.25, max: 0.55 }
};

const randomWorldRanges: ParameterRanges = {
  systemAgeGy: { min: 0.8, max: 10.5, unit: 'Gy' }, oceanPercentage: { min: 5, max: 95, unit: '%' },
  averageTemperatureC: { min: -25, max: 45, unit: 'C' }, aridity: { min: 0.05, max: 0.95 }, seaLevel: { min: -0.2, max: 0.2 },
  axialTiltDeg: { min: 0, max: 70, unit: 'deg' }, orbitalEccentricity: { min: 0, max: 0.28 }, sizeClass: { min: 0.45, max: 2.2 },
  moonCount: { min: 0, max: 5 }, impactFrequency: { min: 0.2, max: 2.5 }, plateCount: { min: 5, max: 40 },
  riverDensity: { min: 0.1, max: 3.5 }, continentCount: { min: 1, max: 10 }, continentScale: { min: 0.15, max: 1 }, islandDensity: { min: 0, max: 1 }
};

function rangesFrom(overrides: Partial<ParameterRanges>): ParameterRanges { return { ...habitableWorldRanges, ...overrides }; }

export const validationWorldPresets: Record<string, { ranges: ParameterRanges; tolerance?: number }> = {
  Earthlike: { ranges: rangesFrom({ oceanPercentage: { min: 58, max: 72, unit: '%' }, aridity: { min: 0.35, max: 0.6 }, plateCount: { min: 14, max: 24 }, continentCount: { min: 4, max: 7 }, continentScale: { min: 0.5, max: 0.68 }, islandDensity: { min: 0.25, max: 0.5 }, riverDensity: { min: 1.5, max: 2.4 } }) },
  'Habitable World': { ranges: habitableWorldRanges },
  Waterworld: { ranges: rangesFrom({ oceanPercentage: { min: 78, max: 88, unit: '%' }, plateCount: { min: 18, max: 34 }, continentCount: { min: 2, max: 5 }, continentScale: { min: 0.18, max: 0.38 }, islandDensity: { min: 0.45, max: 0.85 }, riverDensity: { min: 0.7, max: 1.5 } }) },
  Archipelago: { ranges: rangesFrom({ oceanPercentage: { min: 64, max: 78, unit: '%' }, plateCount: { min: 24, max: 40 }, continentCount: { min: 5, max: 10 }, continentScale: { min: 0.16, max: 0.34 }, islandDensity: { min: 0.7, max: 1 }, riverDensity: { min: 0.8, max: 1.8 } }) },
  'Desert World': { ranges: rangesFrom({ oceanPercentage: { min: 28, max: 45, unit: '%' }, aridity: { min: 0.68, max: 0.9 }, averageTemperatureC: { min: 18, max: 30, unit: 'C' }, plateCount: { min: 10, max: 26 }, continentCount: { min: 2, max: 5 }, continentScale: { min: 0.48, max: 0.75 }, islandDensity: { min: 0.1, max: 0.35 }, riverDensity: { min: 0.3, max: 1.1 } }), tolerance: 8 },
  Pangea: { ranges: rangesFrom({ oceanPercentage: { min: 48, max: 62, unit: '%' }, plateCount: { min: 6, max: 14 }, continentCount: { min: 1, max: 2 }, continentScale: { min: 0.78, max: 1 }, islandDensity: { min: 0, max: 0.18 }, riverDensity: { min: 1.8, max: 3.2 } }) },
  'Random World': { ranges: randomWorldRanges, tolerance: 12 }
};

export const referenceSeeds = Array.from({ length: 10 }, (_, index) => String(1000997 + index));
export const deepReferenceSeeds = Array.from({ length: 100 }, (_, index) => String(1000951 + index));

export function buildTestCases(mode: PresetTestMode): PresetTestCase[] {
  const worldPresets = Object.keys(validationWorldPresets);
  const seeds = mode === 'deep' ? deepReferenceSeeds : referenceSeeds;
  const cases: PresetTestCase[] = [];
  for (const seed of seeds) {
    const baselineId = `${seed}:sol-like:Earthlike`;
    if (mode === 'full' || mode === 'deep') {
      for (const starPresetId of ['sol-like', 'habitable'] as const) for (const worldPresetId of worldPresets) cases.push({ id: `${seed}:${starPresetId}:${worldPresetId}`, seed, starPresetId, worldPresetId, baselineId });
    } else {
      cases.push({ id: baselineId, seed, starPresetId: 'sol-like', worldPresetId: 'Earthlike', baselineId });
      cases.push({ id: `${seed}:habitable:Earthlike`, seed, starPresetId: 'habitable', worldPresetId: 'Earthlike', baselineId });
      for (const worldPresetId of worldPresets.filter((name) => name !== 'Earthlike')) cases.push({ id: `${seed}:sol-like:${worldPresetId}`, seed, starPresetId: 'sol-like', worldPresetId, baselineId });
    }
  }
  return cases;
}

export function configForTestCase(base: GenerationConfig, testCase: PresetTestCase): GenerationConfig {
  const preset = validationWorldPresets[testCase.worldPresetId];
  return { ...base, seed: testCase.seed, seeds: { star: testCase.seed, world: testCase.seed }, starPresetId: testCase.starPresetId,
    worldPresetId: testCase.worldPresetId, parameterRanges: preset.ranges, selectedValues: { oceanTolerancePercentagePoints: preset.tolerance ?? 5 },
    outputResolution: { width: 512, height: 256 }, topologyResolution: 64 } as GenerationConfig;
}

function mean(values: Float32Array): number { let total = 0; for (const value of values) total += value; return total / Math.max(1, values.length); }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function rounded(value: number): number { return Number(value.toFixed(4)); }
function wrappedAngle(value: number): number { return Math.atan2(Math.sin(value), Math.cos(value)); }

function crustFingerprint(project: WorldProject) {
  const elevation = project.primaryWorld.topologyLayers.elevation;
  const volcanism = project.primaryWorld.topologyLayers.volcanism;
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  let min = Infinity, max = -Infinity, sum = 0, sumSq = 0, roughness = 0, edges = 0, volcanic = 0, volcanicSum = 0;
  for (let cell = 0; cell < elevation.length; cell += 1) {
    const value = elevation[cell]; min = Math.min(min, value); max = Math.max(max, value); sum += value; sumSq += value * value;
    const volcanicValue = volcanism[cell] ?? 0; volcanicSum += volcanicValue; if (volcanicValue >= 0.55) volcanic += 1;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor > cell) { roughness += Math.abs(value - elevation[neighbor]); edges += 1; }
    }
  }
  const averageValue = sum / Math.max(1, elevation.length);
  const stdDev = Math.sqrt(Math.max(0, sumSq / Math.max(1, elevation.length) - averageValue * averageValue));
  const lowThreshold = averageValue - stdDev * 0.65;
  const highThreshold = averageValue + stdDev * 1.25;
  let low = 0, high = 0;
  for (const value of elevation) { if (value <= lowThreshold) low += 1; if (value >= highThreshold) high += 1; }
  return {
    topologyCellCount: elevation.length, elevationMin: rounded(min), elevationMax: rounded(max), elevationMean: rounded(averageValue),
    elevationStdDev: rounded(stdDev), elevationRoughness: rounded(roughness / Math.max(1, edges)), lowBasinShare: rounded(low / Math.max(1, elevation.length)),
    highReliefShare: rounded(high / Math.max(1, elevation.length)), volcanismMean: rounded(volcanicSum / Math.max(1, volcanism.length)),
    activeVolcanismShare: rounded(volcanic / Math.max(1, volcanism.length)), impactFrequency: project.selectedValues.impactFrequency
  };
}

function plateFingerprint(project: WorldProject) {
  const plates = project.primaryWorld.plates;
  const plateLayer = project.primaryWorld.topologyLayers.plates;
  const volcanism = project.primaryWorld.topologyLayers.volcanism;
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  const counts = new Map<number, number>();
  for (const id of plateLayer) counts.set(id, (counts.get(id) ?? 0) + 1);
  const sizes = [...counts.values()];
  const total = Math.max(1, plateLayer.length);
  const sizeMean = sizes.reduce((sum, value) => sum + value, 0) / Math.max(1, sizes.length);
  const sizeVariance = sizes.reduce((sum, value) => sum + (value - sizeMean) ** 2, 0) / Math.max(1, sizes.length);
  const continental = plates.filter((plate) => plate.kind === 'continental').length;
  const speeds = plates.map((plate) => Math.hypot(plate.motionX, plate.motionY));
  const speedMean = average(speeds);
  const speedVariance = average(speeds.map((value) => (value - speedMean) ** 2));

  let boundaryCells = 0, boundaryEdges = 0, convergent = 0, divergent = 0, transform = 0, subduction = 0, uplift = 0, fault = 0;
  let convergenceEnergy = 0, collisionEnergy = 0, boundaryVolcanism = 0, interiorVolcanism = 0, interiorCells = 0, activeBoundaryVolcanism = 0;
  const boundaryMask = new Uint8Array(total);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const plateId = plateLayer[cell];
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || plateLayer[neighbor] === plateId) continue;
      boundaryMask[cell] = 1;
      if (neighbor <= cell) continue;
      const a = plates[plateId];
      const b = plates[plateLayer[neighbor]];
      if (!a || !b) continue;
      const boundaryX = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]);
      const boundaryY = topology.latitudes[neighbor] - topology.latitudes[cell];
      const length = Math.max(0.000001, Math.hypot(boundaryX, boundaryY));
      const nx = boundaryX / length;
      const ny = boundaryY / length;
      const relativeX = b.motionX - a.motionX;
      const relativeY = b.motionY - a.motionY;
      const convergence = relativeX * nx + relativeY * ny;
      const shear = Math.abs(relativeX * -ny + relativeY * nx);
      boundaryEdges += 1;
      if (convergence > 0.18) {
        convergent += 1;
        convergenceEnergy += convergence;
        const densityFactor = a.kind === 'continental' && b.kind === 'continental' ? 1.15 : 1;
        collisionEnergy += convergence * densityFactor;
        if (a.kind !== b.kind || (a.kind === 'oceanic' && b.kind === 'oceanic')) subduction += 1;
        if (a.kind === 'continental' && b.kind === 'continental') uplift += 1;
      } else if (convergence < -0.16) divergent += 1;
      else { transform += 1; if (shear > 0.45) fault += 1; }
    }
  }
  let globalVolcanism = 0;
  for (let cell = 0; cell < total; cell += 1) {
    const value = volcanism[cell] ?? 0;
    globalVolcanism += value;
    if (boundaryMask[cell]) {
      boundaryCells += 1;
      boundaryVolcanism += value;
      if (value >= 0.55) activeBoundaryVolcanism += 1;
    } else {
      interiorCells += 1;
      interiorVolcanism += value;
    }
  }
  const boundaryVolcanismMean = boundaryVolcanism / Math.max(1, boundaryCells);
  const interiorVolcanismMean = interiorVolcanism / Math.max(1, interiorCells);
  const globalVolcanismMean = globalVolcanism / total;
  const activeBoundaryShare = activeBoundaryVolcanism / Math.max(1, boundaryCells);
  const concentrationScore = Math.min(1, Math.log10(1 + boundaryVolcanismMean / Math.max(0.0001, interiorVolcanismMean)) / 1.8);
  const activeShare = (convergent + divergent + fault) / Math.max(1, boundaryEdges);
  const meanConvergenceEnergy = convergenceEnergy / Math.max(1, convergent);
  const meanCollisionEnergy = collisionEnergy / Math.max(1, convergent);
  const movementScore = Math.min(1, speedMean / 5);
  const boundaryDensityScore = Math.min(1, (boundaryCells / total) / 0.65);
  const collisionEnergyScore = Math.min(1, meanCollisionEnergy / 5);
  const volcanismScore = Math.min(1,
    Math.min(1, boundaryVolcanismMean / 0.5) * 0.4
    + Math.min(1, activeBoundaryShare / 0.32) * 0.3
    + Math.min(1, globalVolcanismMean / 0.34) * 0.2
    + concentrationScore * 0.1
  );
  return {
    plateCount: plates.length, continentalPlateShare: rounded(continental / Math.max(1, plates.length)),
    largestPlateShare: rounded(Math.max(...sizes, 0) / total), smallestPlateShare: rounded(Math.min(...sizes, total) / total),
    plateSizeCoefficientOfVariation: rounded(Math.sqrt(sizeVariance) / Math.max(1, sizeMean)), plateBoundaryCellShare: rounded(boundaryCells / total),
    meanPlateSpeed: rounded(speedMean), plateSpeedStdDev: rounded(Math.sqrt(speedVariance)),
    convergentBoundaryShare: rounded(convergent / Math.max(1, boundaryEdges)), divergentBoundaryShare: rounded(divergent / Math.max(1, boundaryEdges)),
    transformBoundaryShare: rounded(transform / Math.max(1, boundaryEdges)), subductionBoundaryShare: rounded(subduction / Math.max(1, boundaryEdges)),
    collisionUpliftBoundaryShare: rounded(uplift / Math.max(1, boundaryEdges)), faultZoneBoundaryShare: rounded(fault / Math.max(1, boundaryEdges)),
    boundaryVolcanismRatio: rounded(boundaryVolcanismMean / Math.max(0.0001, interiorVolcanismMean)),
    tectonicActivityIndex: rounded(activeShare * (0.55 + Math.min(1.5, speedMean) * 0.45)),
    movementScore: rounded(movementScore), boundaryDensityScore: rounded(boundaryDensityScore),
    collisionEnergyScore: rounded(collisionEnergyScore), volcanismScore: rounded(volcanismScore),
    meanConvergenceEnergy: rounded(meanConvergenceEnergy)
  };
}

function cratonFingerprint(project: WorldProject) {
  type DiagnosticCraton = { ageGy: number; stability: number; lithosphereThickness: number; riftSusceptibility: number; plateId: number; geologicalCellCount?: number; exposedCellCount?: number; submergedCellCount?: number; exposureShare?: number };
  const extended = project as WorldProject & { primaryWorld: WorldProject['primaryWorld'] & { geology?: { cratons?: DiagnosticCraton[] } } };
  const cratons = extended.primaryWorld.geology?.cratons ?? [];
  const plateIds = new Set(cratons.map((craton) => craton.plateId));
  const exposed = cratons.reduce((sum, craton) => sum + (craton.exposedCellCount ?? 0), 0);
  const submerged = cratons.reduce((sum, craton) => sum + (craton.submergedCellCount ?? 0), 0);
  const geological = cratons.reduce((sum, craton) => sum + (craton.geologicalCellCount ?? (craton.exposedCellCount ?? 0) + (craton.submergedCellCount ?? 0)), 0);
  return {
    cratonCount: cratons.length,
    cratonPlateShare: rounded(plateIds.size / Math.max(1, project.primaryWorld.plates.length)),
    meanCratonAgeGy: rounded(average(cratons.map((craton) => craton.ageGy))),
    meanCratonStability: rounded(average(cratons.map((craton) => craton.stability))),
    meanCratonLithosphereThickness: rounded(average(cratons.map((craton) => craton.lithosphereThickness))),
    meanCratonRiftSusceptibility: rounded(average(cratons.map((craton) => craton.riftSusceptibility))),
    oldestCratonAgeGy: rounded(Math.max(0, ...cratons.map((craton) => craton.ageGy))),
    cratonExposureShare: rounded(exposed / Math.max(1, geological)),
    cratonSubmergedShare: rounded(submerged / Math.max(1, geological)),
    exposedCratonCellCount: exposed,
    submergedCratonCellCount: submerged
  };
}

export function fingerprintProject(project: WorldProject): WorldFingerprint {
  const extended = project as WorldProject & { solarSystem: WorldProject['solarSystem'] & { stellarModel?: any }; primaryWorld: WorldProject['primaryWorld'] & { planetaryDynamics?: any }; config: GenerationConfig & { randomWorldArchetype?: string } };
  const stellar = extended.solarSystem.stellarModel;
  const dynamics = extended.primaryWorld.planetaryDynamics;
  const total = Math.max(1, project.primaryWorld.layers.biomes.length);
  const biomePercentages = Object.fromEntries(Object.entries(project.metrics.biomeCounts).filter(([key]) => key !== 'mountain').map(([key, value]) => [key, Number(((value / total) * 100).toFixed(2))]));
  return {
    starClass: stellar ? `${stellar.spectralClass}${stellar.luminosityClass}` : project.solarSystem.star.type,
    stellarMass: stellar?.massSolar ?? 0, stellarLuminosity: stellar?.luminositySolar ?? 0, stellarTemperatureK: stellar?.effectiveTemperatureK ?? 0,
    orbitalPeriodDays: dynamics?.orbitalPeriodDays ?? 0, rotationPeriodHours: dynamics?.rotationPeriodHours ?? 0, semiMajorAxisAu: dynamics?.semiMajorAxisAu ?? 0,
    axialTiltDeg: dynamics?.obliquityMeanDeg ?? project.primaryWorld.axialTiltDeg, eccentricity: dynamics?.eccentricityMean ?? project.primaryWorld.orbitalEccentricity,
    meanTemperatureC: rounded(mean(project.primaryWorld.layers.temperature)), meanWetness: rounded(mean(project.primaryWorld.layers.wetness)),
    oceanPercentage: project.metrics.oceanPercentage, landPercentage: project.metrics.landPercentage, icePercentage: project.metrics.icePercentage,
    riverCount: project.metrics.riverCount, lakeCellCount: project.metrics.lakeCellCount, randomWorldArchetype: extended.config.randomWorldArchetype,
    ...crustFingerprint(project), ...plateFingerprint(project), ...cratonFingerprint(project), biomePercentages
  };
}
