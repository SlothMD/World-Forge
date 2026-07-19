import {
  Biome,
  BiomeClassificationRule,
  ClimateCirculationSummary,
  ClimateMoistureSummary,
  ClimatePipelineOutput,
  CubedSphereTopology,
  EnergyBudgetConfig,
  GenerationConfig,
  GenerationDiagnostics,
  Moon,
  PlanetaryCalendarConfig,
  Plate,
  PrimaryWorld,
  River,
  SelectedValues,
  SolarSystem,
  SystemBody,
  WorldMetrics,
  WorldProject,
  biomeNames,
  biomeToCode,
  buildCubedSphereTopology,
  classifyBiomeFromRules,
  clamp,
  codeToBiome,
  createDefaultConfig,
  cubedSphereCellForLonLat,
  defaultParameterRanges,
  layerIndex,
  lerp,
  normalizeValue,
  topologyResolutionForOutput,
  wrapX
} from '@world-forge/shared';
import { SeededRandom } from './random';
import { runGenerationFoundation } from './graph/run-generation-foundation';
import type { GenerationGraphNodeRunEvent } from './graph/types';
import { orchestratePrimaryWorld } from './primary-world-orchestrator';

export { SeededRandom, createDefaultConfig, defaultParameterRanges };

const generatorVersion = '0.1.0-mvp';

type DiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
  record(name: string, ms: number): void;
  recordGraph(graph: NonNullable<GenerationDiagnostics['graph']>): void;
  snapshot(): GenerationDiagnostics;
};

export type GenerationPreviewStage =
  | 'primordial'
  | 'plates'
  | 'elevation'
  | 'aged'
  | 'water'
  | 'climate'
  | 'hydrology'
  | 'biomes';

export type GenerationPreviewFrame = {
  stage: GenerationPreviewStage;
  label: string;
  progress: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
};

export type GenerationProgressCallback = (frame: GenerationPreviewFrame) => void;

export type GenerateProjectOptions = {
  onProgress?: GenerationProgressCallback;
  onGraphNodeEvent?: (event: GenerationGraphNodeRunEvent) => void;
  appVersion?: string;
  previewResolution?: {
    width: number;
    height: number;
  };
};

type TopologyPlate = Plate & {
  centerCell: number;
  centerX3: number;
  centerY3: number;
  centerZ3: number;
  age: number;
  density: number;
};

type CrustFields = {
  continental: Float32Array;
  thickness: Float32Array;
  shelf: Float32Array;
};

type PrimordialFields = {
  elevation: Float32Array;
  crustAge: Float32Array;
  crustThickness: Float32Array;
  basin: Float32Array;
  impact: Float32Array;
};

type TerrainPhases = {
  phaseA: number;
  phaseB: number;
  continentPhase: number;
};

type ContinentRegion = {
  x: number;
  y: number;
  z: number;
  scale: number;
  elongation: number;
  axisX: number;
  axisY: number;
  axisZ: number;
  influenceDot: number;
  lobes: Array<{
    x: number;
    y: number;
    z: number;
    radius: number;
    innerDot: number;
    outerDot: number;
    weight: number;
  }>;
};

type TopologyRiverPath = {
  path: number[];
  terminus: River['terminus'];
};

type HeapNode = {
  cell: number;
  priority: number;
};

function createDiagnosticsRecorder(): DiagnosticsRecorder {
  const startedAt = nowMs();
  const phases: GenerationDiagnostics['phases'] = [];
  let graph: GenerationDiagnostics['graph'];
  return {
    measure<T>(name: string, fn: () => T): T {
      const phaseStart = nowMs();
      try {
        return fn();
      } finally {
        phases.push({ name, ms: round(nowMs() - phaseStart, 3) });
      }
    },
    record(name: string, ms: number): void {
      phases.push({ name, ms: round(ms, 3) });
    },
    recordGraph(nextGraph: NonNullable<GenerationDiagnostics['graph']>): void {
      graph = nextGraph;
    },
    snapshot(): GenerationDiagnostics {
      return {
        totalMs: round(nowMs() - startedAt, 3),
        phases,
        graph
      };
    }
  };
}

export function generateProject(input: Partial<GenerationConfig> = {}, options: GenerateProjectOptions = {}): WorldProject {
  const diagnostics = createDiagnosticsRecorder();
  const config: GenerationConfig = {
    ...createDefaultConfig(input.seed ?? `seed-${Date.now()}`),
    ...input,
    parameterRanges: input.parameterRanges ?? defaultParameterRanges
  };
  const rng = new SeededRandom(config.seed);
  const selectedValues = diagnostics.measure('select-values', () => selectValues(config, rng));
  const solarSystem = diagnostics.measure('solar-system', () => generateSolarSystem(config.seed, selectedValues, rng));
  const primaryWorld = diagnostics.measure('primary-world', () => generatePrimaryWorld(config, selectedValues, solarSystem, rng, diagnostics, options));
  const metrics = diagnostics.measure('metrics', () => calculateMetrics(primaryWorld, selectedValues));
  const now = '2026-06-24T00:00:00.000Z';

  return {
    projectId: `project-${config.seed}`,
    projectName: primaryWorld.name,
    createdAt: now,
    updatedAt: now,
    appVersion: options.appVersion ?? '0.1.0',
    generatorVersion,
    seed: config.seed,
    config,
    selectedValues,
    solarSystem,
    primaryWorld,
    metrics,
    diagnostics: diagnostics.snapshot(),
    exports: {
      packageExtension: '.wforge',
      supportedFormats: ['png', 'svg', 'json', 'wforge']
    }
  };
}

function selectValues(config: GenerationConfig, rng: SeededRandom): SelectedValues {
  const ranges = config.parameterRanges;
  const selected = config.selectedValues ?? {};
  const pick = (key: keyof SelectedValues, fallback = 0) => {
    if (key in selected && selected[key] !== undefined) return selected[key] as number;
    const range = ranges[key as keyof typeof ranges];
    return range ? rng.range(range.min, range.max) : fallback;
  };

  return {
    systemAgeGy: round(pick('systemAgeGy'), 2),
    oceanPercentage: round(pick('oceanPercentage'), 1),
    averageTemperatureC: round(pick('averageTemperatureC'), 1),
    aridity: round(pick('aridity'), 2),
    seaLevel: round(pick('seaLevel'), 3),
    axialTiltDeg: round(pick('axialTiltDeg'), 1),
    orbitalEccentricity: round(pick('orbitalEccentricity'), 3),
    sizeClass: round(pick('sizeClass'), 2),
    moonCount: Math.max(0, Math.round(pick('moonCount'))),
    impactFrequency: round(pick('impactFrequency', 1), 2),
    plateCount: Math.max(1, Math.round(pick('plateCount', 20))),
    riverDensity: round(pick('riverDensity', 1.6), 2),
    continentCount: Math.max(1, Math.round(pick('continentCount', 5))),
    continentScale: round(pick('continentScale', 0.55), 2),
    islandDensity: round(pick('islandDensity', 0.4), 2),
    oceanTolerancePercentagePoints: round(pick('oceanTolerancePercentagePoints', 5), 1)
  };
}

function generateSolarSystem(seed: string, values: SelectedValues, rng: SeededRandom): SolarSystem {
  const starType = rng.pick(['G', 'K', 'F']);
  const star = {
    id: 'star-primary',
    type: `${starType}-type main sequence`,
    massClass: starType === 'F' ? 'slightly high' : starType === 'K' ? 'slightly low' : 'solar',
    luminosityClass: 'V',
    ageGy: values.systemAgeGy,
    colorTemperatureClass: starType === 'F' ? 'white-yellow' : starType === 'K' ? 'orange-yellow' : 'yellow'
  };
  const primaryOrder = rng.int(2, 4);
  const bodies: SystemBody[] = [];
  for (let i = 1; i <= rng.int(6, 9); i += 1) {
    const isPrimaryWorld = i === primaryOrder;
    const bodyType = i > 5 && rng.next() > 0.45 ? rng.pick(['gas-giant', 'ice-giant'] as const) : 'rocky';
    bodies.push({
      id: isPrimaryWorld ? 'primary-world' : `body-${i}`,
      bodyType,
      orbitalOrder: i,
      orbitalDistanceClass: round(i * rng.range(0.7, 1.35), 2),
      eccentricity: isPrimaryWorld ? values.orbitalEccentricity : round(rng.range(0.01, 0.18), 3),
      sizeClass: isPrimaryWorld ? values.sizeClass : round(rng.range(0.25, 8), 2),
      massClass: isPrimaryWorld ? round(values.sizeClass * rng.range(0.85, 1.2), 2) : round(rng.range(0.1, 12), 2),
      visibleFromPrimary: !isPrimaryWorld && Math.abs(i - primaryOrder) <= 2,
      isPrimaryWorld,
      moons: isPrimaryWorld ? generateMoons(values.moonCount, rng) : []
    });
  }

  return {
    star,
    ageGy: values.systemAgeGy,
    bodies,
    primaryWorldId: 'primary-world',
    visibleBodiesFromPrimary: bodies.filter((body) => body.visibleFromPrimary).map((body) => body.id),
    generatedNotes: [
      `Generated from seed ${seed}.`,
      'Moon tide/climate influence is simplified for MVP.'
    ]
  };
}

function generateMoons(count: number, rng: SeededRandom): Moon[] {
  return Array.from({ length: count }, (_, index) => {
    const sizeClass = round(rng.range(0.08, 0.65), 2);
    const orbitalDistanceClass = round(rng.range(0.4, 1.6), 2);
    return {
      id: `moon-${index + 1}`,
      name: `Moon ${index + 1}`,
      sizeClass,
      orbitalDistanceClass,
      tideInfluence: round(sizeClass / orbitalDistanceClass, 2)
    };
  });
}

function generatePrimaryWorld(
  config: GenerationConfig,
  values: SelectedValues,
  solarSystem: SolarSystem,
  rng: SeededRandom,
  diagnostics: DiagnosticsRecorder,
  options: GenerateProjectOptions
): PrimaryWorld {
  return orchestratePrimaryWorld(config, values, solarSystem, rng, diagnostics, options, {
    emitTopologyPreview,
    createTopologyPlates,
    assignTopologyPlateLayer,
    createTerrainPhases,
    generateCrustFields,
    findTopologySeaLevelForOceanTarget,
    applyTopologyTerrainAging,
    applyTopologyTerrainEnrichment,
    assignTopologyWater,
    assignTopologyVolcanism,
    generateTopologyClimate,
    generateTopologyClimateMoistureCandidate,
    assignTopologyIce,
    generateClimatePipelinePreview,
    generateTopologyHydrology,
    assignTopologyBiomes,
    projectTopologyToEquirectangular,
    projectTopologyFlowToEquirectangular,
    projectTopologyRiver
  });
}

/** Retained temporarily as a rollback and equivalence reference during graph cutover. */
function generatePrimaryWorldLegacy(
  config: GenerationConfig,
  values: SelectedValues,
  solarSystem: SolarSystem,
  rng: SeededRandom,
  diagnostics: DiagnosticsRecorder,
  options: GenerateProjectOptions
): PrimaryWorld {
  const { width, height } = config.outputResolution;
  const cellCount = width * height;
  const elevation = new Float32Array(cellCount);
  const water = new Uint8Array(cellCount);
  const platesLayer = new Uint16Array(cellCount);
  const temperature = new Float32Array(cellCount);
  const wetness = new Float32Array(cellCount);
  const climateMoisture = new Float32Array(cellCount);
  const climatePrecipitation = new Float32Array(cellCount);
  const climateWetnessDelta = new Float32Array(cellCount);
  const biomes = new Uint8Array(cellCount);
  const ice = new Uint8Array(cellCount);
  const river = new Float32Array(cellCount);
  const lakes = new Uint8Array(cellCount);
  const windX = new Float32Array(cellCount);
  const windY = new Float32Array(cellCount);
  const currentX = new Float32Array(cellCount);
  const currentY = new Float32Array(cellCount);
  const primaryBody = solarSystem.bodies.find((body) => body.isPrimaryWorld);
  const moons = primaryBody?.moons ?? [];
  const tideInfluence = round(clamp(moons.reduce((sum, moon) => sum + moon.tideInfluence, 0), 0, 2), 2);
  const foundation = runGenerationFoundation(config.seed, {
    topology: {
      outputResolution: config.outputResolution,
      topologyResolution: config.topologyResolution
    },
    values,
    rng
  });
  diagnostics.record('topology.build', foundation.timings.topologyMs);
  diagnostics.record('topology.terrain.primordial', foundation.timings.primordialMs);
  const topology = foundation.topology.topology;
  const topologyElevation = new Float32Array(topology.cellCount);
  const topologyPlates = new Uint16Array(topology.cellCount);
  const topologyWater = new Uint8Array(topology.cellCount);
  const topologyTemperature = new Float32Array(topology.cellCount);
  const topologyWetness = new Float32Array(topology.cellCount);
  const topologyClimateMoisture = new Float32Array(topology.cellCount);
  const topologyClimatePrecipitation = new Float32Array(topology.cellCount);
  const topologyClimateWetnessDelta = new Float32Array(topology.cellCount);
  const topologyBiomes = new Uint8Array(topology.cellCount);
  const topologyIce = new Uint8Array(topology.cellCount);
  const topologyRiver = new Float32Array(topology.cellCount);
  const topologyLakes = new Uint8Array(topology.cellCount);
  const topologyVolcanism = new Float32Array(topology.cellCount);
  const topologyWindX = new Float32Array(topology.cellCount);
  const topologyWindY = new Float32Array(topology.cellCount);
  const topologyCurrentX = new Float32Array(topology.cellCount);
  const topologyCurrentY = new Float32Array(topology.cellCount);
  const primordial = foundation.primordial;
  emitTopologyPreview(options, 'primordial', 'Primordial terrain', 0.08, topology, primordial.elevation);
  const topologyPlateData = diagnostics.measure('topology.plates.create', () => createTopologyPlates(topology, values.plateCount, rng, primordial));

  diagnostics.measure('topology.plates.assign', () => assignTopologyPlateLayer(topologyPlates, topology, topologyPlateData));
  emitTopologyPreview(options, 'plates', 'Plate layout', 0.18, topology, primordial.elevation, undefined, undefined, topologyPlates);
  const terrainPhases = diagnostics.measure('topology.terrain.phases', () => createTerrainPhases(rng));
  const topologyCrust = diagnostics.measure('topology.terrain.crust-fields', () => generateCrustFields(topology, values, terrainPhases.phaseA, terrainPhases.phaseB, terrainPhases.continentPhase));
  topologyElevation.set(foundation.elevation.elevation);
  emitTopologyPreview(options, 'elevation', 'Tectonic uplift', 0.38, topology, topologyElevation);
  let seaLevel = diagnostics.measure('topology.water.sea-level.pre-aging', () => findTopologySeaLevelForOceanTarget(topologyElevation, topology.areaWeights, values.oceanPercentage, values.seaLevel));
  diagnostics.measure('topology.terrain.aging', () => applyTopologyTerrainAging(topologyElevation, topology, values.systemAgeGy, values.impactFrequency, seaLevel, rng, diagnostics));
  emitTopologyPreview(options, 'aged', 'Aging terrain', 0.52, topology, topologyElevation);
  diagnostics.measure('topology.terrain.enrichment', () => applyTopologyTerrainEnrichment(topologyElevation, topology, values, rng));
  seaLevel = diagnostics.measure('topology.water.sea-level.final', () => findTopologySeaLevelForOceanTarget(topologyElevation, topology.areaWeights, values.oceanPercentage, values.seaLevel));
  diagnostics.measure('topology.water.mask', () => assignTopologyWater(topologyWater, topologyElevation, seaLevel));
  diagnostics.measure('topology.volcanism', () => assignTopologyVolcanism(topologyVolcanism, topologyElevation, topologyPlates, topologyPlateData, topology, seaLevel));
  emitTopologyPreview(options, 'water', 'Sea level and basins', 0.62, topology, topologyElevation, topologyWater, seaLevel);
  diagnostics.measure('topology.climate', () =>
    generateTopologyClimate(topologyTemperature, topologyWetness, topologyWindX, topologyWindY, topologyCurrentX, topologyCurrentY, topologyElevation, topologyWater, topology, values, tideInfluence)
  );
  diagnostics.measure('topology.climate.moisture-candidate', () =>
    generateTopologyClimateMoistureCandidate(
      topologyClimateMoisture,
      topologyClimatePrecipitation,
      topologyClimateWetnessDelta,
      topologyElevation,
      topologyWater,
      topologyTemperature,
      topologyWetness,
      topologyWindX,
      topologyWindY,
      topologyCurrentX,
      topologyCurrentY,
      topology,
      values,
      seaLevel
    )
  );
  emitTopologyPreview(options, 'climate', 'Climate and rainfall', 0.74, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness);
  diagnostics.measure('topology.glaciation', () => assignTopologyIce(topologyIce, topologyElevation, topologyTemperature, topologyWetness, topology, seaLevel));
  const climate = diagnostics.measure('topology.climate.pipeline.preview', () =>
    generateClimatePipelinePreview(
      config,
      values,
      topology,
      topologyElevation,
      topologyWater,
      topologyTemperature,
      topologyIce,
      topologyWetness,
      topologyWindX,
      topologyWindY,
      topologyCurrentX,
      topologyCurrentY,
      topologyClimateMoisture,
      topologyClimatePrecipitation,
      topologyClimateWetnessDelta,
      seaLevel
    )
  );
  const topologyRivers = diagnostics.measure('topology.hydrology', () => generateTopologyHydrology(topologyRiver, topologyLakes, topologyElevation, topologyWater, topologyClimateMoisture, topology, seaLevel, values.riverDensity));
  emitTopologyPreview(options, 'hydrology', 'Hydrology and rivers', 0.86, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness, topologyRiver);
  diagnostics.measure('topology.biomes', () => assignTopologyBiomes(topologyBiomes, topologyIce, topologyElevation, topologyWater, topologyTemperature, topologyClimateMoisture, topologyRiver, topologyLakes, topology, seaLevel, config.biomeRules));
  emitTopologyPreview(options, 'biomes', 'Biomes settling', 0.93, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness, topologyRiver, topologyBiomes, topologyIce);
  diagnostics.measure('projection.equirectangular', () =>
    projectTopologyToEquirectangular(
      elevation,
      platesLayer,
      water,
      temperature,
      wetness,
      climateMoisture,
      climatePrecipitation,
      climateWetnessDelta,
      biomes,
      ice,
      river,
      lakes,
      topologyElevation,
      topologyPlates,
      topologyWater,
      topologyTemperature,
      topologyWetness,
      topologyClimateMoisture,
      topologyClimatePrecipitation,
      topologyClimateWetnessDelta,
      topologyBiomes,
      topologyIce,
      topologyRiver,
      topologyLakes,
      topology,
      width,
      height
    )
  );
  diagnostics.measure('projection.flow', () => projectTopologyFlowToEquirectangular(windX, windY, currentX, currentY, topologyWindX, topologyWindY, topologyCurrentX, topologyCurrentY, topology, width, height));
  const rivers = topologyRivers.map((topologyRiverPath, index) => projectTopologyRiver(topologyRiverPath, topology, width, height, index));

  return {
    id: 'primary-world',
    name: `World ${config.seed}`,
    sizeClass: values.sizeClass,
    massClass: round(values.sizeClass * 1.05, 2),
    oceanPercentage: values.oceanPercentage,
    seaLevel,
    axialTiltDeg: values.axialTiltDeg,
    orbitalEccentricity: values.orbitalEccentricity,
    averageTemperatureC: values.averageTemperatureC,
    aridity: values.aridity,
    tideInfluence,
    mapModel: {
      resolution: config.outputResolution,
      projection: config.projection,
      wrapMode: config.wrapMode
    },
    topology: {
      kind: topology.kind,
      resolution: topology.resolution,
      cellCount: topology.cellCount
    },
    topologyLayers: {
      elevation: topologyElevation,
      plates: topologyPlates,
      water: topologyWater,
      temperature: topologyTemperature,
      wetness: topologyWetness,
      climateMoisture: topologyClimateMoisture,
      climatePrecipitation: topologyClimatePrecipitation,
      climateWetnessDelta: topologyClimateWetnessDelta,
      biomes: topologyBiomes,
      ice: topologyIce,
      river: topologyRiver,
      lakes: topologyLakes,
      volcanism: topologyVolcanism
    },
    climate,
    plates: topologyPlateData.map((plate) => ({
      id: plate.id,
      kind: plate.kind,
      centerX: plate.centerX,
      centerY: plate.centerY,
      motionX: plate.motionX,
      motionY: plate.motionY
    })),
    rivers,
    layers: { elevation, water, plates: platesLayer, temperature, wetness, climateMoisture, climatePrecipitation, climateWetnessDelta, biomes, ice, river, lakes, windX, windY, currentX, currentY }
  };
}

