export type Projection = 'equirectangular';
export type WrapMode = 'east-west';
export type TopologyKind = 'cubed-sphere';

export type NumericRange = {
  min: number;
  max: number;
  unit?: string;
};

export type ParameterRanges = {
  systemAgeGy: NumericRange;
  oceanPercentage: NumericRange;
  averageTemperatureC: NumericRange;
  aridity: NumericRange;
  seaLevel: NumericRange;
  axialTiltDeg: NumericRange;
  orbitalEccentricity: NumericRange;
  sizeClass: NumericRange;
  moonCount: NumericRange;
  impactFrequency: NumericRange;
  plateCount: NumericRange;
  riverDensity: NumericRange;
  continentCount: NumericRange;
  continentScale: NumericRange;
  islandDensity: NumericRange;
};

export type SelectedValues = {
  systemAgeGy: number;
  oceanPercentage: number;
  averageTemperatureC: number;
  aridity: number;
  seaLevel: number;
  axialTiltDeg: number;
  orbitalEccentricity: number;
  sizeClass: number;
  moonCount: number;
  impactFrequency: number;
  plateCount: number;
  riverDensity: number;
  continentCount: number;
  continentScale: number;
  islandDensity: number;
  oceanTolerancePercentagePoints: number;
};

export type GenerationConfig = {
  seed: string;
  parameterRanges: ParameterRanges;
  selectedValues?: Partial<SelectedValues>;
  generationProfile: 'earthlike-mvp';
  outputResolution: Resolution;
  projection: Projection;
  wrapMode: WrapMode;
};

export type Resolution = {
  width: number;
  height: number;
};

export type Star = {
  id: string;
  type: string;
  massClass: string;
  luminosityClass: string;
  ageGy: number;
  colorTemperatureClass: string;
};

export type Moon = {
  id: string;
  name: string;
  sizeClass: number;
  orbitalDistanceClass: number;
  tideInfluence: number;
};

export type SystemBody = {
  id: string;
  bodyType: 'rocky' | 'gas-giant' | 'ice-giant' | 'dwarf' | 'belt';
  orbitalOrder: number;
  orbitalDistanceClass: number;
  eccentricity: number;
  sizeClass: number;
  massClass: number;
  visibleFromPrimary: boolean;
  isPrimaryWorld: boolean;
  moons: Moon[];
};

export type SolarSystem = {
  star: Star;
  ageGy: number;
  bodies: SystemBody[];
  primaryWorldId: string;
  visibleBodiesFromPrimary: string[];
  generatedNotes: string[];
};

export type Biome =
  | 'ocean'
  | 'ice_cap'
  | 'tundra'
  | 'desert'
  | 'grassland'
  | 'forest'
  | 'rainforest'
  | 'mountain'
  | 'wetland';

export type PlateKind = 'oceanic' | 'continental';

export type Plate = {
  id: number;
  kind: PlateKind;
  centerX: number;
  centerY: number;
  motionX: number;
  motionY: number;
};

export type WorldTopologySummary = {
  kind: TopologyKind;
  resolution: number;
  cellCount: number;
};

export type CubedSphereTopology = WorldTopologySummary & {
  positions: Float32Array;
  latitudes: Float32Array;
  longitudes: Float32Array;
  areaWeights: Float32Array;
  neighbors: Int32Array;
};

export type River = {
  id: string;
  path: number[];
  sourceIndex: number;
  mouthIndex: number;
  terminus: 'ocean' | 'basin' | 'lake' | 'wetland';
};

export type MapLayers = {
  elevation: Float32Array;
  water: Uint8Array;
  plates: Uint16Array;
  temperature: Float32Array;
  wetness: Float32Array;
  biomes: Uint8Array;
  ice: Uint8Array;
  river: Float32Array;
  lakes: Uint8Array;
  windX: Float32Array;
  windY: Float32Array;
  currentX: Float32Array;
  currentY: Float32Array;
};

export type TopologyLayers = {
  elevation: Float32Array;
  plates: Uint16Array;
  water: Uint8Array;
  temperature: Float32Array;
  wetness: Float32Array;
  biomes: Uint8Array;
  ice: Uint8Array;
  river: Float32Array;
  lakes: Uint8Array;
};

export type SerializableLayer = {
  layerId: string;
  layerType: keyof MapLayers;
  resolution: Resolution;
  projection: Projection;
  dataEncoding: 'float32-array' | 'uint8-array' | 'uint16-array';
  minValue: number;
  maxValue: number;
  units?: string;
  data: number[];
};

export type SerializableTopologyLayer = {
  layerId: string;
  layerType: keyof TopologyLayers;
  topologyKind: TopologyKind;
  topologyResolution: number;
  dataEncoding: 'float32-array' | 'uint8-array' | 'uint16-array';
  minValue: number;
  maxValue: number;
  units?: string;
  data: number[];
};

