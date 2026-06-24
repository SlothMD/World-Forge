export type Projection = 'equirectangular';
export type WrapMode = 'east-west';

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
  averageTemperatureC: { min: 6, max: 20, unit: 'C' },
  aridity: { min: 0.35, max: 0.65 },
  seaLevel: { min: -0.08, max: 0.08 },
  axialTiltDeg: { min: 10, max: 32, unit: 'deg' },
  orbitalEccentricity: { min: 0, max: 0.08 },
  sizeClass: { min: 0.85, max: 1.15 },
  moonCount: { min: 0, max: 3 }
};

export function createDefaultConfig(seed = 'earthlike-default-001', resolution: Resolution = { width: 512, height: 256 }): GenerationConfig {
  return {
    seed,
    parameterRanges: defaultParameterRanges,
    generationProfile: 'earthlike-mvp',
    outputResolution: resolution,
    projection: 'equirectangular',
    wrapMode: 'east-west'
  };
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