function generateClimatePipelinePreview(
  config: GenerationConfig,
  values: SelectedValues,
  topology: CubedSphereTopology,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  ice: Uint8Array,
  wetness: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  climateMoisture: Float32Array,
  climatePrecipitation: Float32Array,
  climateWetnessDelta: Float32Array,
  seaLevel: number
): ClimatePipelineOutput {
  const calendar = resolveClimateCalendar(config, values);
  const energyBudget = resolveEnergyBudget(config, values);
  const frameCount = Math.max(1, Math.round(calendar.seasonalFrameCount));
  const frameLabels = frameCount === 4 ? ['Vernal', 'High summer', 'Autumnal', 'Deep winter'] : Array.from({ length: frameCount }, (_, index) => `Season ${index + 1}`);
  const seasonalFrames = Array.from({ length: frameCount }, (_, seasonIndex) => {
    const seasonAngle = (seasonIndex / frameCount) * Math.PI * 2;
    const periapsisAngle = calendar.periapsisSeasonOffset * Math.PI * 2;
    const declination = Math.sin(seasonAngle) * degreesToRadians(calendar.axialTiltDeg);
    const orbitalFlux = Math.max(0.7, 1 + Math.cos(seasonAngle - periapsisAngle) * calendar.orbitalEccentricity * 2) * energyBudget.stellarFlux;
    let insolationSum = 0;
    let insolationMin = Number.POSITIVE_INFINITY;
    let insolationMax = 0;
    let landTemperatureSum = 0;
    let landTemperatureSqSum = 0;
    let landCount = 0;
    let oceanTemperatureSum = 0;
    let oceanTemperatureSqSum = 0;
    let oceanCount = 0;
    let iceCoolingSum = 0;

    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      const latitude = topology.latitudes[cell];
      const seasonalInsolation = clamp(Math.cos(latitude - declination) * orbitalFlux, 0.025, 1.35);
      const annualBaseline = clamp(Math.cos(latitude), 0.025, 1);
      const ocean = water[cell] === 1;
      const response = ocean ? 1 - energyBudget.oceanHeatStorage : energyBudget.landHeatResponse;
      const altitudeCooling = Math.max(0, elevation[cell] - seaLevel) * 5.5;
      const albedo = energyBudget.surfaceAlbedoBase + (ocean ? -0.04 : 0.02) + (ice[cell] ? 0.28 : 0);
      const iceCooling = ice[cell] ? energyBudget.iceAlbedoFeedback * seasonalInsolation * 7 : 0;
      const greenhouseOffset = (energyBudget.greenhouseHeatRetention - 0.52) * 18;
      const seasonalAnomaly = (seasonalInsolation - annualBaseline) * 30 * response;
      const cellTemperature = temperature[cell] + seasonalAnomaly + greenhouseOffset - altitudeCooling * 0.18 - iceCooling - albedo * 1.2;

      insolationSum += seasonalInsolation;
      insolationMin = Math.min(insolationMin, seasonalInsolation);
      insolationMax = Math.max(insolationMax, seasonalInsolation);
      if (ice[cell]) {
        iceCoolingSum += iceCooling;
      }
      if (ocean) {
        oceanTemperatureSum += cellTemperature;
        oceanTemperatureSqSum += cellTemperature * cellTemperature;
        oceanCount += 1;
      } else {
        landTemperatureSum += cellTemperature;
        landTemperatureSqSum += cellTemperature * cellTemperature;
        landCount += 1;
      }
    }

    const landMean = landTemperatureSum / Math.max(1, landCount);
    const oceanMean = oceanTemperatureSum / Math.max(1, oceanCount);
    return {
      seasonIndex,
      label: frameLabels[seasonIndex] ?? `Season ${seasonIndex + 1}`,
      insolationMean: round(insolationSum / Math.max(1, topology.cellCount), 4),
      insolationMin: round(insolationMin, 4),
      insolationMax: round(insolationMax, 4),
      landTemperatureMeanC: round(landMean, 2),
      oceanTemperatureMeanC: round(oceanMean, 2),
      landTemperatureStdDevC: round(Math.sqrt(Math.max(0, landTemperatureSqSum / Math.max(1, landCount) - landMean * landMean)), 2),
      oceanTemperatureStdDevC: round(Math.sqrt(Math.max(0, oceanTemperatureSqSum / Math.max(1, oceanCount) - oceanMean * oceanMean)), 2),
      iceAlbedoCoolingMeanC: round(iceCoolingSum / Math.max(1, topology.cellCount), 2)
    };
  });
  const landMeans = seasonalFrames.map((frame) => frame.landTemperatureMeanC);
  const oceanMeans = seasonalFrames.map((frame) => frame.oceanTemperatureMeanC);
  const combinedMeans = seasonalFrames.map((frame) => (frame.landTemperatureMeanC + frame.oceanTemperatureMeanC) / 2);
  const meanIceCooling = seasonalFrames.reduce((sum, frame) => sum + frame.iceAlbedoCoolingMeanC, 0) / Math.max(1, seasonalFrames.length);
  const circulation = generateClimateCirculationSummary(topology, elevation, water, temperature, wetness, windX, windY, currentX, currentY, seaLevel, values);
  const moisture = summarizeClimateMoistureCandidate(climateMoisture, climatePrecipitation, climateWetnessDelta, wetness, elevation, water, seaLevel);

  return {
    pipelineVersion: 'climate_pipeline_v1',
    fidelity: 'preview',
    metadata: {
      pipelineVersion: 'climate_pipeline_v1',
      stageId: 'seasonal-insolation-energy-preview',
      fidelity: 'preview',
      seed: config.seed
    },
    calendar,
    energyBudget,
    seasonalFrames,
    circulation,
    moisture,
    diagnostics: {
      seasonalTemperatureSwingC: round(rangeOf(combinedMeans), 2),
      landSeasonalSwingC: round(rangeOf(landMeans), 2),
      oceanSeasonalSwingC: round(rangeOf(oceanMeans), 2),
      axialTiltSeasonalityC: round(Math.sin(degreesToRadians(calendar.axialTiltDeg)) * 30, 2),
      meanIceAlbedoCoolingC: round(meanIceCooling, 2)
    },
    notes: [
      'Preview-only climate pipeline output; current rainfall, hydrology, and biome classification are not yet driven by these seasonal frames.',
      'Intermediate cell-level climate frames are regenerated and not persisted by default.'
    ]
  };
}

function summarizeClimateMoistureCandidate(
  climateMoisture: Float32Array,
  climatePrecipitation: Float32Array,
  climateWetnessDelta: Float32Array,
  existingWetness: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  seaLevel: number
): ClimateMoistureSummary {
  let landCount = 0;
  let candidateSum = 0;
  let existingSum = 0;
  let deltaSum = 0;
  let candidateSqSum = 0;
  let existingSqSum = 0;
  let crossSum = 0;
  let aridCount = 0;
  let wetCount = 0;
  let riverSourceCount = 0;
  let riverSourceSupport = 0;

  for (let cell = 0; cell < climateMoisture.length; cell += 1) {
    if (water[cell] === 1) continue;
    const candidate = clamp(climateMoisture[cell] ?? 0);
    const existing = clamp(existingWetness[cell] ?? 0);
    const delta = climateWetnessDelta[cell] ?? candidate - existing;
    landCount += 1;
    candidateSum += candidate;
    existingSum += existing;
    deltaSum += delta;
    candidateSqSum += candidate * candidate;
    existingSqSum += existing * existing;
    crossSum += candidate * existing;
    if (candidate < 0.24) aridCount += 1;
    if (candidate > 0.66) wetCount += 1;

    const sourceRelief = elevation[cell] - seaLevel;
    if (sourceRelief > 0.09) {
      const sourceWeight = clamp(sourceRelief / 0.42);
      riverSourceSupport += sourceWeight * clamp((climatePrecipitation[cell] ?? candidate) * 0.74 + candidate * 0.26);
      riverSourceCount += sourceWeight;
    }
  }

  const count = Math.max(1, landCount);
  const candidateVariance = candidateSqSum - (candidateSum * candidateSum) / count;
  const existingVariance = existingSqSum - (existingSum * existingSum) / count;
  const covariance = crossSum - (candidateSum * existingSum) / count;
  const denominator = Math.sqrt(Math.max(0, candidateVariance) * Math.max(0, existingVariance));

  return {
    meanCandidateWetness: round(candidateSum / count, 4),
    meanCurrentWetness: round(existingSum / count, 4),
    meanWetnessDelta: round(deltaSum / count, 4),
    wetnessCorrelation: round(denominator > 0 ? covariance / denominator : 0, 4),
    aridCellShare: round(aridCount / count, 4),
    wetCellShare: round(wetCount / count, 4),
    riverSourceSupportIndex: round(riverSourceSupport / Math.max(0.0001, riverSourceCount), 4)
  };
}

function resolveClimateCalendar(config: GenerationConfig, values: SelectedValues): PlanetaryCalendarConfig {
  return {
    yearLengthDays: config.climate?.calendar?.yearLengthDays ?? 365,
    seasonalFrameCount: config.climate?.calendar?.seasonalFrameCount ?? 4,
    axialTiltDeg: config.climate?.calendar?.axialTiltDeg ?? values.axialTiltDeg,
    orbitalEccentricity: config.climate?.calendar?.orbitalEccentricity ?? values.orbitalEccentricity,
    periapsisSeasonOffset: config.climate?.calendar?.periapsisSeasonOffset ?? 0.13
  };
}

function generateClimateCirculationSummary(
  topology: CubedSphereTopology,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  wetness: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  seaLevel: number,
  values: SelectedValues
): ClimateCirculationSummary {
  const bands = [
    { id: 'south-polar', label: 'South polar cell', min: -90, max: -60, pressureRole: 'high' as const },
    { id: 'south-ferrel', label: 'South Ferrel cell', min: -60, max: -30, pressureRole: 'transitional' as const },
    { id: 'south-hadley', label: 'South Hadley cell', min: -30, max: 0, pressureRole: 'low' as const },
    { id: 'north-hadley', label: 'North Hadley cell', min: 0, max: 30, pressureRole: 'low' as const },
    { id: 'north-ferrel', label: 'North Ferrel cell', min: 30, max: 60, pressureRole: 'transitional' as const },
    { id: 'north-polar', label: 'North polar cell', min: 60, max: 90, pressureRole: 'high' as const }
  ];
  const accumulators = bands.map(() => ({ pressure: 0, windX: 0, windY: 0, windSpeed: 0, count: 0 }));
  let itczWeight = 0;
  let itczLatSum = 0;
  let topographicDeflection = 0;
  let topographicDeflectionCount = 0;
  let orographicLift = 0;
  let orographicLiftCount = 0;
  let oceanCells = 0;
  let oceanSpeed = 0;
  let coastalDeflection = 0;
  let coastalDeflectionCount = 0;
  let northernGyre = 0;
  let northernGyreCount = 0;
  let southernGyre = 0;
  let southernGyreCount = 0;
  const landInfluence = computeTopologyLandInfluence(water, topology, 10);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const latitudeDeg = radiansToDegrees(topology.latitudes[cell]);
    const bandIndex = bands.findIndex((band) => latitudeDeg >= band.min && latitudeDeg < band.max);
    const thermalLow = clamp(0.5 + normalizeLocalTemperature(temperature[cell], values.averageTemperatureC) * 0.3 + wetness[cell] * 0.08 - Math.abs(latitudeDeg) / 220);
    const subtropicalHigh = Math.exp(-((Math.abs(latitudeDeg) - 30) ** 2) / 220) * 0.34;
    const polarHigh = Math.exp(-((Math.abs(latitudeDeg) - 78) ** 2) / 260) * 0.24;
    const pressureIndex = clamp(0.52 - thermalLow * 0.34 + subtropicalHigh + polarHigh);
    if (bandIndex >= 0) {
      const acc = accumulators[bandIndex];
      const speed = Math.hypot(windX[cell], windY[cell]);
      acc.pressure += pressureIndex;
      acc.windX += windX[cell];
      acc.windY += windY[cell];
      acc.windSpeed += speed;
      acc.count += 1;
    }
    const equatorialWeight = Math.max(0, 1 - Math.abs(latitudeDeg) / 28) * (1 - pressureIndex) * (0.6 + wetness[cell] * 0.4);
    itczWeight += equatorialWeight;
    itczLatSum += latitudeDeg * equatorialWeight;

    if (water[cell] === 0 && elevation[cell] > seaLevel + 0.08) {
      const ideal = idealZonalWind(topology.latitudes[cell]);
      const actualLength = Math.max(0.001, Math.hypot(windX[cell], windY[cell]));
      const idealLength = Math.max(0.001, Math.hypot(ideal.x, ideal.y));
      const alignment = clamp((windX[cell] / actualLength) * (ideal.x / idealLength) + (windY[cell] / actualLength) * (ideal.y / idealLength), -1, 1);
      topographicDeflection += 1 - Math.max(0, alignment);
      topographicDeflectionCount += 1;
      const oro = topologyOrographicEffect(elevation, topology, cell, windX[cell], windY[cell]);
      orographicLift += oro.lift;
      orographicLiftCount += 1;
    }

    if (water[cell] === 1) {
      const currentSpeed = Math.hypot(currentX[cell], currentY[cell]);
      oceanSpeed += currentSpeed;
      oceanCells += 1;
      if (landInfluence[cell] > 0.12 && currentSpeed > 0.001) {
        const coast = topologyCoastGradient(landInfluence, topology, cell);
        const coastLength = Math.max(0.001, Math.hypot(coast.x, coast.y));
        const crossCoast = Math.abs((currentX[cell] / currentSpeed) * (coast.x / coastLength) + (currentY[cell] / currentSpeed) * (coast.y / coastLength));
        coastalDeflection += 1 - crossCoast;
        coastalDeflectionCount += 1;
      }
      const rotational = Math.abs(currentX[cell] * Math.sin(topology.longitudes[cell]) - currentY[cell] * Math.cos(topology.longitudes[cell]));
      if (topology.latitudes[cell] >= 0) {
        northernGyre += rotational;
        northernGyreCount += 1;
      } else {
        southernGyre += rotational;
        southernGyreCount += 1;
      }
    }
  }

  return {
    itczLatitudeDeg: round(itczLatSum / Math.max(0.0001, itczWeight), 2),
    hadleyCellEdgeDeg: 30,
    ferrelCellEdgeDeg: 60,
    polarCellEdgeDeg: 75,
    windTopographicDeflectionIndex: round(topographicDeflection / Math.max(1, topographicDeflectionCount), 3),
    meanOrographicLiftIndex: round(orographicLift / Math.max(1, orographicLiftCount), 3),
    bands: bands.map((band, index) => {
      const acc = accumulators[index];
      return {
        id: band.id,
        label: band.label,
        latitudeMinDeg: band.min,
        latitudeMaxDeg: band.max,
        pressureRole: band.pressureRole,
        meanPressureIndex: round(acc.pressure / Math.max(1, acc.count), 3),
        meanWindX: round(acc.windX / Math.max(1, acc.count), 3),
        meanWindY: round(acc.windY / Math.max(1, acc.count), 3),
        meanWindSpeed: round(acc.windSpeed / Math.max(1, acc.count), 3)
      };
    }),
    oceanCurrents: {
      meanCurrentSpeed: round(oceanSpeed / Math.max(1, oceanCells), 3),
      coastalDeflectionIndex: round(coastalDeflection / Math.max(1, coastalDeflectionCount), 3),
      northernGyreSignal: round(northernGyre / Math.max(1, northernGyreCount), 3),
      southernGyreSignal: round(southernGyre / Math.max(1, southernGyreCount), 3),
      oceanCellShare: round(oceanCells / Math.max(1, topology.cellCount), 3)
    }
  };
}

function idealZonalWind(latitude: number): { x: number; y: number } {
  const lat01 = latitude / (Math.PI / 2);
  const absLat = Math.abs(lat01);
  const hemisphere = latitude < 0 ? -1 : 1;
  const cellBand = absLat < 0.33 ? 0 : absLat < 0.66 ? 1 : 2;
  const zonalDirection = cellBand === 1 ? -hemisphere : hemisphere;
  const pressureGradient = cellBand === 0 ? -lat01 : cellBand === 1 ? hemisphere * 0.42 : -hemisphere * 0.28;
  return { x: zonalDirection, y: pressureGradient * 0.35 };
}

