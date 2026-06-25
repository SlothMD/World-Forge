import {
  Biome,
  GenerationConfig,
  GenerationDiagnostics,
  Moon,
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
  clamp,
  codeToBiome,
  createDefaultConfig,
  defaultParameterRanges,
  layerIndex,
  lerp,
  wrapX
} from '@world-forge/shared';
import { SeededRandom } from './random';

export { SeededRandom, createDefaultConfig, defaultParameterRanges };

const generatorVersion = '0.1.0-mvp';

type DiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
  snapshot(): GenerationDiagnostics;
};

function createDiagnosticsRecorder(): DiagnosticsRecorder {
  const startedAt = nowMs();
  const phases: GenerationDiagnostics['phases'] = [];
  return {
    measure<T>(name: string, fn: () => T): T {
      const phaseStart = nowMs();
      try {
        return fn();
      } finally {
        phases.push({ name, ms: round(nowMs() - phaseStart, 3) });
      }
    },
    snapshot(): GenerationDiagnostics {
      return {
        totalMs: round(nowMs() - startedAt, 3),
        phases
      };
    }
  };
}

export function generateProject(input: Partial<GenerationConfig> = {}): WorldProject {
  const diagnostics = createDiagnosticsRecorder();
  const config: GenerationConfig = {
    ...createDefaultConfig(input.seed ?? `seed-${Date.now()}`),
    ...input,
    parameterRanges: input.parameterRanges ?? defaultParameterRanges
  };
  const rng = new SeededRandom(config.seed);
  const selectedValues = diagnostics.measure('select-values', () => selectValues(config, rng));
  const solarSystem = diagnostics.measure('solar-system', () => generateSolarSystem(config.seed, selectedValues, rng));
  const primaryWorld = diagnostics.measure('primary-world', () => generatePrimaryWorld(config, selectedValues, solarSystem, rng, diagnostics));
  const metrics = diagnostics.measure('metrics', () => calculateMetrics(primaryWorld, selectedValues));
  const now = '2026-06-24T00:00:00.000Z';

  return {
    projectId: `project-${config.seed}`,
    projectName: primaryWorld.name,
    createdAt: now,
    updatedAt: now,
    appVersion: '0.1.0',
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
  diagnostics: DiagnosticsRecorder
): PrimaryWorld {
  const { width, height } = config.outputResolution;
  const cellCount = width * height;
  const elevation = new Float32Array(cellCount);
  const water = new Uint8Array(cellCount);
  const platesLayer = new Uint16Array(cellCount);
  const temperature = new Float32Array(cellCount);
  const wetness = new Float32Array(cellCount);
  const biomes = new Uint8Array(cellCount);
  const ice = new Uint8Array(cellCount);
  const river = new Float32Array(cellCount);
  const lakes = new Uint8Array(cellCount);
  const windX = new Float32Array(cellCount);
  const windY = new Float32Array(cellCount);
  const currentX = new Float32Array(cellCount);
  const currentY = new Float32Array(cellCount);
  const plates = createPlates(width, height, rng);
  const primaryBody = solarSystem.bodies.find((body) => body.isPrimaryWorld);
  const moons = primaryBody?.moons ?? [];
  const tideInfluence = round(clamp(moons.reduce((sum, moon) => sum + moon.tideInfluence, 0), 0, 2), 2);

  diagnostics.measure('plates.assign', () => assignPlateLayer(platesLayer, plates, width, height));
  diagnostics.measure('terrain.elevation', () => generateElevation(elevation, platesLayer, plates, width, height, rng));
  diagnostics.measure('terrain.aging', () => applyTerrainAging(elevation, width, height, values.systemAgeGy, values.impactFrequency, rng, diagnostics));
  let seaLevel = diagnostics.measure('water.sea-level.initial', () => findSeaLevelForOceanTarget(elevation, values.oceanPercentage, values.seaLevel));
  diagnostics.measure('terrain.coastal-shelves', () => shapeCoastalShelves(elevation, width, height, seaLevel, clamp(values.systemAgeGy / 10)));
  seaLevel = diagnostics.measure('water.sea-level.shelf', () => findSeaLevelForOceanTarget(elevation, values.oceanPercentage, values.seaLevel));
  diagnostics.measure('water.mask.initial', () => {
    assignWaterMask(water, elevation, seaLevel);
    smoothWaterMask(water, elevation, seaLevel, width, height);
  });
  diagnostics.measure('climate.initial', () => generateClimate(temperature, wetness, elevation, water, values, tideInfluence, width, height));
  diagnostics.measure('flow.initial', () => generateAtmosphericAndOceanFlow(windX, windY, currentX, currentY, elevation, water, temperature, values, width, height));
  diagnostics.measure('terrain.glaciation', () => applyGlaciationCycles(elevation, ice, temperature, wetness, windX, windY, width, height, values, rng));
  seaLevel = diagnostics.measure('water.sea-level.final', () => findSeaLevelForOceanTarget(elevation, values.oceanPercentage, values.seaLevel));
  diagnostics.measure('water.mask.final', () => {
    assignWaterMask(water, elevation, seaLevel);
    smoothWaterMask(water, elevation, seaLevel, width, height);
  });
  diagnostics.measure('climate.final', () => generateClimate(temperature, wetness, elevation, water, values, tideInfluence, width, height));
  diagnostics.measure('flow.final', () => generateAtmosphericAndOceanFlow(windX, windY, currentX, currentY, elevation, water, temperature, values, width, height));
  diagnostics.measure('wetness.smooth', () => smoothFloatLayer(wetness, width, height, 2, 0.55));
  let rivers = diagnostics.measure('hydrology.rivers', () => generateRivers(river, lakes, elevation, water, wetness, seaLevel, width, height, rng)).filter((candidate) =>
    isRiverPathValid(candidate, elevation, water)
  );
  if (rivers.length < 6) {
    diagnostics.measure('hydrology.fallback', () => {
      rivers.push(...generateFallbackRivers(rivers.length, river, elevation, water, wetness, seaLevel, width, height));
    });
  }
  rivers = rivers.filter((candidate) => isRiverPathValid(candidate, elevation, water));
  if (rivers.length === 0) {
    diagnostics.measure('hydrology.emergency', () => {
      rivers.push(generateEmergencyBasinRiver(river, lakes, elevation, water, width, height));
    });
  }
  diagnostics.measure('biomes.assign', () => assignBiomes(biomes, ice, elevation, water, temperature, wetness, river, lakes, seaLevel, width, height));
  diagnostics.measure('biomes.smooth', () => smoothBiomeLayer(biomes, water, ice, width, height));

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
    plates,
    rivers,
    layers: { elevation, water, plates: platesLayer, temperature, wetness, biomes, ice, river, lakes, windX, windY, currentX, currentY }
  };
}

