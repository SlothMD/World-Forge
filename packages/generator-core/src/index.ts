import {
  Biome,
  GenerationConfig,
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

export function generateProject(input: Partial<GenerationConfig> = {}): WorldProject {
  const config: GenerationConfig = {
    ...createDefaultConfig(input.seed ?? `seed-${Date.now()}`),
    ...input,
    parameterRanges: input.parameterRanges ?? defaultParameterRanges
  };
  const rng = new SeededRandom(config.seed);
  const selectedValues = selectValues(config, rng);
  const solarSystem = generateSolarSystem(config.seed, selectedValues, rng);
  const primaryWorld = generatePrimaryWorld(config, selectedValues, solarSystem, rng);
  const metrics = calculateMetrics(primaryWorld, selectedValues);
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
    oceanTolerancePercentagePoints: 5
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
  rng: SeededRandom
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
  const plates = createPlates(width, height, rng);
  const primaryBody = solarSystem.bodies.find((body) => body.isPrimaryWorld);
  const moons = primaryBody?.moons ?? [];
  const tideInfluence = round(clamp(moons.reduce((sum, moon) => sum + moon.tideInfluence, 0), 0, 2), 2);

  assignPlateLayer(platesLayer, plates, width, height);
  generateElevation(elevation, platesLayer, plates, width, height, rng);
  const seaLevel = findSeaLevelForOceanTarget(elevation, values.oceanPercentage, values.seaLevel);
  for (let i = 0; i < cellCount; i += 1) water[i] = elevation[i] <= seaLevel ? 1 : 0;
  generateClimate(temperature, wetness, elevation, water, values, tideInfluence, width, height);
  let rivers = generateRivers(river, lakes, elevation, water, wetness, seaLevel, width, height, rng).filter((candidate) =>
    isRiverPathValid(candidate, elevation, water)
  );
  if (rivers.length < 6) {
    rivers.push(...generateFallbackRivers(rivers.length, river, elevation, water, wetness, seaLevel, width, height));
  }
  rivers = rivers.filter((candidate) => isRiverPathValid(candidate, elevation, water));
  if (rivers.length === 0) {
    rivers.push(generateEmergencyBasinRiver(river, lakes, elevation, water, width, height));
  }
  assignBiomes(biomes, ice, elevation, water, temperature, wetness, river, lakes, seaLevel);

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
    layers: { elevation, water, plates: platesLayer, temperature, wetness, biomes, ice, river, lakes }
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
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = plates[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const plate of plates) {
        const dx = Math.min(Math.abs(x - plate.centerX), width - Math.abs(x - plate.centerX));
        const dy = y - plate.centerY;
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
      const detail = valueNoise(nx * 9.5 + phaseB, ny * 9.5 + phaseA) * 0.22;
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
        const convergence = a.motionX * -b.motionX + a.motionY * -b.motionY;
        const uplift = convergence > 0 ? 0.33 : -0.1;
        const radius = convergence > 0 ? 3 : 2;
        for (let oy = -radius; oy <= radius; oy += 1) {
          for (let ox = -radius; ox <= radius; ox += 1) {
            const yy = y + oy;
            if (yy < 0 || yy >= height) continue;
            const xx = wrapX(x + ox, width);
            const target = layerIndex(xx, yy, width);
            const falloff = 1 - Math.min(1, Math.sqrt(ox * ox + oy * oy) / (radius + 0.1));
            elevation[target] += uplift * falloff;
          }
        }
      }
    }
  }
}

function findSeaLevelForOceanTarget(elevation: Float32Array, oceanTarget: number, adjustment: number): number {
  const sorted = Array.from(elevation).sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((oceanTarget / 100) * sorted.length)));
  return sorted[index] + adjustment * 0.01;
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
  for (let y = 0; y < height; y += 1) {
    const lat01 = Math.abs((y / (height - 1)) * 2 - 1);
    const latitudeHeat = 1 - lat01;
    const windBand = Math.sin((y / height) * Math.PI * 6);
    for (let x = 0; x < width; x += 1) {
      const i = layerIndex(x, y, width);
      const elev = elevation[i];
      temperature[i] = values.averageTemperatureC + latitudeHeat * 30 - 15 - Math.max(0, elev) * 28 - values.orbitalEccentricity * 18;
      const oceanProximity = nearbyWater(water, x, y, width, height, 8);
      const westMountain = rainShadow(elevation, x, y, width, height);
      const baseWet = oceanProximity * 0.52 + (1 - values.aridity) * 0.42 + Math.max(0, windBand) * 0.18 + tideInfluence * 0.05;
      wetness[i] = clamp(baseWet - westMountain + valueNoise(x / 24, y / 24) * 0.16);
    }
  }
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
    let bestElevation = elevation[current];
    for (const next of neighbors) {
      const effective = water[next] === 1 ? seaLevel - 0.08 : elevation[next];
      if (effective < bestElevation) {
        best = next;
        bestElevation = effective;
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
    const path = carveToNearestOcean(source, elevation, water, seaLevel, width, height);
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
  let x = sourceX;
  let y = sourceY;
  const path: number[] = [source];
  const startElevation = elevation[source];
  const maxSteps = width + height;
  for (let step = 1; step < maxSteps; step += 1) {
    if (x !== targetX) {
      const rightDistance = wrapX(targetX - x, width);
      const leftDistance = wrapX(x - targetX, width);
      x = wrapX(x + (rightDistance <= leftDistance ? 1 : -1), width);
    }
    if (y !== targetY && (step % 2 === 0 || x === targetX)) {
      y += targetY > y ? 1 : -1;
      y = Math.max(0, Math.min(height - 1, y));
    }
    const index = layerIndex(x, y, width);
    if (water[index] === 0) {
      elevation[index] = Math.min(elevation[index], startElevation - step * 0.003);
    } else {
      elevation[index] = Math.min(elevation[index], seaLevel - 0.02);
    }
    path.push(index);
    if (water[index] === 1) return path;
  }
  return path;
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
  seaLevel: number
): void {
  for (let i = 0; i < biomes.length; i += 1) {
    let biome: Biome;
    if (water[i] === 1) {
      biome = 'ocean';
    } else if (temperature[i] < -6) {
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