function resolveEnergyBudget(config: GenerationConfig, values: SelectedValues): EnergyBudgetConfig {
  return {
    stellarFlux: config.climate?.energyBudget?.stellarFlux ?? 1,
    greenhouseHeatRetention: config.climate?.energyBudget?.greenhouseHeatRetention ?? round(clamp(0.52 + (values.averageTemperatureC - 14) / 90, 0.34, 0.74), 3),
    surfaceAlbedoBase: config.climate?.energyBudget?.surfaceAlbedoBase ?? 0.31,
    oceanHeatStorage: config.climate?.energyBudget?.oceanHeatStorage ?? 0.78,
    landHeatResponse: config.climate?.energyBudget?.landHeatResponse ?? 1,
    iceAlbedoFeedback: config.climate?.energyBudget?.iceAlbedoFeedback ?? 0.65
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function rangeOf(values: number[]): number {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}

function createPlates(width: number, height: number, requestedPlateCount: number, rng: SeededRandom): Plate[] {
  const plateCount = Math.max(4, Math.min(72, Math.round(requestedPlateCount)));
  return Array.from({ length: plateCount }, (_, id) => {
    const angle = rng.range(0, Math.PI * 2);
    return {
      id,
      kind: rng.next() > 0.42 ? 'continental' : 'oceanic',
      centerX: rng.int(0, width - 1),
      centerY: rng.int(0, height - 1),
      motionX: Math.cos(angle),
      motionY: Math.sin(angle)
    };
  });
}

function createTopologyPlates(topology: CubedSphereTopology, requestedPlateCount: number, rng: SeededRandom, primordial: PrimordialFields): TopologyPlate[] {
  const plateCount = Math.max(4, Math.min(72, Math.round(requestedPlateCount)));
  const centerCells = choosePlateCenters(topology, plateCount, rng);
  return centerCells.map((centerCell, id) => {
    const centerX3 = topology.positions[centerCell * 3];
    const centerY3 = topology.positions[centerCell * 3 + 1];
    const centerZ3 = topology.positions[centerCell * 3 + 2];
    const longitude = topology.longitudes[centerCell];
    const latitude = topology.latitudes[centerCell];
    const spin = rng.range(-0.45, 0.45);
    const driftX = -centerZ3 + centerY3 * spin;
    const driftZ = centerX3 - centerY3 * spin;
    const motionLength = Math.max(0.000001, Math.sqrt(driftX * driftX + driftZ * driftZ));
    const crustSignal = primordial.crustThickness[centerCell] + primordial.elevation[centerCell] * 0.45 - primordial.basin[centerCell] * 0.35;
    const age = clamp(primordial.crustAge[centerCell] + rng.range(-0.12, 0.12));
    const kind = crustSignal > 0.48 || (crustSignal > 0.38 && rng.next() > 0.35) ? 'continental' : 'oceanic';
    return {
      id,
      kind,
      centerX: round(((longitude + Math.PI) / (Math.PI * 2)) * 100, 2),
      centerY: round((0.5 - latitude / Math.PI) * 100, 2),
      motionX: driftX / motionLength,
      motionY: driftZ / motionLength,
      centerCell,
      centerX3,
      centerY3,
      centerZ3,
      age,
      density: kind === 'continental' ? lerp(0.35, 0.68, primordial.crustThickness[centerCell]) : lerp(0.7, 1, 1 - age)
    };
  });
}

function choosePlateCenters(topology: CubedSphereTopology, count: number, rng: SeededRandom): number[] {
  const candidateCount = Math.max(count * 16, 96);
  const candidates = Array.from({ length: candidateCount }, () => rng.int(0, topology.cellCount - 1));
  const selected = [candidates[0]];
  while (selected.length < count) {
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const cx = topology.positions[candidate * 3];
      const cy = topology.positions[candidate * 3 + 1];
      const cz = topology.positions[candidate * 3 + 2];
      let nearest = Number.POSITIVE_INFINITY;
      for (const center of selected) {
        const dot = cx * topology.positions[center * 3] + cy * topology.positions[center * 3 + 1] + cz * topology.positions[center * 3 + 2];
        nearest = Math.min(nearest, 1 - dot);
      }
      const jitter = rng.range(-0.018, 0.018);
      if (nearest + jitter > bestScore) {
        best = candidate;
        bestScore = nearest + jitter;
      }
    }
    selected.push(best);
  }
  return selected;
}

function assignTopologyPlateLayer(layer: Uint16Array, topology: CubedSphereTopology, plates: TopologyPlate[]): void {
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    let best = plates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const plate of plates) {
      const ridgeWarp =
        sphericalNoise(x * 2.6 + plate.id * 0.17, y * 2.6 - plate.id * 0.11, z * 2.6) * 0.08 +
        sphericalNoise(x * 7.2 - plate.id * 0.13, y * 7.2, z * 7.2 + plate.id * 0.19) * 0.035;
      const score = x * plate.centerX3 + y * plate.centerY3 + z * plate.centerZ3 + ridgeWarp;
      if (score > bestScore) {
        best = plate;
        bestScore = score;
      }
    }
    layer[cell] = best.id;
  }
}

function createTerrainPhases(rng: SeededRandom): TerrainPhases {
  return {
    phaseA: rng.range(0, 1000),
    phaseB: rng.range(0, 1000),
    continentPhase: rng.range(0, 1000)
  };
}

function generatePrimordialFields(topology: CubedSphereTopology, values: SelectedValues, rng: SeededRandom): PrimordialFields {
  const elevation = new Float32Array(topology.cellCount);
  const crustAge = new Float32Array(topology.cellCount);
  const crustThickness = new Float32Array(topology.cellCount);
  const basin = new Float32Array(topology.cellCount);
  const impact = new Float32Array(topology.cellCount);
  const phaseA = rng.range(0, 1000);
  const phaseB = rng.range(0, 1000);
  const phaseC = rng.range(0, 1000);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const accretion =
      coherentSphericalNoise(x * 0.85 + phaseA, y * 0.85 - phaseC, z * 0.85 + phaseB) * 0.2 +
      coherentSphericalNoise(x * 1.65 - phaseB, y * 1.65 + phaseA, z * 1.65 - phaseC) * 0.13 +
      coherentSphericalNoise(x * 3.2 + phaseC, y * 3.2 + phaseB, z * 3.2 - phaseA) * 0.055;
    const basinSignal = smoothStep(0.18, 0.72, coherentSphericalNoise(x * 1.25 - phaseA, y * 1.25 + phaseC, z * 1.25 - phaseB));
    const ageSignal = clamp(
      0.5 +
        coherentSphericalNoise(x * 1.05 + phaseC, y * 1.05 + phaseA, z * 1.05 - phaseB) * 0.36 +
        coherentSphericalNoise(x * 2.7 - phaseB, y * 2.7 + phaseC, z * 2.7 + phaseA) * 0.14
    );
    basin[cell] = basinSignal;
    crustAge[cell] = ageSignal;
    crustThickness[cell] = clamp(0.44 + accretion * 0.95 + ageSignal * 0.22 - basinSignal * 0.34);
    elevation[cell] = accretion + crustThickness[cell] * 0.18 - basinSignal * 0.23;
  }

  const impactCount = Math.max(6, Math.round(topology.cellCount / 9000 * values.impactFrequency * lerp(0.8, 1.45, clamp(values.systemAgeGy / 10))));
  for (let i = 0; i < impactCount; i += 1) {
    const center = rng.int(0, topology.cellCount - 1);
    const radius = rng.range(0.025, 0.095);
    const strength = rng.range(0.035, 0.12);
    const cx = topology.positions[center * 3];
    const cy = topology.positions[center * 3 + 1];
    const cz = topology.positions[center * 3 + 2];
    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      const dot = cx * topology.positions[cell * 3] + cy * topology.positions[cell * 3 + 1] + cz * topology.positions[cell * 3 + 2];
      const clampedDot = clamp(dot, -1, 1);
      if (clampedDot < Math.cos(radius * 1.42 * Math.PI)) continue;
      const distance = Math.acos(clampedDot) / Math.PI;
      const t = distance / radius;
      const bowl = t <= 1 ? (1 - t) ** 2 : 0;
      const rim = Math.max(0, 1 - Math.abs(t - 0.95) / 0.24);
      const signal = rim * strength * 0.32 - bowl * strength;
      elevation[cell] += signal;
      impact[cell] = Math.max(impact[cell], Math.abs(signal));
      crustThickness[cell] = clamp(crustThickness[cell] - bowl * strength * 0.7 + rim * strength * 0.18);
    }
  }

  smoothTopologyLayer(elevation, topology, 2, 0.2);
  smoothTopologyLayer(crustThickness, topology, 2, 0.18);
  smoothTopologyLayer(basin, topology, 2, 0.22);
  return { elevation, crustAge, crustThickness, basin, impact };
}

function generateCrustFields(topology: CubedSphereTopology, values: SelectedValues, phaseA: number, phaseB: number, phaseC: number): CrustFields {
  const continental = new Float32Array(topology.cellCount);
  const thickness = new Float32Array(topology.cellCount);
  const shelf = new Float32Array(topology.cellCount);
  const continentCount = Math.max(1, Math.round(values.continentCount));
  const countFootprint = clamp(Math.sqrt(5 / continentCount), 0.58, 1.75);
  const continentRadius = lerp(0.105, 0.205, values.continentScale) * countFootprint;
  const continentRegions = chooseContinentRegions(continentCount, continentRadius, phaseA, phaseB, phaseC);
  const islandFrequency = lerp(4.8, 14, values.islandDensity);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    let primary = 0;
    for (const region of continentRegions) {
      const centerDot = x * region.x + y * region.y + z * region.z;
      if (centerDot < region.influenceDot) continue;
      let regionValue = 0;
      for (const lobe of region.lobes) {
        const dot = clamp(x * lobe.x + y * lobe.y + z * lobe.z, -1, 1);
        const axial = Math.abs(x * region.axisX + y * region.axisY + z * region.axisZ);
        const edgeWarp =
          coherentSphericalNoise(x * 3.2 + lobe.x * 9, y * 3.2 + lobe.y * 9, z * 3.2 + lobe.z * 9) * 0.04 +
          coherentSphericalNoise(x * 7.4 - lobe.z * 5, y * 7.4 + lobe.x * 5, z * 7.4 - lobe.y * 5) * 0.018;
        const adjustedInnerDot = lobe.innerDot - edgeWarp * 2.65;
        const adjustedOuterDot = lobe.outerDot - edgeWarp * 2.65 - axial * region.elongation * 0.12;
        regionValue = Math.max(regionValue, smoothStep(adjustedOuterDot, adjustedInnerDot, dot) * lobe.weight);
      }
      primary = Math.max(primary, regionValue);
    }
    primary += coherentSphericalNoise(x * 2.3 + phaseA, y * 2.3 - phaseC, z * 2.3 + phaseB) * 0.12;
    const island =
      Math.max(0, coherentSphericalNoise(x * islandFrequency + phaseC, y * islandFrequency + phaseA, z * islandFrequency - phaseB) - 0.42) *
      lerp(0.12, 0.42, values.islandDensity);
    const rift =
      Math.max(0, coherentSphericalNoise(x * 2.05 - phaseA, y * 2.05 + phaseC, z * 2.05 - phaseB) - 0.22) *
      lerp(0.38, 0.16, values.continentScale);
    const basin =
      Math.max(0, coherentSphericalNoise(x * 1.45 + phaseB, y * 1.45 - phaseA, z * 1.45 + phaseC) - 0.18) *
      lerp(0.28, 0.11, values.continentScale);
    const shearRift =
      Math.max(0, Math.abs(coherentSphericalNoise(x * 4.6 - phaseC, y * 4.6 + phaseB, z * 4.6 - phaseA)) - 0.54) *
      lerp(0.34, 0.12, values.continentScale);
    const edgeThresholdWarp = coherentSphericalNoise(x * 9.5 + phaseA, y * 9.5 - phaseB, z * 9.5 + phaseC) * 0.05;
    const continent = clamp(smoothStep(0.4 + edgeThresholdWarp, 0.76 + edgeThresholdWarp * 0.5, primary - rift - basin - shearRift) + island);
    continental[cell] = continent;
    shelf[cell] = smoothStep(-0.28, 0.18, primary);
    thickness[cell] = clamp(
      continent *
        (0.42 +
          coherentSphericalNoise(x * 1.1 - phaseC, y * 1.1 + phaseB, z * 1.1 + phaseA) * 0.24 +
          coherentSphericalNoise(x * 2.6 + phaseA, y * 2.6, z * 2.6 - phaseB) * 0.12)
    );
  }

  smoothTopologyLayer(continental, topology, 3, 0.28);
  smoothTopologyLayer(thickness, topology, 3, 0.26);
  smoothTopologyLayer(shelf, topology, 3, 0.28);
  return { continental, thickness, shelf };
}

function chooseContinentRegions(count: number, baseRadius: number, phaseA: number, phaseB: number, phaseC: number): ContinentRegion[] {
  const candidates = Array.from({ length: Math.max(24, count * 10) }, (_, index) => continentCenterVector(index, phaseA, phaseB, phaseC));
  const selected = [candidates[0]];
  while (selected.length < count) {
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const nearest = selected.reduce((min, center) => Math.min(min, 1 - (candidate.x * center.x + candidate.y * center.y + candidate.z * center.z)), Number.POSITIVE_INFINITY);
      if (nearest > bestScore) {
        best = candidate;
        bestScore = nearest;
      }
    }
    selected.push(best);
  }
  return selected.map((center, index) => {
    const axisSeed = continentCenterVector(index + 101, phaseC, phaseA, phaseB);
    const lobeCount = 2 + Math.abs(Math.round(latticeNoise3(index * 5.3, phaseA * 0.031, phaseB * 0.029) * 2));
    const lobes = Array.from({ length: lobeCount }, (_, lobeIndex) => {
      if (lobeIndex === 0) {
        const radius = baseRadius * center.scale;
        return { x: center.x, y: center.y, z: center.z, radius, innerDot: Math.cos(radius * Math.PI), outerDot: Math.cos((radius + 0.075) * Math.PI), weight: 1 };
      }
      const offset = continentCenterVector(index * 17 + lobeIndex * 3, phaseA + lobeIndex * 11, phaseB - lobeIndex * 7, phaseC + lobeIndex * 5);
      const mixed = normalize3(
        center.x * 0.82 + offset.x * 0.36,
        center.y * 0.82 + offset.y * 0.36,
        center.z * 0.82 + offset.z * 0.36
      );
      const radius = baseRadius * center.scale * lerp(0.55, 0.9, (latticeNoise3(index, lobeIndex, phaseC * 0.01) + 1) / 2);
      return {
        ...mixed,
        radius,
        innerDot: Math.cos(radius * Math.PI),
        outerDot: Math.cos((radius + 0.075) * Math.PI),
        weight: lerp(0.62, 0.92, (latticeNoise3(index * 2, lobeIndex * 3, phaseB * 0.01) + 1) / 2)
      };
    });
    const maxRadius = lobes.reduce((max, lobe) => Math.max(max, lobe.radius), 0);
    return {
      ...center,
      elongation: lerp(0.15, 0.75, (latticeNoise3(index * 4.1, phaseB * 0.021, phaseC * 0.017) + 1) / 2),
      axisX: axisSeed.x,
      axisY: axisSeed.y,
      axisZ: axisSeed.z,
      influenceDot: Math.cos(Math.min(0.48, maxRadius * 1.95 + 0.18) * Math.PI),
      lobes
    };
  });
}

function continentCenterVector(index: number, phaseA: number, phaseB: number, phaseC: number): { x: number; y: number; z: number; scale: number } {
  const a = index + 1;
  const longitude = latticeNoise3(a * 1.7, phaseA * 0.013, phaseB * 0.017) * Math.PI;
  const latitude = Math.asin(clamp(latticeNoise3(a * 2.3, phaseB * 0.019, phaseC * 0.011) * 0.78, -0.9, 0.9));
  const cosLat = Math.cos(latitude);
  return {
    x: cosLat * Math.cos(longitude),
    y: Math.sin(latitude),
    z: cosLat * Math.sin(longitude),
    scale: lerp(0.75, 1.25, (latticeNoise3(a * 3.1, phaseC * 0.017, phaseA * 0.023) + 1) / 2)
  };
}

function normalize3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.max(0.000001, Math.sqrt(x * x + y * y + z * z));
  return { x: x / length, y: y / length, z: z / length };
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function topologyPlateBoundaryEffect(a: TopologyPlate, b: TopologyPlate, topology: CubedSphereTopology, cell: number, neighbor: number): number {
  const lonA = topology.longitudes[cell];
  const latA = topology.latitudes[cell];
  const lonB = topology.longitudes[neighbor];
  const latB = topology.latitudes[neighbor];
  const boundaryX = wrappedAngle(lonB - lonA);
  const boundaryY = latB - latA;
  const length = Math.max(0.000001, Math.sqrt(boundaryX * boundaryX + boundaryY * boundaryY));
  const nx = boundaryX / length;
  const ny = boundaryY / length;
  const relativeX = b.motionX - a.motionX;
  const relativeY = b.motionY - a.motionY;
  const convergence = relativeX * nx + relativeY * ny;
  const shear = Math.abs(relativeX * -ny + relativeY * nx);

  if (convergence > 0.18) {
    if (a.kind === 'continental' && b.kind === 'continental') return 0.08 + convergence * 0.08;
    if (a.kind !== b.kind) return 0.045 + convergence * 0.07;
    return 0.018 + convergence * 0.03;
  }
  if (convergence < -0.16) return -0.035 + convergence * 0.055;
  return shear > 0.45 ? 0.012 - shear * 0.018 : -0.012;
}

function smoothTopologyLayer(layer: Float32Array, topology: CubedSphereTopology, passes: number, blend: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(layer);
    for (let cell = 0; cell < layer.length; cell += 1) {
      let total = layer[cell];
      let count = 1;
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor < 0) continue;
        total += layer[neighbor];
        count += 1;
      }
      next[cell] = lerp(layer[cell], total / count, blend);
    }
    layer.set(next);
  }
}

function lowestTopologyNeighbor(elevation: Float32Array, topology: CubedSphereTopology, cell: number, water?: Uint8Array): number {
  let best = cell;
  let bestValue = elevation[cell];
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0) continue;
    const value = water?.[neighbor] === 1 ? elevation[neighbor] - 0.08 : elevation[neighbor];
    if (value < bestValue) {
      best = neighbor;
      bestValue = value;
    }
  }
  return best;
}

function projectTopologyRiver(river: TopologyRiverPath, topology: CubedSphereTopology, width: number, height: number, index: number): River {
  const projectedPath = simplifyProjectedRiverPath(river.path.map((cell) => {
    const longitude = topology.longitudes[cell];
    const latitude = topology.latitudes[cell];
    const x = wrapX(Math.round(((longitude + Math.PI) / (Math.PI * 2)) * width), width);
    const y = Math.max(0, Math.min(height - 1, Math.round((0.5 - latitude / Math.PI) * height)));
    return layerIndex(x, y, width);
  }));
  return {
    id: `river-${index + 1}`,
    sourceIndex: projectedPath[0],
    mouthIndex: projectedPath[projectedPath.length - 1],
    path: projectedPath,
    topologyPath: river.path,
    terminus: river.terminus
  };
}

function simplifyProjectedRiverPath(path: number[]): number[] {
  const result: number[] = [];
  for (const index of path) if (result[result.length - 1] !== index) result.push(index);
  return result;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)))];
}

function floatLayerPercentile(values: Float32Array, p: number): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return values[0] ?? 0;
  return histogramPercentile(values, p, min, max, false);
}

function positiveFloatLayerPercentile(values: Float32Array, p: number): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const value of values) {
    if (value <= 0) continue;
    if (value < min) min = value;
    if (value > max) max = value;
    count += 1;
  }
  if (count === 0) return Number.POSITIVE_INFINITY;
  if (min === max) return min;
  return histogramPercentile(values, p, min, max, true);
}