function createPlates(width: number, height: number, rng: SeededRandom): Plate[] {
  const plateCount = Math.max(12, Math.min(28, Math.round(Math.sqrt(width * height) / 18)));
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
  rng: SeededRandom,
  diagnostics: DiagnosticsRecorder
): void {
  const age01 = clamp(ageGy / 10);
  diagnostics.measure('terrain.aging.impacts', () => applyAsteroidImpacts(elevation, width, height, age01, impactFrequency, rng));
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

        if (distance <= radius) {
          const inner01 = distance / radius;
          const bowl = (1 - inner01) ** 2;
          const innerRim = Math.max(0, 1 - Math.abs(inner01 - 0.86) / 0.14);
          elevation[index] += innerRim * depth * 0.38 - bowl * depth;
        } else {
          const outer01 = (distance - radius) / rimWidth;
          elevation[index] += (1 - outer01) ** 2 * depth * 0.22;
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
      temperature[i] = values.averageTemperatureC + latitudeHeat * 30 - 15 - Math.max(0, elev) * 28 - values.orbitalEccentricity * 18;
      const oceanProximity = oceanInfluence[i];
      const westMountain = rainShadow(elevation, x, y, width, height);
      const baseWet = oceanProximity * 0.52 + (1 - values.aridity) * 0.42 + Math.max(0, windBand) * 0.18 + tideInfluence * 0.05;
      wetness[i] = clamp(baseWet - westMountain + valueNoise(x / 24, y / 24) * 0.16);
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
  rng: SeededRandom
): River[] {
  const candidates = Array.from(elevation.keys())
    .filter((i) => water[i] === 0 && elevation[i] > seaLevel + 0.08 && wetness[i] > 0.28)
    .sort((a, b) => elevation[b] + wetness[b] - (elevation[a] + wetness[a]));
  const riverCount = Math.min(70, Math.max(12, Math.round((width * height) / 650)));
  const rivers: River[] = [];
  const stride = Math.max(1, Math.floor(candidates.length / riverCount));

  for (let r = 0; r < riverCount && r * stride < candidates.length; r += 1) {
    const source = candidates[Math.min(candidates.length - 1, r * stride + rng.int(0, Math.min(stride - 1, 8)))];
    const path = traceRiver(source, elevation, water, riverLayer, lakes, seaLevel, width, height);
    if (path.path.length > 4) {
      const id = `river-${rivers.length + 1}`;
      for (let j = 0; j < path.path.length; j += 1) riverLayer[path.path[j]] += lerp(0.7, 0.18, j / path.path.length);
      rivers.push({ id, sourceIndex: source, mouthIndex: path.path[path.path.length - 1], path: path.path, terminus: path.terminus });
    }
  }
  return rivers;
}

function traceRiver(
  source: number,
  elevation: Float32Array,
  water: Uint8Array,
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
  riverLayer: Float32Array,
  elevation: Float32Array,
  water: Uint8Array,
  wetness: Float32Array,
  seaLevel: number,
  width: number,
  height: number
): River[] {
  const sources = Array.from(elevation.keys())
    .filter((i) => water[i] === 0)
    .sort((a, b) => elevation[b] + wetness[b] - (elevation[a] + wetness[a]));
  const rivers: River[] = [];
  const spacing = Math.max(1, Math.floor(sources.length / 6));
  for (let i = 0; i < sources.length && rivers.length < 6 - startingCount; i += spacing) {
    const source = sources[i];
    const path = carveToNearestOcean(source, elevation, water, wetness, seaLevel, width, height);
    if (path.length > 4) {
      normalizeCarvedPath(path, elevation, water);
      path.forEach((index, step) => {
        riverLayer[index] += lerp(0.65, 0.18, step / path.length);
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
    const polarLatitude = Math.abs((y / (height - 1)) * 2 - 1);
    const highMountain = elevation[i] > seaLevel + 0.72;
    const permanentIce = (polarLatitude > 0.86 && temperature[i] < 0.5) || (temperature[i] < -12 && (polarLatitude > 0.7 || highMountain));
    let biome: Biome;
    if (water[i] === 1) {
      biome = 'ocean';
    } else if (permanentIce) {
      biome = 'ice_cap';
      ice[i] = 1;
    } else if (temperature[i] < 1) {
      biome = 'tundra';
    } else if (elevation[i] > seaLevel + 0.48) {
      biome = 'mountain';
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
  const total = world.layers.water.length;
  const waterCells = count(world.layers.water, 1);
  const iceCells = count(world.layers.ice, 1);
  const biomeCounts = Object.fromEntries(biomeNames.map((biome) => [biome, 0])) as Record<Biome, number>;
  for (const code of world.layers.biomes) biomeCounts[codeToBiome(code)] += 1;
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
  return world.rivers.every((river) => isRiverPathValid(river, world.layers.elevation, world.layers.water));
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