export type PrimaryWorld = {
  id: string;
  name: string;
  sizeClass: number;
  massClass: number;
  oceanPercentage: number;
  seaLevel: number;
  axialTiltDeg: number;
  orbitalEccentricity: number;
  averageTemperatureC: number;
  aridity: number;
  tideInfluence: number;
  mapModel: {
    resolution: Resolution;
    projection: Projection;
    wrapMode: WrapMode;
  };
  topology: WorldTopologySummary;
  topologyLayers: TopologyLayers;
  plates: Plate[];
  rivers: River[];
  layers: MapLayers;
};

export type WorldMetrics = {
  oceanPercentage: number;
  landPercentage: number;
  icePercentage: number;
  riverCount: number;
  lakeCellCount: number;
  biomeCounts: Record<Biome, number>;
  validation: {
    oceanWithinTolerance: boolean;
    riverPathsValid: boolean;
  };
};

export type GenerationDiagnostics = {
  totalMs: number;
  phases: Array<{
    name: string;
    ms: number;
  }>;
};

export type WorldProject = {
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  generatorVersion: string;
  seed: string;
  config: GenerationConfig;
  selectedValues: SelectedValues;
  solarSystem: SolarSystem;
  primaryWorld: PrimaryWorld;
  metrics: WorldMetrics;
  diagnostics?: GenerationDiagnostics;
  exports: {
    packageExtension: '.wforge';
    supportedFormats: Array<'png' | 'svg' | 'json' | 'wforge'>;
  };
};

export const biomeNames: Biome[] = [
  'ocean',
  'ice_cap',
  'tundra',
  'desert',
  'grassland',
  'forest',
  'rainforest',
  'mountain',
  'wetland'
];

export function biomeToCode(biome: Biome): number {
  return biomeNames.indexOf(biome);
}

export function codeToBiome(code: number): Biome {
  return biomeNames[Math.max(0, Math.min(biomeNames.length - 1, code))];
}

export const defaultParameterRanges: ParameterRanges = {
  systemAgeGy: { min: 2.5, max: 7.5, unit: 'Gy' },
  oceanPercentage: { min: 45, max: 72, unit: '%' },
  averageTemperatureC: { min: 10, max: 22, unit: 'C' },
  aridity: { min: 0.35, max: 0.65 },
  seaLevel: { min: -0.08, max: 0.08 },
  axialTiltDeg: { min: 10, max: 32, unit: 'deg' },
  orbitalEccentricity: { min: 0, max: 0.08 },
  sizeClass: { min: 0.85, max: 1.15 },
  moonCount: { min: 0, max: 3 },
  impactFrequency: { min: 0.6, max: 1.4 },
  plateCount: { min: 16, max: 28 },
  riverDensity: { min: 1.2, max: 2.2 },
  continentCount: { min: 3, max: 7 },
  continentScale: { min: 0.45, max: 0.65 },
  islandDensity: { min: 0.25, max: 0.55 }
};

export const parameterControlBounds: ParameterRanges = {
  systemAgeGy: { min: 0.5, max: 12, unit: 'Gy' },
  oceanPercentage: { min: 15, max: 90, unit: '%' },
  averageTemperatureC: { min: -18, max: 34, unit: 'C' },
  aridity: { min: 0.05, max: 0.95 },
  seaLevel: { min: -0.2, max: 0.2 },
  axialTiltDeg: { min: 0, max: 60, unit: 'deg' },
  orbitalEccentricity: { min: 0, max: 0.2 },
  sizeClass: { min: 0.45, max: 1.8 },
  moonCount: { min: 0, max: 6 },
  impactFrequency: { min: 0, max: 3 },
  plateCount: { min: 8, max: 48 },
  riverDensity: { min: 0.2, max: 5 },
  continentCount: { min: 1, max: 12 },
  continentScale: { min: 0, max: 1 },
  islandDensity: { min: 0, max: 1 }
};

export function createDefaultConfig(seed = 'earthlike-default-001', resolution: Resolution = { width: 512, height: 256 }): GenerationConfig {
  return {
    seed,
    parameterRanges: cloneParameterRanges(defaultParameterRanges),
    generationProfile: 'earthlike-mvp',
    outputResolution: resolution,
    projection: 'equirectangular',
    wrapMode: 'east-west'
  };
}

export function cloneParameterRanges(ranges: ParameterRanges): ParameterRanges {
  return Object.fromEntries(Object.entries(ranges).map(([key, range]) => [key, { ...range }])) as ParameterRanges;
}

export function layerIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function wrapX(x: number, width: number): number {
  return ((x % width) + width) % width;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min));
}