function histogramPercentile(values: Float32Array, p: number, min: number, max: number, positiveOnly: boolean): number {
  const bins = 4096;
  const counts = new Uint32Array(bins);
  const scale = (bins - 1) / (max - min);
  let total = 0;
  for (const value of values) {
    if (positiveOnly && value <= 0) continue;
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((value - min) * scale)));
    counts[bin] += 1;
    total += 1;
  }
  const target = Math.max(0, Math.min(total - 1, Math.floor(total * p)));
  let running = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    running += counts[bin];
    if (running > target) return min + (bin / (bins - 1)) * (max - min);
  }
  return max;
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function emitTopologyPreview(
  options: GenerateProjectOptions,
  stage: GenerationPreviewStage,
  label: string,
  progress: number,
  topology: CubedSphereTopology,
  elevation: Float32Array,
  water?: Uint8Array,
  seaLevel?: number,
  plates?: Uint16Array,
  wetness?: Float32Array,
  river?: Float32Array,
  biomes?: Uint8Array,
  ice?: Uint8Array
): void {
  if (!options.onProgress) return;
  const width = Math.max(64, Math.min(1024, Math.round(options.previewResolution?.width ?? 512)));
  const height = Math.max(32, Math.min(512, Math.round(options.previewResolution?.height ?? 256)));
  options.onProgress({
    stage,
    label,
    progress,
    width,
    height,
    rgba: renderTopologyPreview(topology, width, height, stage, elevation, water, seaLevel, plates, wetness, river, biomes, ice)
  });
}

function renderTopologyPreview(
  topology: CubedSphereTopology,
  width: number,
  height: number,
  stage: GenerationPreviewStage,
  elevation: Float32Array,
  water?: Uint8Array,
  seaLevel?: number,
  plates?: Uint16Array,
  wetness?: Float32Array,
  river?: Float32Array,
  biomes?: Uint8Array,
  ice?: Uint8Array
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [lowElevation, highElevation] = previewPercentileRange(elevation, 0.02, 0.98);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / Math.max(1, height)) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / Math.max(1, width)) * Math.PI * 2 - Math.PI;
      const cell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const color = previewColorForCell(stage, cell, elevation, lowElevation, highElevation, water, seaLevel, plates, wetness, river, biomes, ice);
      const offset = (y * width + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function previewPercentileRange(values: Float32Array, lowPercentile: number, highPercentile: number): [number, number] {
  const sampled: number[] = [];
  const stride = Math.max(1, Math.floor(values.length / 8192));
  for (let index = 0; index < values.length; index += stride) sampled.push(values[index]);
  const low = percentile(sampled, lowPercentile);
  const high = percentile(sampled, highPercentile);
  return low === high ? [Math.min(...sampled), Math.max(...sampled)] : [low, high];
}

function previewColorForCell(
  stage: GenerationPreviewStage,
  cell: number,
  elevation: Float32Array,
  lowElevation: number,
  highElevation: number,
  water?: Uint8Array,
  seaLevel?: number,
  plates?: Uint16Array,
  wetness?: Float32Array,
  river?: Float32Array,
  biomes?: Uint8Array,
  ice?: Uint8Array
): [number, number, number] {
  const height01 = normalizeValue(elevation[cell], lowElevation, highElevation);
  const isWater = water?.[cell] === 1;
  if (biomes) {
    const biome = codeToBiome(biomes[cell]);
    let color: [number, number, number] = [134, 169, 92];
    if (isWater) {
      const depth = seaLevel === undefined ? 0.5 : clamp((seaLevel - elevation[cell]) / 0.42);
      color = mixRgb([64, 150, 173], [24, 74, 112], depth);
    } else if (ice?.[cell]) color = [238, 246, 247];
    else if (biome === 'desert') color = [212, 190, 113];
    else if (biome === 'forest') color = [67, 130, 76];
    else if (biome === 'rainforest') color = [38, 103, 70];
    else if (biome === 'tundra') color = [182, 199, 173];
    else if (biome === 'wetland') color = [91, 143, 118];
    else if (biome === 'mountain') color = [130, 124, 113];
    if (river && river[cell] > 0.14 && !isWater) color = mixRgb(color, [208, 244, 249], clamp(river[cell] * 0.9));
    return color;
  }
  if (water) {
    if (isWater) {
      const depth = seaLevel === undefined ? 0.5 : clamp((seaLevel - elevation[cell]) / 0.42);
      return mixRgb([71, 160, 182], [23, 71, 111], depth);
    }
    if (river && river[cell] > 0.12) return mixRgb(previewLandColor(height01, wetness?.[cell]), [208, 244, 249], clamp(river[cell] * 0.85));
    return previewLandColor(height01, wetness?.[cell]);
  }
  if (plates) {
    const plateTint = platePreviewTint(plates[cell]);
    return mixRgb(previewLandColor(height01), plateTint, 0.34);
  }
  return previewLandColor(height01, wetness?.[cell], stage === 'primordial');
}

function previewLandColor(height01: number, wetness = 0.42, primordial = false): [number, number, number] {
  if (primordial) return mixRgb([40, 70, 96], [214, 209, 176], height01);
  let color: [number, number, number];
  if (height01 < 0.34) color = mixRgb([68, 107, 83], [135, 162, 94], height01 / 0.34);
  else if (height01 < 0.72) color = mixRgb([135, 162, 94], [165, 145, 116], (height01 - 0.34) / 0.38);
  else color = mixRgb([165, 145, 116], [242, 241, 232], (height01 - 0.72) / 0.28);
  if (wetness > 0) color = mixRgb(color, [47, 125, 82], clamp((wetness - 0.42) * 0.55));
  return color;
}

function platePreviewTint(plate: number): [number, number, number] {
  const hue = (Math.imul(plate + 37, 1103515245) >>> 0) / 4294967295;
  const r = Math.round(116 + Math.sin(hue * Math.PI * 2) * 34);
  const g = Math.round(126 + Math.sin((hue + 0.33) * Math.PI * 2) * 32);
  const b = Math.round(121 + Math.sin((hue + 0.66) * Math.PI * 2) * 30);
  return [r, g, b];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const amount = clamp(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ];
}

function projectTopologyToEquirectangular(
  elevation: Float32Array,
  plates: Uint16Array,
  water: Uint8Array,
  temperature: Float32Array,
  wetness: Float32Array,
  climateMoisture: Float32Array,
  climatePrecipitation: Float32Array,
  climateWetnessDelta: Float32Array,
  biomes: Uint8Array,
  ice: Uint8Array,
  river: Float32Array,
  lakes: Uint8Array,
  topologyElevation: Float32Array,
  topologyPlates: Uint16Array,
  topologyWater: Uint8Array,
  topologyTemperature: Float32Array,
  topologyWetness: Float32Array,
  topologyClimateMoisture: Float32Array,
  topologyClimatePrecipitation: Float32Array,
  topologyClimateWetnessDelta: Float32Array,
  topologyBiomes: Uint8Array,
  topologyIce: Uint8Array,
  topologyRiver: Float32Array,
  topologyLakes: Uint8Array,
  topology: CubedSphereTopology,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / Math.max(1, height)) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / Math.max(1, width)) * Math.PI * 2 - Math.PI;
      const topologyCell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const index = layerIndex(x, y, width);
      elevation[index] = topologyElevation[topologyCell];
      plates[index] = topologyPlates[topologyCell];
      water[index] = topologyWater[topologyCell];
      temperature[index] = topologyTemperature[topologyCell];
      wetness[index] = topologyWetness[topologyCell];
      climateMoisture[index] = topologyClimateMoisture[topologyCell];
      climatePrecipitation[index] = topologyClimatePrecipitation[topologyCell];
      climateWetnessDelta[index] = topologyClimateWetnessDelta[topologyCell];
      biomes[index] = topologyBiomes[topologyCell];
      ice[index] = topologyIce[topologyCell];
      river[index] = topologyRiver[topologyCell];
      lakes[index] = topologyLakes[topologyCell];
    }
  }
}

function projectTopologyFlowToEquirectangular(
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  topologyWindX: Float32Array,
  topologyWindY: Float32Array,
  topologyCurrentX: Float32Array,
  topologyCurrentY: Float32Array,
  topology: CubedSphereTopology,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / Math.max(1, height)) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / Math.max(1, width)) * Math.PI * 2 - Math.PI;
      const topologyCell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const index = layerIndex(x, y, width);
      windX[index] = topologyWindX[topologyCell];
      windY[index] = topologyWindY[topologyCell];
      currentX[index] = topologyCurrentX[topologyCell];
      currentY[index] = topologyCurrentY[topologyCell];
    }
  }
}

function findTopologySeaLevelForOceanTarget(elevation: Float32Array, _areaWeights: Float32Array, oceanTarget: number, adjustment: number): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < elevation.length; index += 1) {
    const value = elevation[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return (elevation[0] ?? 0) + adjustment * 0.01;
  const bins = 4096;
  const counts = new Uint32Array(bins);
  const scale = (bins - 1) / (max - min);
  for (let index = 0; index < elevation.length; index += 1) {
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((elevation[index] - min) * scale)));
    counts[bin] += 1;
  }
  const targetCount = elevation.length * (oceanTarget / 100);
  let running = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    running += counts[bin];
    if (running >= targetCount) return min + (bin / (bins - 1)) * (max - min) + adjustment * 0.01;
  }
  return max + adjustment * 0.01;
}

function assignTopologyWater(water: Uint8Array, elevation: Float32Array, seaLevel: number): void {
  for (let cell = 0; cell < water.length; cell += 1) water[cell] = elevation[cell] <= seaLevel ? 1 : 0;
}

function applyTopologyTerrainAging(
  elevation: Float32Array,
  topology: CubedSphereTopology,
  ageGy: number,
  impactFrequency: number,
  seaLevel: number,
  rng: SeededRandom,
  diagnostics: DiagnosticsRecorder
): void {
  const age01 = clamp(ageGy / 10);
  diagnostics.measure('topology.terrain.aging.impacts', () => applyTopologyImpacts(elevation, topology, age01, impactFrequency, seaLevel, rng));
  diagnostics.measure('topology.terrain.aging.weathering', () => applyTopologyThermalWeathering(elevation, topology, age01));
  diagnostics.measure('topology.terrain.aging.hydraulic', () => applyTopologyHydraulicErosion(elevation, topology, age01));
  diagnostics.measure('topology.terrain.aging.coasts', () => shapeTopologyCoastalShelves(elevation, topology, seaLevel, age01));
}

function applyTopologyImpacts(elevation: Float32Array, topology: CubedSphereTopology, age01: number, impactFrequency: number, seaLevel: number, rng: SeededRandom): void {
  const impactCount = Math.max(0, Math.round(topology.cellCount / 4500 * lerp(0.55, 1.3, age01) * impactFrequency));
  for (let impact = 0; impact < impactCount; impact += 1) {
    const center = rng.int(0, topology.cellCount - 1);
    const radius = rng.range(0.018, 0.065);
    const depth = rng.range(0.035, 0.11) * lerp(1.05, 0.55, age01);
    const cx = topology.positions[center * 3];
    const cy = topology.positions[center * 3 + 1];
    const cz = topology.positions[center * 3 + 2];
    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      const dot = cx * topology.positions[cell * 3] + cy * topology.positions[cell * 3 + 1] + cz * topology.positions[cell * 3 + 2];
      const clampedDot = clamp(dot, -1, 1);
      if (clampedDot < Math.cos(radius * 1.35 * Math.PI)) continue;
      const distance = Math.acos(clampedDot) / Math.PI;
      if (distance > radius * 1.35) continue;
      const underwaterDamping = elevation[cell] < seaLevel ? 0.15 : 1;
      const t = distance / radius;
      if (t <= 1) {
        const bowl = (1 - t) ** 2;
        const rim = Math.max(0, 1 - Math.abs(t - 0.86) / 0.16);
        elevation[cell] += (rim * depth * 0.32 - bowl * depth) * underwaterDamping;
      } else {
        const outer = 1 - (t - 1) / 0.35;
        elevation[cell] += outer * outer * depth * 0.14 * underwaterDamping;
      }
    }
  }
}

function applyTopologyThermalWeathering(elevation: Float32Array, topology: CubedSphereTopology, age01: number): void {
  const passes = Math.max(1, Math.round(lerp(1, 5, age01)));
  const talus = lerp(0.11, 0.04, age01);
  const rate = lerp(0.08, 0.24, age01);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(elevation);
    for (let cell = 0; cell < elevation.length; cell += 1) {
      const current = elevation[cell];
      let moved = 0;
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor < 0) continue;
        const excess = current - elevation[neighbor] - talus;
        if (excess > 0) {
          const transfer = excess * rate * 0.25;
          next[neighbor] += transfer;
          moved += transfer;
        }
      }
      next[cell] -= moved;
    }
    elevation.set(next);
  }
}

function applyTopologyHydraulicErosion(elevation: Float32Array, topology: CubedSphereTopology, age01: number): void {
  const passes = Math.max(1, Math.round(lerp(1, 4, age01)));
  const erosionRate = lerp(0.006, 0.026, age01);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(elevation);
    for (let cell = 0; cell < elevation.length; cell += 1) {
      const downhill = lowestTopologyNeighbor(elevation, topology, cell);
      if (downhill === cell) continue;
      const drop = elevation[cell] - elevation[downhill];
      const cut = clamp(drop * 2.2) * erosionRate;
      next[cell] -= cut;
      next[downhill] += cut * 0.55;
    }
    elevation.set(next);
  }
}

function shapeTopologyCoastalShelves(elevation: Float32Array, topology: CubedSphereTopology, seaLevel: number, age01: number): void {
  const radius = Math.max(2, Math.round(lerp(2, 4, age01)));
  const coastInfluence = computeTopologyCoastInfluence(elevation, topology, seaLevel, radius);
  const shelfTarget = seaLevel - lerp(0.055, 0.105, age01);
  const lowCoastTarget = seaLevel + lerp(0.012, 0.024, age01);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    const coastal = coastInfluence[cell];
    if (coastal <= 0) continue;
    if (elevation[cell] < seaLevel && elevation[cell] > seaLevel - 0.16) {
      elevation[cell] = lerp(elevation[cell], shelfTarget, coastal * lerp(0.16, 0.3, age01));
    } else if (elevation[cell] >= seaLevel && elevation[cell] < seaLevel + 0.09) {
      elevation[cell] = lerp(elevation[cell], lowCoastTarget, coastal * lerp(0.14, 0.28, age01));
    } else if (elevation[cell] >= seaLevel + 0.09 && elevation[cell] < seaLevel + 0.18) {
      const cliffRetreat = coastal * lerp(0.002, 0.01, age01);
      elevation[cell] -= cliffRetreat;
    }
  }
}

function computeTopologyCoastInfluence(elevation: Float32Array, topology: CubedSphereTopology, seaLevel: number, radius: number): Float32Array {
  const coast = new Uint8Array(elevation.length);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    const water = elevation[cell] <= seaLevel;
    for (let i = 0; i < 4; i += 1) {
      const neighbor = topology.neighbors[cell * 4 + i];
      if (neighbor < 0) continue;
      if ((elevation[neighbor] <= seaLevel) !== water) {
        coast[cell] = 1;
        coast[neighbor] = 1;
      }
    }
  }
  return computeTopologyInfluenceFromMask(coast, topology, radius);
}

function computeTopologyInfluenceFromMask(mask: Uint8Array, topology: CubedSphereTopology, radius: number): Float32Array {
  const distance = new Float32Array(mask.length);
  const maxDistance = radius + 1;
  for (let cell = 0; cell < mask.length; cell += 1) distance[cell] = mask[cell] === 1 ? 0 : maxDistance;
  for (let pass = 0; pass < radius; pass += 1) {
    for (let cell = 0; cell < mask.length; cell += 1) {
      let best = distance[cell];
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor >= 0) best = Math.min(best, distance[neighbor] + 1);
      }
      distance[cell] = best;
    }
  }
  for (let cell = 0; cell < distance.length; cell += 1) distance[cell] = clamp(1 - distance[cell] / maxDistance);
  return distance;
}

function applyTopologyTerrainEnrichment(elevation: Float32Array, topology: CubedSphereTopology, values: SelectedValues, rng: SeededRandom): void {
  const phaseA = rng.range(0, 1000);
  const phaseB = rng.range(0, 1000);
  const phaseC = rng.range(0, 1000);
  const low = floatLayerPercentile(elevation, 0.2);
  const high = floatLayerPercentile(elevation, 0.9);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const height01 = normalizeValue(elevation[cell], low, high);
    const continentalMask = smoothStep(0.28, 0.72, height01);
    const highlandMask = smoothStep(0.52, 0.86, height01);
    const dryMask = clamp(values.aridity * 1.25 - 0.18);

    const ridgeField =
      ridgedSphericalNoise(x * 5.2 + phaseA, y * 5.2 - phaseB, z * 5.2 + phaseC) * 0.032 +
      ridgedSphericalNoise(x * 11.0 - phaseC, y * 11.0 + phaseA, z * 11.0 - phaseB) * 0.014;
    const ridgeMask = smoothStep(0.46, 0.78, coherentSphericalNoise(x * 1.8 + phaseB, y * 1.8 + phaseC, z * 1.8 - phaseA));

    const strata = smoothTerrace(height01 + coherentSphericalNoise(x * 8.5 + phaseC, y * 8.5 - phaseA, z * 8.5 + phaseB) * 0.035, 13);
    const terraceSignal = (strata - height01) * 0.07 * dryMask * smoothStep(0.35, 0.78, height01);

    const broadUndulation =
      coherentSphericalNoise(x * 2.8 - phaseB, y * 2.8 + phaseA, z * 2.8 + phaseC) * 0.018 +
      coherentSphericalNoise(x * 14.0 + phaseA, y * 14.0 + phaseB, z * 14.0 - phaseC) * 0.006;

    elevation[cell] += ridgeField * ridgeMask * highlandMask + terraceSignal + broadUndulation * continentalMask;
  }
  smoothTopologyLayer(elevation, topology, 1, 0.12);
}

function ridgedSphericalNoise(x: number, y: number, z: number): number {
  const value = 1 - Math.abs(coherentSphericalNoise(x, y, z) * 2 - 1);
  return value * value;
}

function smoothTerrace(value: number, steps: number): number {
  const scaled = value * steps;
  const base = Math.floor(scaled);
  const fraction = scaled - base;
  const eased = smoothStep(0.18, 0.82, fraction);
  return (base + eased) / steps;
}

function generateTopologyClimate(
  temperature: Float32Array,
  wetness: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  topology: CubedSphereTopology,
  values: SelectedValues,
  tideInfluence: number
): void {
  const oceanInfluence = computeTopologyWaterInfluence(water, topology, 18);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const lat01 = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const latitudeHeat = 1 - lat01;
    const elev = elevation[cell];
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    temperature[cell] = values.averageTemperatureC + latitudeHeat * 28 - 14 - Math.max(0, elev) * 26 - values.orbitalEccentricity * 16 + sphericalNoise(x * 6, y * 6, z * 6) * 2.2;
  }

  generateTopologyAtmosphericFlow(windX, windY, elevation, temperature, topology, values);
  generateTopologyOceanCurrents(currentX, currentY, windX, windY, elevation, water, topology);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const latitude = topology.latitudes[cell];
    const convergenceBand = Math.max(0, Math.cos(latitude * 2.9)) * 0.08 + Math.max(0, Math.sin(latitude * 6)) * 0.1;
    const moisture = topologyMoistureFetch(elevation, water, topology, cell, windX[cell], windY[cell], oceanInfluence[cell]);
    const orographic = topologyOrographicEffect(elevation, topology, cell, windX[cell], windY[cell]);
    const wetBase = moisture * 0.66 + (1 - values.aridity) * 0.36 + convergenceBand + tideInfluence * 0.04;
    wetness[cell] = clamp((wetBase + orographic.lift * 0.58 - orographic.shadow * 1.18 + sphericalNoise(x * 9, y * 9, z * 9) * 0.12 - 0.43) * 1.32 + 0.5);
  }
  smoothTopologyLayer(wetness, topology, 1, 0.22);
}

function generateTopologyClimateMoistureCandidate(
  climateMoisture: Float32Array,
  climatePrecipitation: Float32Array,
  climateWetnessDelta: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  existingWetness: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  topology: CubedSphereTopology,
  values: SelectedValues,
  seaLevel: number
): void {
  const oceanInfluence = computeTopologyWaterInfluence(water, topology, 24);
  const landInfluence = computeTopologyLandInfluence(water, topology, 8);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (water[cell] === 1) {
      const evaporation = clamp(normalizeValue(temperature[cell], -4, 32) * 0.72 + Math.hypot(currentX[cell], currentY[cell]) * 0.2);
      climatePrecipitation[cell] = evaporation;
      climateMoisture[cell] = 1;
      climateWetnessDelta[cell] = 0;
      continue;
    }
    const latitude = topology.latitudes[cell];
    const absLat = Math.abs(latitude);
    const itcz = Math.exp(-(latitude * latitude) / 0.08) * 0.24;
    const stormTrack = Math.exp(-((absLat - 0.72) ** 2) / 0.045) * 0.18;
    const subtropicalDry = Math.exp(-((absLat - 0.52) ** 2) / 0.035) * 0.16;
    const fetch = topologyMoistureFetch(elevation, water, topology, cell, windX[cell], windY[cell], oceanInfluence[cell]);
    const orographic = topologyOrographicEffect(elevation, topology, cell, windX[cell], windY[cell]);
    const warmCurrentBoost = coastalWarmCurrentMoistureBoost(water, temperature, currentX, currentY, topology, cell, landInfluence[cell]);
    const altitudeDrying = Math.max(0, elevation[cell] - seaLevel - 0.24) * 0.22;
    const thermalMoisture = normalizeValue(temperature[cell], -8, 28) * 0.09;
    const base = fetch * 0.56 + (1 - values.aridity) * 0.28 + itcz + stormTrack + warmCurrentBoost + thermalMoisture;
    const precipitation = clamp(base + orographic.lift * 0.52 - orographic.shadow * 0.86 - subtropicalDry - altitudeDrying);
    climatePrecipitation[cell] = precipitation;
    climateMoisture[cell] = clamp(precipitation * 0.82 + oceanInfluence[cell] * 0.16 + Math.max(0, existingWetness[cell] - 0.52) * 0.08);
    climateWetnessDelta[cell] = clamp(climateMoisture[cell] - existingWetness[cell], -1, 1);
  }
  smoothTopologyLayer(climateMoisture, topology, 1, 0.18);
  smoothTopologyLayer(climatePrecipitation, topology, 1, 0.14);
  for (let cell = 0; cell < topology.cellCount; cell += 1) climateWetnessDelta[cell] = clamp(climateMoisture[cell] - existingWetness[cell], -1, 1);
}

function coastalWarmCurrentMoistureBoost(
  water: Uint8Array,
  temperature: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  topology: CubedSphereTopology,
  cell: number,
  landInfluence: number
): number {
  if (landInfluence <= 0) return 0;
  let boost = 0;
  let count = 0;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0 || water[neighbor] !== 1) continue;
    const latitude = topology.latitudes[neighbor];
    const poleward = latitude >= 0 ? currentY[neighbor] : -currentY[neighbor];
    const warmTransport = Math.max(0, poleward) * normalizeValue(temperature[neighbor], -2, 30);
    boost += warmTransport * Math.hypot(currentX[neighbor], currentY[neighbor]);
    count += 1;
  }
  return clamp((boost / Math.max(1, count)) * 0.34 * clamp(landInfluence));
}

function generateTopologyAtmosphericFlow(
  windX: Float32Array,
  windY: Float32Array,
  elevation: Float32Array,
  temperature: Float32Array,
  topology: CubedSphereTopology,
  values: SelectedValues
): void {
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const latitude = topology.latitudes[cell];
    const lat01 = latitude / (Math.PI / 2);
    const absLat = Math.abs(lat01);
    const hemisphere = latitude < 0 ? -1 : 1;
    const cellBand = absLat < 0.33 ? 0 : absLat < 0.66 ? 1 : 2;
    const zonalDirection = cellBand === 1 ? -hemisphere : hemisphere;
    const pressureGradient = cellBand === 0 ? -lat01 : cellBand === 1 ? hemisphere * 0.42 : -hemisphere * 0.28;
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const jet = Math.exp(-((absLat - 0.34) ** 2) / 0.004) + Math.exp(-((absLat - 0.68) ** 2) / 0.006);
    const meander = coherentSphericalNoise(x * 2.5 + 9.1, y * 2.5 - 4.4, z * 2.5 + 3.7) * 0.34 + coherentSphericalNoise(x * 5.8 - 2.1, y * 5.8 + 7.2, z * 5.8) * 0.16;
    const thermal = normalizeLocalTemperature(temperature[cell], values.averageTemperatureC);
    const gradient = topologyTerrainGradient(elevation, topology, cell);
    const highlandBlock = clamp((elevation[cell] - 0.2) * 2.8);
    const windward = Math.max(0, gradient.x * zonalDirection + gradient.y * pressureGradient);
    const deflectStrength = highlandBlock * (0.72 + windward * 2.15);
    const alongBarrierX = -gradient.y * deflectStrength * 0.78;
    const alongBarrierY = gradient.x * deflectStrength * 1.05;
    const pressureCell = planetaryAtmosphericCellVector(topology, cell);
    const baseX = zonalDirection * (0.32 + jet * 0.34) + meander * 0.18 + pressureCell.x * 0.52;
    const baseY = pressureGradient * 0.2 + meander * 0.1 - thermal * 0.08 + pressureCell.y * 0.52;
    windX[cell] = clamp(baseX - gradient.x * deflectStrength + alongBarrierX, -1, 1);
    windY[cell] = clamp(baseY - gradient.y * deflectStrength + alongBarrierY, -1, 1);
  }
  smoothTopologyVectorField(windX, windY, topology, 1, 0.18, undefined);
}

function planetaryAtmosphericCellVector(topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  const latitude = topology.latitudes[cell];
  const longitude = topology.longitudes[cell];
  const absLat = Math.abs(latitude);
  const hemisphere = latitude < 0 ? -1 : 1;
  const bandCenter = absLat < 0.36 ? 0.22 * hemisphere : absLat < 0.76 ? 0.54 * hemisphere : 1.05 * hemisphere;
  const sectorWidth = Math.PI * 0.9;
  const sector = Math.floor((longitude + Math.PI + sectorWidth * 0.5) / sectorWidth);
  const centerLon = ((sector + 0.5) * sectorWidth) - Math.PI - sectorWidth * 0.5;
  const dx = wrappedAngle(longitude - centerLon) * Math.max(0.28, Math.cos(latitude));
  const dy = latitude - bandCenter;
  const radius = Math.max(0.04, Math.hypot(dx, dy));
  const bandMask = Math.max(
    Math.exp(-((absLat - 0.22) ** 2) / 0.03),
    Math.exp(-((absLat - 0.54) ** 2) / 0.035),
    Math.exp(-((absLat - 1.05) ** 2) / 0.05)
  );
  const ringMask = smoothStep(0.05, 0.22, radius) * (1 - smoothStep(0.72, 1.36, radius));
  const rotation = absLat < 0.36 ? -hemisphere : hemisphere;
  const convergence = absLat < 0.36 ? -0.12 : absLat < 0.76 ? 0.06 : -0.04;
  return {
    x: (dy / radius) * rotation * bandMask * ringMask - (dx / radius) * convergence * bandMask,
    y: (-dx / radius) * rotation * bandMask * ringMask - (dy / radius) * convergence * bandMask
  };
}

function generateTopologyOceanCurrents(
  currentX: Float32Array,
  currentY: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  topology: CubedSphereTopology
): void {
  const landInfluence = computeTopologyLandInfluence(water, topology, 10);
  const oceanBasins = identifyOceanBasins(water, topology);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (water[cell] !== 1) {
      currentX[cell] = 0;
      currentY[cell] = 0;
      continue;
    }
    const latitude = topology.latitudes[cell];
    const lat01 = latitude / (Math.PI / 2);
    const hemisphere = latitude < 0 ? -1 : 1;
    const basinGyre = oceanBasinGyreVector(oceanBasins, topology, cell);
    const planetaryGyre = planetaryOceanGyreVector(topology, cell);
    const equatorialCurrent = equatorialCurrentVector(latitude);
    const circumpolar = circumpolarCurrentVector(latitude, landInfluence[cell]);
    const coast = topologyCoastGradient(landInfluence, topology, cell);
    const terrain = topologyTerrainGradient(elevation, topology, cell);
    const edgePush = clamp(landInfluence[cell]) * 0.62;
    let x = windX[cell] * 0.14 + basinGyre.x * 0.62 + planetaryGyre.x * 0.78 + equatorialCurrent.x + circumpolar.x - terrain.x * edgePush * 0.18;
    let y = windY[cell] * 0.1 + basinGyre.y * 0.62 + planetaryGyre.y * 0.78 + equatorialCurrent.y + circumpolar.y - terrain.y * edgePush * 0.18;
    if (edgePush > 0.08) {
      const coastLength = Math.max(0.001, Math.hypot(coast.x, coast.y));
      const normalX = coast.x / coastLength;
      const normalY = coast.y / coastLength;
      const normalComponent = x * normalX + y * normalY;
      x -= normalX * normalComponent * edgePush;
      y -= normalY * normalComponent * edgePush;
      const tangentA = { x: -normalY, y: normalX };
      const tangentSign = tangentA.x * x + tangentA.y * y >= 0 ? 1 : -1;
      x += tangentA.x * tangentSign * edgePush * 0.22;
      y += tangentA.y * tangentSign * edgePush * 0.22;
    }
    const magnitude = Math.max(0.001, Math.hypot(x, y));
    const targetSpeed = clamp(0.18 + Math.abs(lat01) * 0.18 + Math.max(Math.abs(equatorialCurrent.x), Math.abs(circumpolar.x)) * 0.45 + edgePush * 0.12, 0.12, 0.9);
    currentX[cell] = clamp((x / magnitude) * Math.min(magnitude, targetSpeed), -1, 1);
    currentY[cell] = clamp((y / magnitude) * Math.min(magnitude, targetSpeed), -1, 1);
  }
  smoothTopologyVectorField(currentX, currentY, topology, 1, 0.16, water);
}

type OceanBasinModel = {
  basinIds: Int32Array;
  basins: OceanBasin[];
};

type OceanBasin = {
  id: number;
  northCenterLon: number;
  northCenterLat: number;
  southCenterLon: number;
  southCenterLat: number;
  fallbackLon: number;
  fallbackLat: number;
};

function identifyOceanBasins(water: Uint8Array, topology: CubedSphereTopology): OceanBasinModel {
  const basinIds = new Int32Array(water.length);
  basinIds.fill(-1);
  const basins: OceanBasin[] = [];
  const queue: number[] = [];
  for (let cell = 0; cell < water.length; cell += 1) {
    if (water[cell] !== 1 || basinIds[cell] >= 0) continue;
    const id = basins.length;
    const stats = createBasinStats();
    basinIds[cell] = id;
    queue.push(cell);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      addBasinStats(stats, topology, current);
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[current * 4 + i];
        if (neighbor < 0 || water[neighbor] !== 1 || basinIds[neighbor] >= 0) continue;
        basinIds[neighbor] = id;
        queue.push(neighbor);
      }
    }
    queue.length = 0;
    basins.push({
      id,
      northCenterLon: circularMean(stats.northSin, stats.northCos, stats.allSin, stats.allCos),
      northCenterLat: stats.northCount > 0 ? stats.northLat / stats.northCount : stats.allLat / Math.max(1, stats.allCount),
      southCenterLon: circularMean(stats.southSin, stats.southCos, stats.allSin, stats.allCos),
      southCenterLat: stats.southCount > 0 ? stats.southLat / stats.southCount : stats.allLat / Math.max(1, stats.allCount),
      fallbackLon: circularMean(stats.allSin, stats.allCos, 0, 1),
      fallbackLat: stats.allLat / Math.max(1, stats.allCount)
    });
  }
  return { basinIds, basins };
}

function oceanBasinGyreVector(model: OceanBasinModel, topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  const basin = model.basins[model.basinIds[cell]];
  if (!basin) return { x: 0, y: 0 };
  const latitude = topology.latitudes[cell];
  const absLat = Math.abs(latitude);
  const hemisphere = latitude < 0 ? -1 : 1;
  const centerLon = latitude >= 0 ? basin.northCenterLon : basin.southCenterLon;
  const centerLat = latitude >= 0 ? basin.northCenterLat : basin.southCenterLat;
  const dx = wrappedAngle(topology.longitudes[cell] - (Number.isFinite(centerLon) ? centerLon : basin.fallbackLon)) * Math.max(0.2, Math.cos(latitude));
  const dy = latitude - (Number.isFinite(centerLat) ? centerLat : basin.fallbackLat);
  const radius = Math.max(0.05, Math.hypot(dx, dy));
  const subtropicalMask = smoothStep(0.1, 0.34, absLat) * (1 - smoothStep(0.82, 1.12, absLat));
  const basinEdgeMask = smoothStep(0.04, 0.18, radius) * (1 - smoothStep(1.2, 2.5, radius));
  const rotation = hemisphere;
  const tangentX = (dy / radius) * rotation;
  const tangentY = (-dx / radius) * rotation;
  const radialReturn = clamp((radius - 0.42) * 0.22, -0.12, 0.16);
  return {
    x: tangentX * subtropicalMask * basinEdgeMask - (dx / radius) * radialReturn,
    y: tangentY * subtropicalMask * basinEdgeMask - (dy / radius) * radialReturn
  };
}

function planetaryOceanGyreVector(topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  const latitude = topology.latitudes[cell];
  const longitude = topology.longitudes[cell];
  const absLat = Math.abs(latitude);
  const hemisphere = latitude < 0 ? -1 : 1;
  const sectorWidth = Math.PI * 0.72;
  const shifted = longitude + Math.PI + sectorWidth * 0.5;
  const sector = Math.floor(shifted / sectorWidth);
  const centerLon = ((sector + 0.5) * sectorWidth) - Math.PI - sectorWidth * 0.5;
  const centerLat = hemisphere * 0.54;
  const dx = wrappedAngle(longitude - centerLon) * Math.max(0.24, Math.cos(latitude));
  const dy = latitude - centerLat;
  const radius = Math.max(0.04, Math.hypot(dx, dy));
  const subtropicalMask = smoothStep(0.13, 0.32, absLat) * (1 - smoothStep(0.85, 1.16, absLat));
  const ringMask = smoothStep(0.08, 0.24, radius) * (1 - smoothStep(0.82, 1.42, radius));
  const rotation = hemisphere;
  return {
    x: (dy / radius) * rotation * subtropicalMask * ringMask,
    y: (-dx / radius) * rotation * subtropicalMask * ringMask
  };
}

function equatorialCurrentVector(latitude: number): { x: number; y: number } {
  const absLat = Math.abs(latitude);
  const counterCurrent = Math.max(0, 1 - absLat / 0.07) * 0.28;
  const equatorialWest = smoothStep(0.07, 0.14, absLat) * (1 - smoothStep(0.28, 0.38, absLat)) * -0.34;
  return { x: counterCurrent + equatorialWest, y: 0 };
}

function circumpolarCurrentVector(latitude: number, landInfluence: number): { x: number; y: number } {
  if (latitude > -1.22 || latitude < -1.52) return { x: 0, y: 0 };
  const band = smoothStep(-1.52, -1.38, latitude) * (1 - smoothStep(-1.28, -1.18, latitude));
  return { x: band * (1 - clamp(landInfluence)) * 0.42, y: 0 };
}

function createBasinStats() {
  return {
    allSin: 0,
    allCos: 0,
    allLat: 0,
    allCount: 0,
    northSin: 0,
    northCos: 0,
    northLat: 0,
    northCount: 0,
    southSin: 0,
    southCos: 0,
    southLat: 0,
    southCount: 0
  };
}

function addBasinStats(stats: ReturnType<typeof createBasinStats>, topology: CubedSphereTopology, cell: number): void {
  const latitude = topology.latitudes[cell];
  const longitude = topology.longitudes[cell];
  const sin = Math.sin(longitude);
  const cos = Math.cos(longitude);
  stats.allSin += sin;
  stats.allCos += cos;
  stats.allLat += latitude;
  stats.allCount += 1;
  if (latitude >= 0.08 && latitude <= 1.05) {
    stats.northSin += sin;
    stats.northCos += cos;
    stats.northLat += latitude;
    stats.northCount += 1;
  } else if (latitude <= -0.08 && latitude >= -1.05) {
    stats.southSin += sin;
    stats.southCos += cos;
    stats.southLat += latitude;
    stats.southCount += 1;
  }
}

function circularMean(primarySin: number, primaryCos: number, fallbackSin: number, fallbackCos: number): number {
  const sin = Math.hypot(primarySin, primaryCos) > 0.001 ? primarySin : fallbackSin;
  const cos = Math.hypot(primarySin, primaryCos) > 0.001 ? primaryCos : fallbackCos;
  return Math.atan2(sin, cos);
}

function topologyMoistureFetch(
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
  let fetch = oceanInfluence * 0.55;
  for (let step = 0; step < 14; step += 1) {
    cursor = stepTopologyByVector(topology, cursor, -windX, -windY);
    if (water[cursor] === 1) {
      fetch += (1 - step / 15) * 0.55;
      continue;
    }
    const highlandDrying = Math.max(0, elevation[cursor] - 0.34) * (1 - step / 16) * 0.08;
    fetch -= highlandDrying;
  }
  return clamp(fetch);
}

function topologyOrographicEffect(
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
  for (let step = 0; step < 10; step += 1) {
    cursor = stepTopologyByVector(topology, cursor, -windX, -windY);
    const barrier = Math.max(0, elevation[cursor] - elevation[cell] + 0.08) + Math.max(0, elevation[cursor] - 0.36) * 0.55;
    shadow = Math.max(shadow, barrier * (1 - step / 11));
  }
  return {
    lift: clamp(upslope * 3.2 + Math.max(0, elevation[cell] - 0.42) * 0.12),
    shadow: clamp(shadow * 1.4)
  };
}