export function buildCubedSphereTopology(resolution: number): CubedSphereTopology {
  const size = Math.max(2, Math.round(resolution));
  const cellCount = 6 * size * size;
  const positions = new Float32Array(cellCount * 3);
  const latitudes = new Float32Array(cellCount);
  const longitudes = new Float32Array(cellCount);
  const areaWeights = new Float32Array(cellCount);
  const neighbors = new Int32Array(cellCount * 4);

  for (let face = 0; face < 6; face += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = cubedSphereCellIndex(face, x, y, size);
        const u = ((x + 0.5) / size) * 2 - 1;
        const v = ((y + 0.5) / size) * 2 - 1;
        const position = cubeFaceToUnitVector(face, u, v);
        positions[index * 3] = position.x;
        positions[index * 3 + 1] = position.y;
        positions[index * 3 + 2] = position.z;
        latitudes[index] = Math.asin(position.y);
        longitudes[index] = Math.atan2(position.z, position.x);
        areaWeights[index] = 1 / Math.pow(1 + u * u + v * v, 1.5);
      }
    }
  }

  for (let face = 0; face < 6; face += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = cubedSphereCellIndex(face, x, y, size);
        const offset = index * 4;
        neighbors[offset] = cubedSphereNeighbor(face, x - 1, y, size, positions);
        neighbors[offset + 1] = cubedSphereNeighbor(face, x + 1, y, size, positions);
        neighbors[offset + 2] = cubedSphereNeighbor(face, x, y - 1, size, positions);
        neighbors[offset + 3] = cubedSphereNeighbor(face, x, y + 1, size, positions);
      }
    }
  }

  return {
    kind: 'cubed-sphere',
    resolution: size,
    cellCount,
    positions,
    latitudes,
    longitudes,
    areaWeights,
    neighbors
  };
}

export function cubedSphereCellIndex(face: number, x: number, y: number, resolution: number): number {
  return face * resolution * resolution + y * resolution + x;
}

export function cubedSphereCellForLonLat(topology: CubedSphereTopology, longitude: number, latitude: number): number {
  const cosLat = Math.cos(latitude);
  const x = cosLat * Math.cos(longitude);
  const y = Math.sin(latitude);
  const z = cosLat * Math.sin(longitude);
  return cubedSphereCellForVector(topology, x, y, z);
}

export function cubedSphereCellForVector(topology: CubedSphereTopology, x: number, y: number, z: number): number {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  const absZ = Math.abs(z);
  let face = 0;
  let u = 0;
  let v = 0;
  if (absX >= absY && absX >= absZ) {
    if (x >= 0) {
      face = 0;
      u = -z / absX;
      v = y / absX;
    } else {
      face = 1;
      u = z / absX;
      v = y / absX;
    }
  } else if (absY >= absX && absY >= absZ) {
    if (y >= 0) {
      face = 2;
      u = x / absY;
      v = -z / absY;
    } else {
      face = 3;
      u = x / absY;
      v = z / absY;
    }
  } else if (z >= 0) {
    face = 4;
    u = x / absZ;
    v = y / absZ;
  } else {
    face = 5;
    u = -x / absZ;
    v = y / absZ;
  }
  const size = topology.resolution;
  const cellX = Math.max(0, Math.min(size - 1, Math.floor(((u + 1) / 2) * size)));
  const cellY = Math.max(0, Math.min(size - 1, Math.floor(((v + 1) / 2) * size)));
  return cubedSphereCellIndex(face, cellX, cellY, size);
}

function cubedSphereNeighbor(face: number, x: number, y: number, resolution: number, positions: Float32Array): number {
  if (x >= 0 && x < resolution && y >= 0 && y < resolution) return cubedSphereCellIndex(face, x, y, resolution);

  const clampedX = Math.max(0, Math.min(resolution - 1, x));
  const clampedY = Math.max(0, Math.min(resolution - 1, y));
  const edgeIndex = cubedSphereCellIndex(face, clampedX, clampedY, resolution);
  const px = positions[edgeIndex * 3];
  const py = positions[edgeIndex * 3 + 1];
  const pz = positions[edgeIndex * 3 + 2];
  const step = 2 / resolution;
  const centerOffsetX = x < 0 ? -step : x >= resolution ? step : 0;
  const centerOffsetY = y < 0 ? -step : y >= resolution ? step : 0;
  return nearestCubedSphereCell(px + centerOffsetX, py + centerOffsetY, pz, resolution);
}

function nearestCubedSphereCell(x: number, y: number, z: number, resolution: number): number {
  const length = Math.max(0.000001, Math.sqrt(x * x + y * y + z * z));
  const topologyStub = { kind: 'cubed-sphere' as const, resolution, cellCount: 6 * resolution * resolution } as CubedSphereTopology;
  return cubedSphereCellForVector(topologyStub, x / length, y / length, z / length);
}

function cubeFaceToUnitVector(face: number, u: number, v: number): { x: number; y: number; z: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  if (face === 0) {
    x = 1;
    y = v;
    z = -u;
  } else if (face === 1) {
    x = -1;
    y = v;
    z = u;
  } else if (face === 2) {
    x = u;
    y = 1;
    z = -v;
  } else if (face === 3) {
    x = u;
    y = -1;
    z = v;
  } else if (face === 4) {
    x = u;
    y = v;
    z = 1;
  } else {
    x = -u;
    y = v;
    z = -1;
  }
  const length = Math.sqrt(x * x + y * y + z * z);
  return { x: x / length, y: y / length, z: z / length };
}