function stepTopologyByVector(topology: CubedSphereTopology, cell: number, vectorX: number, vectorY: number): number {
  const length = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
  if (length < 0.0001) return cell;
  let best = cell;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0) continue;
    const dx = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.cos(topology.latitudes[cell]);
    const dy = topology.latitudes[neighbor] - topology.latitudes[cell];
    const distance = Math.max(0.000001, Math.sqrt(dx * dx + dy * dy));
    const score = (dx / distance) * (vectorX / length) + (dy / distance) * (vectorY / length);
    if (score > bestScore) {
      best = neighbor;
      bestScore = score;
    }
  }
  return best;
}

function topologyTerrainGradient(layer: Float32Array, topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  let gx = 0;
  let gy = 0;
  let count = 0;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0) continue;
    const dx = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.cos(topology.latitudes[cell]);
    const dy = topology.latitudes[neighbor] - topology.latitudes[cell];
    const distance2 = Math.max(0.000001, dx * dx + dy * dy);
    const delta = layer[neighbor] - layer[cell];
    gx += (delta * dx) / distance2;
    gy += (delta * dy) / distance2;
    count += 1;
  }
  if (count === 0) return { x: 0, y: 0 };
  return { x: clamp(gx / count, -1, 1), y: clamp(gy / count, -1, 1) };
}

function topologyCoastGradient(waterInfluence: Float32Array, topology: CubedSphereTopology, cell: number): { x: number; y: number } {
  return topologyTerrainGradient(waterInfluence, topology, cell);
}

function smoothTopologyVectorField(xLayer: Float32Array, yLayer: Float32Array, topology: CubedSphereTopology, passes: number, blend: number, mask?: Uint8Array): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const nextX = new Float32Array(xLayer);
    const nextY = new Float32Array(yLayer);
    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      if (mask && mask[cell] !== 1) continue;
      let totalX = xLayer[cell];
      let totalY = yLayer[cell];
      let count = 1;
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor < 0 || (mask && mask[neighbor] !== 1)) continue;
        totalX += xLayer[neighbor];
        totalY += yLayer[neighbor];
        count += 1;
      }
      nextX[cell] = lerp(xLayer[cell], totalX / count, blend);
      nextY[cell] = lerp(yLayer[cell], totalY / count, blend);
    }
    xLayer.set(nextX);
    yLayer.set(nextY);
  }
}

function computeTopologyWaterInfluence(water: Uint8Array, topology: CubedSphereTopology, radius: number): Float32Array {
  const distance = new Float32Array(water.length);
  const maxDistance = radius + 1;
  for (let cell = 0; cell < water.length; cell += 1) distance[cell] = water[cell] === 1 ? 0 : maxDistance;
  for (let pass = 0; pass < radius; pass += 1) {
    for (let cell = 0; cell < water.length; cell += 1) {
      let best = distance[cell];
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor >= 0) best = Math.min(best, distance[neighbor] + 1);
      }
      distance[cell] = best;
    }
  }
  for (let cell = 0; cell < distance.length; cell += 1) distance[cell] = clamp(1 - distance[cell] / maxDistance);
  return distance;
}

function computeTopologyLandInfluence(water: Uint8Array, topology: CubedSphereTopology, radius: number): Float32Array {
  const distance = new Float32Array(water.length);
  const maxDistance = radius + 1;
  for (let cell = 0; cell < water.length; cell += 1) distance[cell] = water[cell] === 0 ? 0 : maxDistance;
  for (let pass = 0; pass < radius; pass += 1) {
    for (let cell = 0; cell < water.length; cell += 1) {
      let best = distance[cell];
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor >= 0) best = Math.min(best, distance[neighbor] + 1);
      }
      distance[cell] = best;
    }
  }
  for (let cell = 0; cell < distance.length; cell += 1) distance[cell] = clamp(1 - distance[cell] / maxDistance);
  return distance;
}

function assignTopologyIce(ice: Uint8Array, elevation: Float32Array, temperature: Float32Array, wetness: Float32Array, topology: CubedSphereTopology, seaLevel: number): void {
  ice.fill(0);
  for (let cell = 0; cell < ice.length; cell += 1) {
    const polarLatitude = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const highMountain = elevation[cell] > seaLevel + 0.54;
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const iceEdgeNoise = coherentSphericalNoise(x * 3.2 + 11.7, y * 3.2 - 4.9, z * 3.2 + 8.1) * 0.055 + coherentSphericalNoise(x * 8.5 - 2.3, y * 8.5 + 14.1, z * 8.5) * 0.025;
    const wetnessPush = clamp(wetness[cell] - 0.45, -0.22, 0.3) * 0.08;
    const highlandPush = Math.max(0, elevation[cell] - seaLevel - 0.22) * 0.08;
    const polarIceLine = 0.84 + iceEdgeNoise - wetnessPush - highlandPush;
    if ((polarLatitude > polarIceLine && temperature[cell] < 1.8) || (highMountain && temperature[cell] < -2 + wetness[cell] * 2)) ice[cell] = 1;
  }
  smoothTopologyIce(ice, temperature, topology);
}

function smoothTopologyIce(ice: Uint8Array, temperature: Float32Array, topology: CubedSphereTopology): void {
  const copy = new Uint8Array(ice);
  for (let cell = 0; cell < ice.length; cell += 1) {
    let frozenNeighbors = 0;
    let validNeighbors = 0;
    for (let i = 0; i < 4; i += 1) {
      const neighbor = topology.neighbors[cell * 4 + i];
      if (neighbor < 0) continue;
      validNeighbors += 1;
      frozenNeighbors += copy[neighbor];
    }
    if (copy[cell] === 1 && frozenNeighbors === 0 && temperature[cell] > -4) ice[cell] = 0;
    if (copy[cell] === 0 && validNeighbors > 0 && frozenNeighbors >= 3 && temperature[cell] < -1.5) ice[cell] = 1;
  }
}

function generateTopologyHydrology(
  river: Float32Array,
  lakes: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  topology: CubedSphereTopology,
  seaLevel: number,
  riverDensity: number
): TopologyRiverPath[] {
  river.fill(0);
  lakes.fill(0);
  const oceanInfluence = computeTopologyWaterInfluence(water, topology, 48);
  const drainageElevation = computeTopologyDrainageSurface(elevation, water, topology);
  const flow = new Float32Array(elevation.length);
  const receiver = new Int32Array(elevation.length);
  const order = Array.from(elevation.keys()).sort((a, b) => drainageElevation[b] - drainageElevation[a]);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    receiver[cell] = hydrologyReceiver(elevation, drainageElevation, water, topology, cell);
    flow[cell] = water[cell] === 1 ? 0 : Math.max(0.02, wetness[cell] * Math.max(0.05, elevation[cell] - seaLevel + 0.08));
    if (water[cell] === 0 && drainageElevation[cell] > elevation[cell] + 0.014) lakes[cell] = 1;
  }
  for (const cell of order) {
    if (water[cell] === 1) continue;
    const next = receiver[cell];
    if (next === cell) {
      markTopologyLakeBasin(lakes, elevation, topology, cell, drainageElevation[cell] + 0.004, 2);
      continue;
    }
    flow[next] += flow[cell] * 0.92;
  }
  const channelThreshold = positiveFloatLayerPercentile(flow, clamp(0.91 - riverDensity * 0.032, 0.68, 0.91));
  for (let cell = 0; cell < flow.length; cell += 1) {
    if (water[cell] === 1 || flow[cell] <= channelThreshold) continue;
    river[cell] += clamp((flow[cell] - channelThreshold) / Math.max(0.0001, channelThreshold * 2.4));
  }
  const threshold = positiveFloatLayerPercentile(flow, clamp(0.94 - riverDensity * 0.024, 0.78, 0.94));
  const sourceCandidates = order
    .filter((cell) => water[cell] === 0 && flow[cell] > threshold && elevation[cell] > seaLevel + 0.09)
    .sort((a, b) => riverSourceScore(flow, elevation, oceanInfluence, seaLevel, b) - riverSourceScore(flow, elevation, oceanInfluence, seaLevel, a));
  const paths: TopologyRiverPath[] = [];
  const maxPaths = Math.max(18, Math.min(180, Math.round(riverDensity * 36)));
  const minNamedPathLength = Math.max(4, Math.round(topology.resolution / 64));
  for (const source of sourceCandidates) {
    if (paths.length >= maxPaths) break;
    if (river[source] > 0.4) continue;
    const path: number[] = [];
    const seen = new Set<number>();
    let current = source;
    let terminus: River['terminus'] = 'basin';
    for (let step = 0; step < 800; step += 1) {
      if (seen.has(current)) {
        markTopologyLakeBasin(lakes, elevation, topology, current, drainageElevation[current] + 0.004, 2);
        terminus = 'lake';
        break;
      }
      seen.add(current);
      path.push(current);
      if (water[current] === 1) {
        terminus = 'ocean';
        break;
      }
      const next = receiver[current];
      if (next === current) {
        markTopologyLakeBasin(lakes, elevation, topology, current, drainageElevation[current] + 0.004, 3);
        terminus = 'lake';
        break;
      }
      current = next;
    }
    if (path.length < minNamedPathLength) continue;
    for (let i = 0; i < path.length; i += 1) river[path[i]] += lerp(0.28, 1.3, i / path.length);
    paths.push({ path, terminus });
  }
  return paths;
}

function hydrologyReceiver(elevation: Float32Array, drainageElevation: Float32Array, water: Uint8Array, topology: CubedSphereTopology, cell: number): number {
  if (water[cell] === 1) return cell;
  let best = cell;
  let bestScore = drainageElevation[cell] + elevation[cell] * 0.001;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0) continue;
    if (water[neighbor] === 1) return neighbor;
    const score = drainageElevation[neighbor] + elevation[neighbor] * 0.001;
    if (score < bestScore) {
      best = neighbor;
      bestScore = score;
    }
  }
  return best;
}

function computeTopologyDrainageSurface(elevation: Float32Array, water: Uint8Array, topology: CubedSphereTopology): Float32Array {
  const filled = new Float32Array(elevation.length);
  filled.fill(Number.POSITIVE_INFINITY);
  const heap = new MinHeap();
  for (let cell = 0; cell < water.length; cell += 1) {
    if (water[cell] !== 1) continue;
    filled[cell] = elevation[cell];
    heap.push({ cell, priority: filled[cell] });
  }
  if (heap.size === 0) {
    filled.set(elevation);
    return filled;
  }
  const epsilon = 0.00002;
  while (heap.size > 0) {
    const node = heap.pop()!;
    if (node.priority > filled[node.cell] + epsilon) continue;
    for (let i = 0; i < 4; i += 1) {
      const neighbor = topology.neighbors[node.cell * 4 + i];
      if (neighbor < 0 || filled[neighbor] !== Number.POSITIVE_INFINITY) continue;
      const next = Math.max(elevation[neighbor], filled[node.cell] + epsilon);
      filled[neighbor] = next;
      heap.push({ cell: neighbor, priority: next });
    }
  }
  return filled;
}

function riverSourceScore(flow: Float32Array, elevation: Float32Array, oceanInfluence: Float32Array, seaLevel: number, cell: number): number {
  const relief = Math.max(0, elevation[cell] - seaLevel);
  const inland = 1 - oceanInfluence[cell] * 0.58;
  return flow[cell] * (0.45 + relief * 2.4) * Math.max(0.2, inland);
}

function markTopologyLakeBasin(lakes: Uint8Array, elevation: Float32Array, topology: CubedSphereTopology, start: number, spillLevel: number, radius: number): void {
  const queue: Array<{ cell: number; depth: number }> = [{ cell: start, depth: 0 }];
  const seen = new Set<number>([start]);
  while (queue.length) {
    const { cell, depth } = queue.shift()!;
    if (elevation[cell] <= spillLevel) lakes[cell] = 1;
    if (depth >= radius) continue;
    for (let i = 0; i < 4; i += 1) {
      const neighbor = topology.neighbors[cell * 4 + i];
      if (neighbor < 0 || seen.has(neighbor) || elevation[neighbor] > spillLevel) continue;
      seen.add(neighbor);
      queue.push({ cell: neighbor, depth: depth + 1 });
    }
  }
}

class MinHeap {
  private readonly values: HeapNode[] = [];

  get size(): number {
    return this.values.length;
  }

  push(node: HeapNode): void {
    this.values.push(node);
    this.bubbleUp(this.values.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.values.length === 0) return undefined;
    const root = this.values[0];
    const last = this.values.pop()!;
    if (this.values.length > 0) {
      this.values[0] = last;
      this.sinkDown(0);
    }
    return root;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.values[parent].priority <= this.values[current].priority) break;
      [this.values[parent], this.values[current]] = [this.values[current], this.values[parent]];
      current = parent;
    }
  }

  private sinkDown(index: number): void {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;
      if (left < this.values.length && this.values[left].priority < this.values[smallest].priority) smallest = left;
      if (right < this.values.length && this.values[right].priority < this.values[smallest].priority) smallest = right;
      if (smallest === current) break;
      [this.values[current], this.values[smallest]] = [this.values[smallest], this.values[current]];
      current = smallest;
    }
  }
}

function assignTopologyBiomes(
  biomes: Uint8Array,
  ice: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  wetness: Float32Array,
  river: Float32Array,
  lakes: Uint8Array,
  topology: CubedSphereTopology,
  seaLevel: number,
  biomeRules?: BiomeClassificationRule[]
): void {
  for (let cell = 0; cell < biomes.length; cell += 1) {
    const polarLatitude = Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const biome = classifyBiomeFromRules({
      water: water[cell] === 1,
      ice: ice[cell] === 1,
      temperatureC: temperature[cell],
      elevationAboveSeaLevel: elevation[cell] - seaLevel,
      lake: lakes[cell] === 1,
      river: river[cell],
      wetness: wetness[cell],
      polarLatitude
    }, biomeRules);
    biomes[cell] = biomeToCode(biome);
  }
}

function assignTopologyVolcanism(
  volcanism: Float32Array,
  elevation: Float32Array,
  plateLayer: Uint16Array,
  plates: Plate[],
  topology: CubedSphereTopology,
  seaLevel: number
): void {
  volcanism.fill(0);
  for (let cell = 0; cell < volcanism.length; cell += 1) {
    const plate = plates[plateLayer[cell]];
    let boundary = 0;
    let convergence = 0;
    for (let i = 0; i < 4; i += 1) {
      const neighbor = topology.neighbors[cell * 4 + i];
      if (neighbor < 0 || plateLayer[neighbor] === plateLayer[cell]) continue;
      const other = plates[plateLayer[neighbor]];
      boundary = 1;
      const dx = topology.positions[neighbor * 3] - topology.positions[cell * 3];
      const dy = topology.positions[neighbor * 3 + 1] - topology.positions[cell * 3 + 1];
      const dz = topology.positions[neighbor * 3 + 2] - topology.positions[cell * 3 + 2];
      const motion = (plate.motionX - other.motionX) * dx + (plate.motionY - other.motionY) * dy + (plate.kind === 'oceanic' || other.kind === 'oceanic' ? 0.08 : 0);
      convergence = Math.max(convergence, motion);
    }
    const slope = topologySlope(elevation, topology, cell);
    const heightAboveSea = elevation[cell] - seaLevel;
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const hotspot = smoothStep(0.72, 0.96, coherentSphericalNoise(x * 5.6 + 17.3, y * 5.6 - 9.1, z * 5.6 + 2.7));
    const islandArc = boundary && heightAboveSea > -0.08 && heightAboveSea < 0.26 ? 0.16 : 0;
    const upliftVent = boundary && heightAboveSea > 0.04 && slope > 0.06 ? 0.16 : 0;
    const signal = boundary * 0.2 + Math.max(0, convergence) * 1.35 + hotspot * 0.26 + slope * 0.58 + islandArc + upliftVent;
    volcanism[cell] = clamp(signal);
  }
}

function topologySlope(elevation: Float32Array, topology: CubedSphereTopology, cell: number): number {
  const current = elevation[cell];
  let maxDelta = 0;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor >= 0) maxDelta = Math.max(maxDelta, Math.abs(current - elevation[neighbor]));
  }
  return maxDelta;
}

function assignPlateLayer(layer: Uint16Array, plates: Plate[], width: number, height: number): void {
  const jitterScale = Math.sqrt(width * height) * 0.055;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = plates[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      const jitterX = (valueNoise(x / 38, y / 38) + valueNoise(x / 91, y / 73) * 0.5) * jitterScale;
      const jitterY = (valueNoise((x + 41) / 42, (y - 17) / 42) + valueNoise((x - 23) / 83, (y + 29) / 79) * 0.5) * jitterScale;
      for (const plate of plates) {
        const dx = Math.min(Math.abs(x + jitterX - plate.centerX), width - Math.abs(x + jitterX - plate.centerX));
        const dy = y + jitterY - plate.centerY;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          best = plate;
          bestDistance = distance;
        }
      }
      layer[layerIndex(x, y, width)] = best.id;
    }
  }
}

function generateElevation(
  elevation: Float32Array,
  plateLayer: Uint16Array,
  plates: Plate[],
  width: number,
  height: number,
  rng: SeededRandom
): void {
  const phaseA = rng.range(0, 1000);
  const phaseB = rng.range(0, 1000);
  for (let y = 0; y < height; y += 1) {
    const latitude = 1 - Math.abs((y / (height - 1)) * 2 - 1);
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      const plate = plates[plateLayer[i]];
      const continentalBias = plate.kind === 'continental' ? 0.23 : -0.18;
      const nx = x / width;
      const ny = y / height;
      const broad = Math.sin((nx * 4.8 + phaseA) * Math.PI) * 0.16 + Math.cos((ny * 3.7 + phaseB) * Math.PI) * 0.14;
      const detail =
        valueNoise(nx * 5.5 + phaseB, ny * 5.5 + phaseA) * 0.16 +
        valueNoise(nx * 13.5 + phaseA, ny * 12.5 + phaseB) * 0.08 +
        valueNoise(nx * 31.5 + phaseB, ny * 27.5 + phaseA) * 0.035;
      const polarShelf = (1 - latitude) * -0.05;
      elevation[i] = continentalBias + broad + detail + polarShelf;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      const current = plateLayer[i];
      const right = plateLayer[layerIndex(wrapX(x + 1, width), y, width)];
      const down = plateLayer[layerIndex(x, Math.min(height - 1, y + 1), width)];
      for (const neighbor of [right, down]) {
        if (neighbor === current) continue;
        const a = plates[current];
        const b = plates[neighbor];
        const interaction = plateInteraction(a, b, width);
        const uplift = interaction.effect;
        const radius = interaction.radius;
        const boundaryJitter = valueNoise((x + y * 0.37) / 9, (y - x * 0.21) / 9);
        for (let oy = -radius; oy <= radius; oy += 1) {
          for (let ox = -radius; ox <= radius; ox += 1) {
            const yy = y + oy;
            if (yy < 0 || yy >= height) continue;
            const xx = wrapX(x + ox, width);
            const target = layerIndex(xx, yy, width);
            const falloff = 1 - Math.min(1, Math.sqrt(ox * ox + oy * oy) / (radius + 0.1));
            const brokenFalloff = falloff * lerp(0.45, 1.25, (boundaryJitter + 1) / 2);
            elevation[target] += uplift * brokenFalloff;
          }
        }
      }
    }
  }
}

function findSeaLevelForOceanTarget(elevation: Float32Array, oceanTarget: number, adjustment: number): number {
  const values = Array.from(elevation);
  const index = Math.max(0, Math.min(values.length - 1, Math.round((oceanTarget / 100) * values.length)));
  return quickSelect(values, index) + adjustment * 0.01;
}

function plateInteraction(a: Plate, b: Plate, width: number): { effect: number; radius: number } {
  const dxRaw = b.centerX - a.centerX;
  const dx = Math.abs(dxRaw) > width / 2 ? dxRaw - Math.sign(dxRaw) * width : dxRaw;
  const dy = b.centerY - a.centerY;
  const length = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
  const nx = dx / length;
  const ny = dy / length;
  const ax = a.motionX * nx + a.motionY * ny;
  const bx = b.motionX * nx + b.motionY * ny;
  const convergence = ax - bx;
  const transform = Math.abs((a.motionX - b.motionX) * -ny + (a.motionY - b.motionY) * nx);

  if (convergence > 0.45) {
    if (a.kind === 'oceanic' && b.kind === 'oceanic') return { effect: -0.08, radius: 2 };
    if (a.kind !== b.kind) return { effect: 0.18, radius: 2 };
    return { effect: 0.24, radius: 3 };
  }
  if (convergence < -0.32) return { effect: -0.18, radius: 3 };
  if (transform > 0.55) return { effect: 0.035, radius: 1 };
  return { effect: -0.035, radius: 1 };
}

function applyTerrainAging(
  elevation: Float32Array,
  width: number,
  height: number,
  ageGy: number,
  impactFrequency: number,
  seaLevel: number,
  rng: SeededRandom,
  diagnostics: DiagnosticsRecorder
): void {
  const age01 = clamp(ageGy / 10);
  diagnostics.measure('terrain.aging.impacts', () => applyAsteroidImpacts(elevation, width, height, age01, impactFrequency, seaLevel, rng));
  diagnostics.measure('terrain.aging.weathering', () => applyThermalWeathering(elevation, width, height, age01));
  diagnostics.measure('terrain.aging.hydraulic', () => applyHydraulicErosion(elevation, width, height, age01));
  diagnostics.measure('terrain.aging.basins', () => shapeClosedBasins(elevation, width, height, age01));
}

function applyAsteroidImpacts(
  elevation: Float32Array,
  width: number,
  height: number,
  age01: number,
  impactFrequency: number,
  seaLevel: number,
  rng: SeededRandom
): void {
  const worldScale = Math.sqrt(width * height);
  const impactCount = Math.max(0, Math.round((width * height) / 18000 * lerp(0.75, 1.65, age01) * impactFrequency));
  const largestRadius = Math.max(3, Math.min(width, height) * 0.045);

  for (let impact = 0; impact < impactCount; impact += 1) {
    const centerX = rng.int(0, width - 1);
    const centerY = rng.int(0, height - 1);
    const radius = rng.range(Math.max(2, worldScale * 0.012), largestRadius);
    const rimWidth = Math.max(1.25, radius * 0.28);
    const depth = rng.range(0.08, 0.22) * lerp(1.08, 0.68, age01);
    const reach = Math.ceil(radius + rimWidth);

    for (let oy = -reach; oy <= reach; oy += 1) {
      const y = centerY + oy;
      if (y < 0 || y >= height) continue;
      for (let ox = -reach; ox <= reach; ox += 1) {
        const distance = Math.sqrt(ox * ox + oy * oy);
        if (distance > radius + rimWidth) continue;
        const x = wrapX(centerX + ox, width);
        const index = layerIndex(x, y, width);
        const underwater = elevation[index] < seaLevel;
        const waterDamping = underwater ? 0.18 : 1;
        const localDepth = depth * waterDamping;

        if (distance <= radius) {
          const inner01 = distance / radius;
          const bowl = (1 - inner01) ** 2;
          const innerRim = Math.max(0, 1 - Math.abs(inner01 - 0.86) / 0.14);
          elevation[index] += innerRim * localDepth * 0.38 - bowl * localDepth;
        } else {
          const outer01 = (distance - radius) / rimWidth;
          elevation[index] += (1 - outer01) ** 2 * localDepth * 0.22;
        }
      }
    }
  }
}

function applyThermalWeathering(elevation: Float32Array, width: number, height: number, age01: number): void {
  const passes = Math.max(1, Math.round(lerp(1, 5, age01)));
  const talus = lerp(0.12, 0.045, age01);
  const transferRate = lerp(0.12, 0.28, age01);

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(elevation);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const current = elevation[index];

      let totalExcess = 0;
      let lowerCount = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const neighbor = layerIndex(wrapX(x + ox, width), yy, width);
          const excess = current - elevation[neighbor] - talus;
          if (excess > 0) {
            totalExcess += excess;
            lowerCount += 1;
          }
        }
      }
      if (totalExcess <= 0) continue;

      const moved = Math.min(totalExcess * transferRate, current + 1) / lowerCount;
      next[index] -= moved * lowerCount;
      for (let oy = -1; oy <= 1; oy += 1) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const neighbor = layerIndex(wrapX(x + ox, width), yy, width);
          if (current - elevation[neighbor] > talus) next[neighbor] += moved;
        }
      }
      }
    }
    elevation.set(next);
  }
}

function applyHydraulicErosion(elevation: Float32Array, width: number, height: number, age01: number): void {
  const passes = Math.max(1, Math.round(lerp(1, 4, age01)));
  const erosionRate = lerp(0.012, 0.042, age01);
  const depositionRate = lerp(0.006, 0.026, age01);

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(elevation);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const current = elevation[index];
      let steepest = index;
      let steepestDrop = 0;
      let lowerCount = 0;

      for (let oy = -1; oy <= 1; oy += 1) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
        const neighbor = layerIndex(wrapX(x + ox, width), yy, width);
        const drop = current - elevation[neighbor];
        if (drop > 0) lowerCount += 1;
        if (drop > steepestDrop) {
          steepest = neighbor;
          steepestDrop = drop;
        }
        }
      }

      if (steepest !== index) {
        const flowStrength = clamp(steepestDrop * 1.8);
        const carried = flowStrength * erosionRate;
        next[index] -= carried;
        next[steepest] += carried * 0.62;
      } else if (lowerCount === 0 && current > -0.15) {
        next[index] += depositionRate * 0.35;
      }
      }
    }
    elevation.set(next);
  }
}

function shapeClosedBasins(elevation: Float32Array, width: number, height: number, age01: number): void {
  const fillRate = lerp(0.004, 0.028, age01);
  for (let index = 0; index < elevation.length; index += 1) {
    const neighbors = neighbors8(index, width, height);
    const lowestNeighbor = neighbors.reduce((lowest, next) => (elevation[next] < elevation[lowest] ? next : lowest), neighbors[0]);
    const rim = neighbors.reduce((min, next) => Math.min(min, elevation[next]), Number.POSITIVE_INFINITY);
    if (elevation[index] < rim - 0.035 && elevation[index] < 0.35) {
      elevation[index] = lerp(elevation[index], rim - 0.012, fillRate * 8);
    } else if (elevation[index] > elevation[lowestNeighbor] + 0.18 && elevation[index] < 0.22) {
      elevation[index] -= fillRate;
    }
  }
}

function shapeCoastalShelves(elevation: Float32Array, width: number, height: number, seaLevel: number, age01: number): void {
  const radius = Math.max(2, Math.round(lerp(2, 6, age01)));
  const coastInfluence = computeCoastInfluence(elevation, seaLevel, width, height, radius);
  for (let index = 0; index < elevation.length; index += 1) {
    const coastal = coastInfluence[index];
    if (coastal <= 0) continue;
    const shelfTarget = seaLevel - lerp(0.035, 0.075, age01);
    if (elevation[index] < seaLevel && elevation[index] > seaLevel - 0.22) {
      elevation[index] = lerp(elevation[index], shelfTarget, coastal * 0.38);
    } else if (elevation[index] > seaLevel && elevation[index] < seaLevel + 0.08) {
      elevation[index] = lerp(elevation[index], seaLevel + 0.018, coastal * 0.22);
    }
  }
}

function computeCoastInfluence(elevation: Float32Array, seaLevel: number, width: number, height: number, radius: number): Float32Array {
  const coast = new Uint8Array(elevation.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const water = elevation[index] <= seaLevel;
      const right = elevation[layerIndex(wrapX(x + 1, width), y, width)] <= seaLevel;
      const down = elevation[layerIndex(x, Math.min(height - 1, y + 1), width)] <= seaLevel;
      if (water !== right || water !== down) coast[index] = 1;
    }
  }
  return computeWaterInfluence(coast, width, height, radius);
}

function smoothWaterMask(water: Uint8Array, elevation: Float32Array, seaLevel: number, width: number, height: number): void {
  const next = new Uint8Array(water);
  for (let index = 0; index < water.length; index += 1) {
    const neighbors = neighbors8(index, width, height);
    const waterNeighbors = neighbors.reduce((sum, neighbor) => sum + water[neighbor], 0);
    if (water[index] === 1 && waterNeighbors <= 1 && elevation[index] > seaLevel - 0.04) next[index] = 0;
    if (water[index] === 0 && waterNeighbors >= 7 && elevation[index] < seaLevel + 0.04) next[index] = 1;
  }
  water.set(next);
}

function assignWaterMask(water: Uint8Array, elevation: Float32Array, seaLevel: number): void {
  for (let i = 0; i < elevation.length; i += 1) water[i] = elevation[i] <= seaLevel ? 1 : 0;
}

function smoothFloatLayer(layer: Float32Array, width: number, height: number, passes: number, blend: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(layer);
    for (let index = 0; index < layer.length; index += 1) {
      const neighbors = neighbors8(index, width, height);
      const average = neighbors.reduce((sum, neighbor) => sum + layer[neighbor], layer[index]) / (neighbors.length + 1);
      next[index] = lerp(layer[index], average, blend);
    }
    layer.set(next);
  }
}

function smoothHorizontalSeam(layer: Float32Array, width: number, height: number, radius: number): void {
  const next = new Float32Array(layer);
  for (let y = 0; y < height; y += 1) {
    for (let offset = 0; offset < radius; offset += 1) {
      const leftIndex = layerIndex(offset, y, width);
      const rightIndex = layerIndex(width - 1 - offset, y, width);
      const blend = 1 - offset / radius;
      const average = (layer[leftIndex] + layer[rightIndex]) / 2;
      next[leftIndex] = lerp(layer[leftIndex], average, blend * 0.88);
      next[rightIndex] = lerp(layer[rightIndex], average, blend * 0.88);
    }
  }
  layer.set(next);
}

function softenPolarTerrain(elevation: Float32Array, width: number, height: number): void {
  const next = new Float32Array(elevation);
  const polarRows = Math.max(4, Math.round(height * 0.1));
  for (let y = 0; y < height; y += 1) {
    const distanceFromPole = Math.min(y, height - 1 - y);
    if (distanceFromPole >= polarRows) continue;
    const blend = ((polarRows - distanceFromPole) / polarRows) ** 1.4 * 0.42;
    const bandAverage = averageRow(elevation, y, width);
    for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const localAverage = (
        elevation[layerIndex(wrapX(x - 2, width), y, width)] +
        elevation[layerIndex(wrapX(x - 1, width), y, width)] +
        elevation[index] +
        elevation[layerIndex(wrapX(x + 1, width), y, width)] +
        elevation[layerIndex(wrapX(x + 2, width), y, width)]
      ) / 5;
      next[index] = lerp(elevation[index], lerp(localAverage, bandAverage, 0.24), blend);
    }
  }
  elevation.set(next);
}

function averageRow(layer: Float32Array, y: number, width: number): number {
  let total = 0;
  const start = y * width;
  for (let x = 0; x < width; x += 1) total += layer[start + x];
  return total / width;
}

function smoothBiomeLayer(biomes: Uint8Array, water: Uint8Array, ice: Uint8Array, width: number, height: number): void {
  const next = new Uint8Array(biomes);
  for (let index = 0; index < biomes.length; index += 1) {
    if (water[index] === 1 || ice[index] === 1) continue;
    const counts = new Map<number, number>();
    for (const neighbor of neighbors8(index, width, height)) {
      if (water[neighbor] === 1 || ice[neighbor] === 1) continue;
      counts.set(biomes[neighbor], (counts.get(biomes[neighbor]) ?? 0) + 1);
    }
    let bestBiome = biomes[index];
    let bestCount = 0;
    for (const [biome, count] of counts) {
      if (count > bestCount) {
        bestBiome = biome;
        bestCount = count;
      }
    }
    if (bestCount >= 5) next[index] = bestBiome;
  }
  biomes.set(next);
}

function generateAtmosphericAndOceanFlow(
  windX: Float32Array,
  windY: Float32Array,
  currentX: Float32Array,
  currentY: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  values: SelectedValues,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y += 1) {
    const lat = (y / (height - 1)) * 2 - 1;
    const absLat = Math.abs(lat);
    const hemisphere = lat < 0 ? -1 : 1;
    const cellBand = absLat < 0.33 ? 0 : absLat < 0.66 ? 1 : 2;
    const zonalDirection = cellBand === 1 ? -hemisphere : hemisphere;
    const pressureGradient = cellBand === 0 ? -lat : cellBand === 1 ? hemisphere * 0.5 : -hemisphere * 0.35;
    for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const meander = valueNoise(x / 54, y / 18) * 0.55 + valueNoise(x / 130, y / 36) * 0.35;
      const jet = Math.exp(-((absLat - 0.34) ** 2) / 0.004) + Math.exp(-((absLat - 0.68) ** 2) / 0.006);
      const terrainBlock = clamp(Math.max(0, elevation[index] - 0.25) * 1.35);
      const thermal = normalizeLocalTemperature(temperature[index], values.averageTemperatureC);
      const baseX = zonalDirection * (0.46 + jet * 0.5) + meander * 0.18;
      const baseY = pressureGradient * 0.22 + meander * 0.16 - thermal * 0.08;
      const deflection = terrainGradient(elevation, x, y, width, height);

      windX[index] = clamp(baseX - deflection.x * terrainBlock * 0.7, -1, 1);
      windY[index] = clamp(baseY - deflection.y * terrainBlock * 0.7, -1, 1);

      if (water[index] === 1) {
        const gyreSign = lat < 0 ? -1 : 1;
        const basinCurl = valueNoise(x / 96, y / 64) * 0.22;
        currentX[index] = clamp(windX[index] * 0.55 + gyreSign * Math.cos((y / height) * Math.PI * 2) * 0.22 + basinCurl, -1, 1);
        currentY[index] = clamp(windY[index] * 0.35 - gyreSign * Math.sin((x / width) * Math.PI * 4) * 0.18 + basinCurl * 0.5, -1, 1);
      } else {
        currentX[index] = 0;
        currentY[index] = 0;
      }
    }
  }
}

function applyGlaciationCycles(
  elevation: Float32Array,
  ice: Uint8Array,
  temperature: Float32Array,
  wetness: Float32Array,
  windX: Float32Array,
  windY: Float32Array,
  width: number,
  height: number,
  values: SelectedValues,
  rng: SeededRandom
): void {
  ice.fill(0);
  const age01 = clamp(values.systemAgeGy / 10);
  const cycleCount = Math.max(1, Math.round(lerp(1, 5, age01 + values.orbitalEccentricity * 2)));
  const iceMass = new Float32Array(elevation.length);
  const sediment = new Float32Array(elevation.length);

  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const phase = cycleCount === 1 ? 0.5 : cycle / (cycleCount - 1);
    const cooling = lerp(0.6, 4.8, age01) * (0.42 + Math.sin((phase + 0.15) * Math.PI) * 0.36) + values.orbitalEccentricity * 18;
    iceMass.fill(0);

    for (let i = 0; i < elevation.length; i += 1) {
      const y = Math.floor(i / width);
      const polarLatitude = Math.abs((y / (height - 1)) * 2 - 1);
      const accumulationTemp = temperature[i] - cooling - Math.max(0, elevation[i]) * 10;
      const windExposure = 0.65 + Math.abs(windX[i]) * 0.22 + Math.abs(windY[i]) * 0.13;
      if (accumulationTemp < -3.4 && (polarLatitude > 0.68 || elevation[i] > 0.48)) {
        iceMass[i] = clamp(((-3.4 - accumulationTemp) / 23) * (0.22 + wetness[i] * 0.72) * windExposure);
      }
    }

    for (let step = 0; step < 5; step += 1) {
      const next = new Float32Array(iceMass);
      for (let i = 0; i < iceMass.length; i += 1) {
        if (iceMass[i] <= 0.015) continue;
        const downhill = lowestNeighbor(elevation, i, width, height);
        if (downhill === i) continue;
        const flow = iceMass[i] * 0.34;
        next[i] -= flow;
        next[downhill] += flow * 0.82;
        const scrape = flow * lerp(0.006, 0.026, age01);
        elevation[i] -= scrape;
        elevation[downhill] -= scrape * 0.45;
        sediment[downhill] += scrape * 0.85;
      }
      iceMass.set(next);
    }

    const retreat = lerp(0.42, 0.86, phase);
    for (let i = 0; i < elevation.length; i += 1) {
      if (iceMass[i] > retreat) ice[i] = 1;
      if (sediment[i] > 0) {
        const y = Math.floor(i / width);
        const polarLatitude = Math.abs((y / (height - 1)) * 2 - 1);
        const lowlandDeposit = elevation[i] < 0.18 || polarLatitude > 0.55 ? 0.72 : 0.28;
        elevation[i] += sediment[i] * lowlandDeposit;
        sediment[i] = 0;
      }
    }

    if (rng.next() > 0.5) smoothFloatLayer(elevation, width, height, 1, 0.08);
  }
}

function generateClimate(
  temperature: Float32Array,
  wetness: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  values: SelectedValues,
  tideInfluence: number,
  width: number,
  height: number
): void {
  const oceanInfluence = computeWaterInfluence(water, width, height, 8);
  for (let y = 0; y < height; y += 1) {
    const lat01 = Math.abs((y / (height - 1)) * 2 - 1);
    const latitudeHeat = 1 - lat01;
    const windBand = Math.sin((y / height) * Math.PI * 6);
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      const elev = elevation[i];
      const regionalTempNoise = valueNoise(x / 80, y / 48) * 2.2 + valueNoise(x / 31, y / 29) * 0.9;
      temperature[i] = values.averageTemperatureC + latitudeHeat * 28 - 14 - Math.max(0, elev) * 26 - values.orbitalEccentricity * 16 + regionalTempNoise;
      const oceanProximity = oceanInfluence[i];
      const westMountain = rainShadow(elevation, x, y, width, height);
      const wetBand = Math.max(0, windBand) * 0.2 - Math.max(0, -windBand) * 0.12;
      const continentalDryness = (1 - oceanProximity) * lerp(0.05, 0.24, values.aridity);
      const regionalWetness = valueNoise(x / 54, y / 34) * 0.2 + valueNoise(x / 19, y / 23) * 0.08;
      const baseWet = oceanProximity * 0.58 + (1 - values.aridity) * 0.44 + wetBand + tideInfluence * 0.05;
      const rawWetness = baseWet - westMountain * 1.15 - continentalDryness + regionalWetness;
      wetness[i] = clamp((rawWetness - 0.46) * 1.35 + 0.5);
    }
  }
}

function computeWaterInfluence(water: Uint8Array, width: number, height: number, radius: number): Float32Array {
  const distance = new Float32Array(water.length);
  const maxDistance = radius + 1;
  for (let i = 0; i < water.length; i += 1) distance[i] = water[i] === 1 ? 0 : maxDistance;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      let best = distance[i];
      best = Math.min(best, distance[layerIndex(wrapX(x - 1, width), y, width)] + 1);
      if (y > 0) best = Math.min(best, distance[layerIndex(x, y - 1, width)] + 1);
      distance[i] = best;
    }
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = layerIndex(x, y, width);
      distance[i] = Math.min(distance[i], distance[layerIndex(wrapX(x + 1, width), y, width)] + 1);
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = layerIndex(x, y, width);
      let best = distance[i];
      best = Math.min(best, distance[layerIndex(wrapX(x + 1, width), y, width)] + 1);
      if (y < height - 1) best = Math.min(best, distance[layerIndex(x, y + 1, width)] + 1);
      distance[i] = best;
    }
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      distance[i] = Math.min(distance[i], distance[layerIndex(wrapX(x - 1, width), y, width)] + 1);
    }
  }

  for (let i = 0; i < distance.length; i += 1) distance[i] = clamp(1 - distance[i] / maxDistance);
  return distance;
}

function nearbyWater(water: Uint8Array, x: number, y: number, width: number, height: number, radius: number): number {
  let best = radius + 1;
  for (let oy = -radius; oy <= radius; oy += 1) {
    const yy = y + oy;
    if (yy < 0 || yy >= height) continue;
    for (let ox = -radius; ox <= radius; ox += 1) {
      const xx = wrapX(x + ox, width);
      if (water[layerIndex(xx, yy, width)] === 1) {
        best = Math.min(best, Math.sqrt(ox * ox + oy * oy));
      }
    }
  }
  return clamp(1 - best / (radius + 1));
}

function rainShadow(elevation: Float32Array, x: number, y: number, width: number, height: number): number {
  let shadow = 0;
  for (let ox = 1; ox <= 10; ox += 1) {
    const sample = elevation[layerIndex(wrapX(x - ox, width), y, width)];
    shadow = Math.max(shadow, Math.max(0, sample - 0.28) * (1 - ox / 11));
  }
  if (y > height * 0.4 && y < height * 0.6) shadow *= 0.7;
  return clamp(shadow * 1.5);
}

function generateRivers(
  riverLayer: Float32Array,
  lakes: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  seaLevel: number,
  width: number,
  height: number,
  riverDensity: number,
  rng: SeededRandom
): River[] {
  const density01 = clamp(riverDensity / 5);
  const sourceElevationThreshold = seaLevel + lerp(0.16, 0.025, density01);
  const sourceWetnessThreshold = lerp(0.28, 0.06, density01);
  const candidates = Array.from(elevation.keys())
    .filter((i) => water[i] === 0 && elevation[i] > sourceElevationThreshold && wetness[i] > sourceWetnessThreshold)
    .sort((a, b) => elevation[b] * 1.55 + wetness[b] * 0.75 - (elevation[a] * 1.55 + wetness[a] * 0.75));
  const riverCount = Math.min(180, Math.max(8, Math.round((width * height) / 520 * riverDensity)));
  const rivers: River[] = [];
  const stride = Math.max(1, Math.floor(candidates.length / riverCount));

  for (let r = 0; r < riverCount && r * stride < candidates.length; r += 1) {
    const source = candidates[Math.min(candidates.length - 1, r * stride + rng.int(0, Math.min(stride - 1, 8)))];
    const path = traceRiver(source, elevation, water, wetness, riverLayer, lakes, seaLevel, width, height);
    if (path.path.length > 5) {
      const id = `river-${rivers.length + 1}`;
      for (let j = 0; j < path.path.length; j += 1) riverLayer[path.path[j]] += lerp(1.2, 0.32, j / path.path.length);
      rivers.push({ id, sourceIndex: source, mouthIndex: path.path[path.path.length - 1], path: path.path, terminus: path.terminus });
    }
  }
  return rivers;
}

function traceRiver(
  source: number,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  riverLayer: Float32Array,
  lakes: Uint8Array,
  seaLevel: number,
  width: number,
  height: number
): { path: number[]; terminus: River['terminus'] } {
  const path: number[] = [];
  const seen = new Set<number>();
  let current = source;
  for (let steps = 0; steps < width + height; steps += 1) {
    if (seen.has(current)) return { path, terminus: 'basin' };
    seen.add(current);
    path.push(current);
    if (water[current] === 1) return { path, terminus: 'ocean' };
    if (riverLayer[current] > 0.3 && path.length > 10) return { path, terminus: 'wetland' };
    const neighbors = neighbors8(current, width, height);
    let best = current;
    let bestScore = elevation[current];
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    for (const next of neighbors) {
      const effective = water[next] === 1 ? seaLevel - 0.08 : elevation[next];
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      const channelNoise = valueNoise((nextX + source) / 7, (nextY - source) / 7) * 0.018;
      const score = effective + channelNoise;
      const sameAxisPenalty = nextX === currentX || nextY === currentY ? 0.006 : 0;
      if (effective < elevation[current] && score + sameAxisPenalty < bestScore) {
        best = next;
        bestScore = score + sameAxisPenalty;
      }
    }
    if (best === current) {
      const outlet = carveToNearestOcean(current, elevation, water, wetness, seaLevel, width, height);
      if (outlet.length > 3) {
        normalizeCarvedPath(outlet, elevation, water);
        path.push(...outlet.slice(1));
        return { path, terminus: 'ocean' };
      }
      const spillway = neighbors.reduce((lowest, next) => (elevation[next] < elevation[lowest] ? next : lowest), neighbors[0]);
      if (spillway !== undefined && water[spillway] === 0 && !seen.has(spillway)) {
        lakes[current] = 1;
        elevation[spillway] = Math.min(elevation[spillway], elevation[current] - 0.001);
        current = spillway;
        continue;
      }
      lakes[current] = 1;
      for (const next of neighbors) if (elevation[next] <= elevation[current] + 0.025) lakes[next] = 1;
      return { path, terminus: 'lake' };
    }
    current = best;
  }
  return { path, terminus: 'basin' };
}

function generateFallbackRivers(
  startingCount: number,
  desiredCount: number,
  riverLayer: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  seaLevel: number,
  width: number,
  height: number
): River[] {
  const sources = Array.from(elevation.keys())
    .filter((i) => {
      if (water[i] === 1 || elevation[i] <= seaLevel + 0.035) return false;
      const x = i % width;
      const y = Math.floor(i / width);
      return nearbyWater(water, x, y, width, height, 10) < 0.72;
    })
    .sort((a, b) => elevation[b] * 1.2 + wetness[b] - (elevation[a] * 1.2 + wetness[a]));
  const rivers: River[] = [];
  const remaining = Math.max(0, desiredCount - startingCount);
  const spacing = Math.max(1, Math.floor(sources.length / Math.max(1, remaining)));
  for (let i = 0; i < sources.length && rivers.length < remaining; i += spacing) {
    const source = sources[i];
    const path = carveToNearestOcean(source, elevation, water, wetness, seaLevel, width, height);
    if (path.length > 6) {
      normalizeCarvedPath(path, elevation, water);
      path.forEach((index, step) => {
        riverLayer[index] += lerp(0.9, 0.26, step / path.length);
      });
      rivers.push({
        id: `river-${startingCount + rivers.length + 1}`,
        sourceIndex: source,
        mouthIndex: path[path.length - 1],
        path,
        terminus: 'ocean'
      });
    }
  }
  return rivers;
}

function normalizeCarvedPath(path: number[], elevation: Float32Array, water: Uint8Array): void {
  const sourceElevation = elevation[path[0]];
  for (let i = 1; i < path.length; i += 1) {
    const index = path[i];
    if (water[index] === 1) continue;
    elevation[index] = Math.min(elevation[index], sourceElevation - i * 0.01);
  }
}

function generateEmergencyBasinRiver(
  riverLayer: Float32Array,
  lakes: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  width: number,
  height: number
): River {
  const source = Array.from(elevation.keys())
    .filter((i) => water[i] === 0)
    .sort((a, b) => elevation[b] - elevation[a])[0];
  const sourceX = source % width;
  const sourceY = Math.floor(source / width);
  const path = [source];
  const sourceElevation = elevation[source];
  for (let step = 1; step <= 10; step += 1) {
    const x = wrapX(sourceX + step, width);
    const y = Math.max(0, Math.min(height - 1, sourceY + Math.floor(step / 2)));
    const index = layerIndex(x, y, width);
    if (water[index] === 1) break;
    elevation[index] = sourceElevation - step * 0.015;
    riverLayer[index] = lerp(0.7, 0.2, step / 10);
    path.push(index);
  }
  const mouthIndex = path[path.length - 1];
  lakes[mouthIndex] = 1;
  return {
    id: 'river-1',
    sourceIndex: source,
    mouthIndex,
    path,
    terminus: 'lake'
  };
}

function carveToNearestOcean(
  source: number,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  seaLevel: number,
  width: number,
  height: number
): number[] {
  const sourceX = source % width;
  const sourceY = Math.floor(source / width);
  let target = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < water.length; i += 1) {
    if (water[i] !== 1) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const dx = Math.min(Math.abs(x - sourceX), width - Math.abs(x - sourceX));
    const dy = Math.abs(y - sourceY);
    const distance = dx + dy;
    if (distance < bestDistance && distance > 3) {
      bestDistance = distance;
      target = i;
    }
  }
  if (target < 0) return [];
  const targetX = target % width;
  const targetY = Math.floor(target / width);
  const path: number[] = [source];
  const startElevation = elevation[source];
  const seen = new Set<number>([source]);
  let current = source;
  const maxSteps = width + height;
  for (let step = 1; step < maxSteps; step += 1) {
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    const neighbors = neighbors8(current, width, height).filter((candidate) => !seen.has(candidate));
    const next = neighbors.reduce((best, candidate) => {
      const candidateX = candidate % width;
      const candidateY = Math.floor(candidate / width);
      const bestX = best % width;
      const bestY = Math.floor(best / width);
      const candidateDistance = wrappedManhattan(candidateX, candidateY, targetX, targetY, width);
      const bestDistance = wrappedManhattan(bestX, bestY, targetX, targetY, width);
      const candidateNoise = valueNoise((candidateX + sourceX) / 5, (candidateY + sourceY + step) / 5) * 1.8;
      const bestNoise = valueNoise((bestX + sourceX) / 5, (bestY + sourceY + step) / 5) * 1.8;
      const candidateScore = candidateDistance - wetness[candidate] * 3 + candidateNoise + Math.max(0, elevation[candidate] - elevation[current]) * 16;
      const bestScore = bestDistance - wetness[best] * 3 + bestNoise + Math.max(0, elevation[best] - elevation[current]) * 16;
      return candidateScore < bestScore ? candidate : best;
    }, neighbors[0] ?? current);
    if (next === current) break;
    current = next;
    seen.add(current);

    if (water[current] === 0) {
      elevation[current] = Math.min(elevation[current], startElevation - step * 0.0035);
    } else {
      elevation[current] = Math.min(elevation[current], seaLevel - 0.02);
    }
    path.push(current);
    if (water[current] === 1) return path;
  }
  return path;
}

function wrappedManhattan(ax: number, ay: number, bx: number, by: number, width: number): number {
  return Math.min(Math.abs(ax - bx), width - Math.abs(ax - bx)) + Math.abs(ay - by);
}

function lowestNeighbor(elevation: Float32Array, index: number, width: number, height: number): number {
  const x = index % width;
  const y = Math.floor(index / width);
  let lowest = index;
  for (let oy = -1; oy <= 1; oy += 1) {
    const yy = y + oy;
    if (yy < 0 || yy >= height) continue;
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const next = layerIndex(wrapX(x + ox, width), yy, width);
      if (elevation[next] < elevation[lowest]) lowest = next;
    }
  }
  return lowest;
}

function terrainGradient(elevation: Float32Array, x: number, y: number, width: number, height: number): { x: number; y: number } {
  const left = elevation[layerIndex(wrapX(x - 1, width), y, width)];
  const right = elevation[layerIndex(wrapX(x + 1, width), y, width)];
  const up = elevation[layerIndex(x, Math.max(0, y - 1), width)];
  const down = elevation[layerIndex(x, Math.min(height - 1, y + 1), width)];
  return {
    x: clamp((right - left) * 3, -1, 1),
    y: clamp((down - up) * 3, -1, 1)
  };
}

function normalizeLocalTemperature(temperature: number, averageTemperature: number): number {
  return clamp((temperature - averageTemperature) / 35, -1, 1);
}

function neighbors8(index: number, width: number, height: number): number[] {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const yy = y + oy;
      if (yy < 0 || yy >= height) continue;
      result.push(layerIndex(wrapX(x + ox, width), yy, width));
    }
  }
  return result;
}

function assignBiomes(
  biomes: Uint8Array,
  ice: Uint8Array,
  elevation: Float32Array,
  water: Uint8Array,
  temperature: Float32Array,
  wetness: Float32Array,
  river: Float32Array,
  lakes: Uint8Array,
  seaLevel: number,
  width: number,
  height: number
): void {
  for (let i = 0; i < biomes.length; i += 1) {
    const y = Math.floor(i / width);
    const x = i % width;
    const polarLatitude = Math.abs((y / (height - 1)) * 2 - 1);
    const highMountain = elevation[i] > seaLevel + 0.72;
    const polarTexture = valueNoise(x / 31, y / 13) * 0.035 + valueNoise(x / 83, y / 29) * 0.025;
    const iceLatitude = 0.86 + polarTexture - clamp(wetness[i] - 0.5, -0.18, 0.18) * 0.05;
    const permanentIce = (polarLatitude > iceLatitude && temperature[i] < 0.5) || (temperature[i] < -12 && (polarLatitude > 0.7 || highMountain));
    let biome: Biome;
    if (water[i] === 1) {
      biome = 'ocean';
    } else if (permanentIce) {
      biome = 'ice_cap';
      ice[i] = 1;
    } else if (temperature[i] < 1) {
      biome = 'tundra';
    } else if (lakes[i] || (river[i] > 0.25 && wetness[i] > 0.62)) {
      biome = 'wetland';
    } else if (wetness[i] < 0.22) {
      biome = 'desert';
    } else if (wetness[i] > 0.72 && temperature[i] > 20) {
      biome = 'rainforest';
    } else if (wetness[i] > 0.48) {
      biome = 'forest';
    } else {
      biome = 'grassland';
    }
    biomes[i] = biomeToCode(biome);
  }
}

export function calculateMetrics(world: PrimaryWorld, values: SelectedValues): WorldMetrics {
  const metricLayers = world.topologyLayers?.water?.length ? world.topologyLayers : world.layers;
  const total = metricLayers.water.length;
  const waterCells = count(metricLayers.water, 1);
  const iceCells = count(metricLayers.ice, 1);
  const biomeCounts = Object.fromEntries(biomeNames.map((biome) => [biome, 0])) as Record<Biome, number>;
  for (const code of metricLayers.biomes) biomeCounts[codeToBiome(code)] += 1;
  const oceanPercentage = round((waterCells / total) * 100, 1);
  return {
    oceanPercentage,
    landPercentage: round(100 - oceanPercentage, 1),
    icePercentage: round((iceCells / total) * 100, 1),
    riverCount: world.rivers.length,
    lakeCellCount: count(world.layers.lakes, 1),
    biomeCounts,
    validation: {
      oceanWithinTolerance: Math.abs(oceanPercentage - values.oceanPercentage) <= values.oceanTolerancePercentagePoints,
      riverPathsValid: validateRivers(world)
    }
  };
}

function validateRivers(world: PrimaryWorld): boolean {
  if (world.topologyLayers?.river?.length) return topologyRiverSignal(world);
  return world.rivers.every((river) => isRiverPathValid(river, world.layers.elevation, world.layers.water));
}

function topologyRiverSignal(world: PrimaryWorld): boolean {
  let signal = 0;
  for (const value of world.topologyLayers.river) if (value > 0.05) signal += 1;
  return world.rivers.length === 0 || signal > 0;
}

function isRiverPathValid(river: River, elevation: Float32Array, water: Uint8Array): boolean {
    for (let i = 1; i < river.path.length; i += 1) {
      const prev = river.path[i - 1];
      const next = river.path[i];
    if (water[next] === 1) continue;
    if (elevation[next] > elevation[prev] + 0.0001) return false;
    }
    return true;
}

function count(array: Uint8Array, value: number): number {
  let result = 0;
  for (const item of array) if (item === value) result += 1;
  return result;
}

function valueNoise(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function sphericalNoise(x: number, y: number, z: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function coherentSphericalNoise(x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smoothNoiseStep(x - x0);
  const ty = smoothNoiseStep(y - y0);
  const tz = smoothNoiseStep(z - z0);
  let value = 0;
  for (let dz = 0; dz <= 1; dz += 1) {
    for (let dy = 0; dy <= 1; dy += 1) {
      for (let dx = 0; dx <= 1; dx += 1) {
        const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
        value += latticeNoise3(x0 + dx, y0 + dy, z0 + dz) * weight;
      }
    }
  }
  return value;
}

function smoothNoiseStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function latticeNoise3(x: number, y: number, z: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function quickSelect(values: number[], target: number): number {
  let left = 0;
  let right = values.length - 1;
  while (left < right) {
    const pivotIndex = partition(values, left, right, Math.floor((left + right) / 2));
    if (target === pivotIndex) return values[target];
    if (target < pivotIndex) right = pivotIndex - 1;
    else left = pivotIndex + 1;
  }
  return values[left];
}

function partition(values: number[], left: number, right: number, pivotIndex: number): number {
  const pivotValue = values[pivotIndex];
  swap(values, pivotIndex, right);
  let storeIndex = left;
  for (let i = left; i < right; i += 1) {
    if (values[i] < pivotValue) {
      swap(values, storeIndex, i);
      storeIndex += 1;
    }
  }
  swap(values, right, storeIndex);
  return storeIndex;
}

function swap(values: number[], a: number, b: number): void {
  const temp = values[a];
  values[a] = values[b];
  values[b] = temp;
}
