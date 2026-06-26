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

export type HexTileBiome = 'marine' | 'tundra' | 'grassland' | 'plains' | 'desert' | 'tropical';
export type HexTileMorphology = 'flat' | 'rough' | 'mountainous' | 'navigable-river' | 'coastal' | 'ocean' | 'lake';
export type HexTileFeature = 'vegetated' | 'wet' | 'floodplain' | 'river' | 'snow' | 'ice' | 'aquatic';

export type HexTileProfile = {
  id: string;
  label: string;
  description: string;
  biomes: HexTileBiome[];
  morphologies: HexTileMorphology[];
  features: HexTileFeature[];
};

export type HexTileMapPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  note: string;
};

export type HexTileExportConfig = {
  width: number;
  height: number;
  profileId: string;
  enabledBiomes?: HexTileBiome[];
  enabledMorphologies?: HexTileMorphology[];
  enabledFeatures?: HexTileFeature[];
};

export type HexTile = {
  id: string;
  q: number;
  r: number;
  longitude: number;
  latitude: number;
  topologyCell: number;
  biome: HexTileBiome;
  morphology: HexTileMorphology;
  terrainType: string;
  features: HexTileFeature[];
  elevation: number;
  temperatureC: number;
  wetness: number;
  water: boolean;
};

export type HexTileMap = {
  format: 'world-forge-hex-tile-map';
  formatVersion: 1;
  sourceProjectId: string;
  sourceWorldId: string;
  seed: string;
  generatedAt: string;
  config: HexTileExportConfig;
  profile: HexTileProfile;
  dimensions: {
    width: number;
    height: number;
    orientation: 'pointy-top-odd-r';
    wrapMode: WrapMode;
  };
  source: {
    topologyKind: TopologyKind;
    topologyResolution: number;
    projection: Projection;
    mapResolution: Resolution;
  };
  legend: {
    biomes: HexTileBiome[];
    morphologies: HexTileMorphology[];
    features: HexTileFeature[];
  };
  tiles: HexTile[];
};

export type ContentCategory = 'biomes' | 'tiles' | 'features' | 'resources';

export type ContentAsset = {
  id: string;
  label: string;
  kind: 'preview-color' | 'texture' | 'icon';
  value: string;
};

export type ContentRule = {
  field: string;
  min?: number;
  max?: number;
  equals?: string | number | boolean;
  includes?: string[];
  note?: string;
};

export type ContentMember = {
  id: string;
  label: string;
  description: string;
  source: string;
  setIds: string[];
  rules: ContentRule[];
  assets: ContentAsset[];
  tags: string[];
};

export type ContentSet = {
  id: string;
  label: string;
  description: string;
  memberIds: string[];
  isDefault: boolean;
};

export type ContentCategoryConfig = {
  id: ContentCategory;
  label: string;
  description: string;
  defaultSetId: string;
  sets: ContentSet[];
  members: ContentMember[];
};

export type ContentLibraryConfig = Record<ContentCategory, ContentCategoryConfig>;

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

export const civ7StyleHexTileProfile: HexTileProfile = {
  id: 'civ7-style-default',
  label: 'Civ 7-style default',
  description: 'Generic Civ-style profile using Civilization VII terrain vocabulary: land biomes, terrain morphology, marine tiles, and feature classes.',
  biomes: ['tundra', 'grassland', 'plains', 'desert', 'tropical', 'marine'],
  morphologies: ['flat', 'rough', 'mountainous', 'navigable-river', 'coastal', 'ocean', 'lake'],
  features: ['vegetated', 'wet', 'floodplain', 'river', 'snow', 'ice', 'aquatic']
};

export const hexTileMapPresets: HexTileMapPreset[] = [
  { id: 'civ7-style-tiny', label: 'Civ 7-style Tiny', width: 44, height: 28, note: 'Editable starter preset; replace with verified mod-data dimensions when available.' },
  { id: 'civ7-style-small', label: 'Civ 7-style Small', width: 56, height: 36, note: 'Editable starter preset; replace with verified mod-data dimensions when available.' },
  { id: 'civ7-style-standard', label: 'Civ 7-style Standard', width: 68, height: 44, note: 'Editable starter preset; replace with verified mod-data dimensions when available.' },
  { id: 'civ7-style-large', label: 'Civ 7-style Large', width: 80, height: 52, note: 'Editable starter preset; replace with verified mod-data dimensions when available.' },
  { id: 'civ7-style-huge', label: 'Civ 7-style Huge', width: 96, height: 60, note: 'Editable starter preset; replace with verified mod-data dimensions when available.' }
];

export const defaultContentLibrary: ContentLibraryConfig = {
  biomes: {
    id: 'biomes',
    label: 'Biomes',
    description: 'Biome definitions and display assets used by generation and preview rendering.',
    defaultSetId: 'world-forge-biomes',
    sets: [
      {
        id: 'world-forge-biomes',
        label: 'World Forge current biomes',
        description: 'Current code-backed biome set, captured for the data-driven cutover.',
        memberIds: ['ocean', 'ice-cap', 'tundra', 'desert', 'grassland', 'forest', 'rainforest', 'mountain', 'wetland'],
        isDefault: true
      }
    ],
    members: [
      contentMember('ocean', 'Ocean', 'Open water biome.', 'current-generation', ['world-forge-biomes'], '#2f7fa6', [{ field: 'water', equals: true }], ['water']),
      contentMember('ice-cap', 'Ice cap', 'Permanent ice over water or land.', 'current-generation', ['world-forge-biomes'], '#eef7fb', [{ field: 'ice', equals: true }], ['ice', 'cold']),
      contentMember('tundra', 'Tundra', 'Cold dry or semi-wet land.', 'current-generation', ['world-forge-biomes'], '#b6c7ad', [{ field: 'temperatureC', max: 4 }, { field: 'water', equals: false }], ['cold']),
      contentMember('desert', 'Desert', 'Arid land biome.', 'current-generation', ['world-forge-biomes'], '#d6bf72', [{ field: 'wetness', max: 0.22 }, { field: 'water', equals: false }], ['dry']),
      contentMember('grassland', 'Grassland', 'Default temperate open land.', 'current-generation', ['world-forge-biomes'], '#9bbf6a', [{ field: 'wetness', min: 0.22, max: 0.48 }, { field: 'water', equals: false }], ['temperate']),
      contentMember('forest', 'Forest', 'Temperate wet vegetated land.', 'current-generation', ['world-forge-biomes'], '#4f8f55', [{ field: 'wetness', min: 0.48 }, { field: 'temperatureC', max: 20 }, { field: 'water', equals: false }], ['vegetated']),
      contentMember('rainforest', 'Rainforest', 'Hot and very wet vegetated land.', 'current-generation', ['world-forge-biomes'], '#2c6f45', [{ field: 'wetness', min: 0.72 }, { field: 'temperatureC', min: 20 }, { field: 'water', equals: false }], ['vegetated', 'tropical']),
      contentMember('mountain', 'Mountain', 'High relief land biome.', 'current-generation', ['world-forge-biomes'], '#9d9788', [{ field: 'elevationAboveSeaLevel', min: 0.48 }, { field: 'water', equals: false }], ['highland']),
      contentMember('wetland', 'Wetland', 'Low wet river, lake, or coastal land.', 'current-generation', ['world-forge-biomes'], '#6f9f78', [{ field: 'wetness', min: 0.62 }, { field: 'river', min: 0.25 }, { field: 'water', equals: false }], ['wet', 'river'])
    ]
  },
  tiles: {
    id: 'tiles',
    label: 'Tiles',
    description: 'Tile terrain packs and map-to-tile rules.',
    defaultSetId: 'civ7-style-tiles',
    sets: [
      {
        id: 'civ7-style-tiles',
        label: 'Civ 7-style tiles',
        description: 'Initial Civ 7-style tile vocabulary used by the hex tile export profile.',
        memberIds: ['marine', 'tundra-tile', 'grassland-tile', 'plains-tile', 'desert-tile', 'tropical-tile', 'rough', 'mountainous', 'navigable-river'],
        isDefault: true
      }
    ],
    members: [
      contentMember('marine', 'Marine', 'Water tile terrain.', 'civ7-style-profile', ['civ7-style-tiles'], '#2f7fa6', [{ field: 'water', equals: true }], ['water']),
      contentMember('tundra-tile', 'Tundra', 'Cold land tile.', 'civ7-style-profile', ['civ7-style-tiles'], '#b6c7ad', [{ field: 'temperatureC', max: 1 }], ['cold']),
      contentMember('grassland-tile', 'Grassland', 'Wet temperate land tile.', 'civ7-style-profile', ['civ7-style-tiles'], '#9bbf6a', [{ field: 'wetness', min: 0.46 }], ['land']),
      contentMember('plains-tile', 'Plains', 'Moderate or dry open land tile.', 'civ7-style-profile', ['civ7-style-tiles'], '#d6bf72', [{ field: 'wetness', min: 0.24, max: 0.46 }], ['land']),
      contentMember('desert-tile', 'Desert', 'Arid land tile.', 'civ7-style-profile', ['civ7-style-tiles'], '#e1c76f', [{ field: 'wetness', max: 0.24 }], ['dry']),
      contentMember('tropical-tile', 'Tropical', 'Hot wet land tile.', 'civ7-style-profile', ['civ7-style-tiles'], '#3c8b5f', [{ field: 'temperatureC', min: 21 }, { field: 'wetness', min: 0.52 }], ['hot', 'wet']),
      contentMember('rough', 'Rough', 'Rough terrain morphology.', 'civ7-style-profile', ['civ7-style-tiles'], '#a99a72', [{ field: 'slope', min: 0.075 }], ['morphology']),
      contentMember('mountainous', 'Mountainous', 'Mountain terrain morphology.', 'civ7-style-profile', ['civ7-style-tiles'], '#7f7a70', [{ field: 'slope', min: 0.22 }], ['morphology']),
      contentMember('navigable-river', 'Navigable river', 'River terrain morphology.', 'civ7-style-profile', ['civ7-style-tiles'], '#8fc9d4', [{ field: 'river', min: 0.62 }], ['river', 'morphology'])
    ]
  },
  features: {
    id: 'features',
    label: 'Features',
    description: 'Feature packs and map-to-feature rules.',
    defaultSetId: 'civ7-style-features',
    sets: [
      {
        id: 'civ7-style-features',
        label: 'Civ 7-style features',
        description: 'Initial feature vocabulary used by the hex tile export profile.',
        memberIds: ['vegetated', 'wet', 'floodplain', 'river-feature', 'snow', 'ice-feature', 'aquatic'],
        isDefault: true
      }
    ],
    members: [
      contentMember('vegetated', 'Vegetated', 'Vegetation or forest-like feature.', 'civ7-style-profile', ['civ7-style-features'], '#3f8b52', [{ field: 'wetness', min: 0.52 }], ['land']),
      contentMember('wet', 'Wet', 'Wetland or saturated terrain feature.', 'civ7-style-profile', ['civ7-style-features'], '#6f9f78', [{ field: 'wetness', min: 0.66 }], ['wet']),
      contentMember('floodplain', 'Floodplain', 'Low wet river-adjacent feature.', 'civ7-style-profile', ['civ7-style-features'], '#b6b776', [{ field: 'river', min: 0.32 }, { field: 'elevationAboveSeaLevel', max: 0.18 }], ['river']),
      contentMember('river-feature', 'River', 'Visible river feature.', 'civ7-style-profile', ['civ7-style-features'], '#b0dfe2', [{ field: 'river', min: 0.12 }], ['river']),
      contentMember('snow', 'Snow', 'Snow cover feature.', 'civ7-style-profile', ['civ7-style-features'], '#eef7fb', [{ field: 'temperatureC', max: -6 }], ['cold']),
      contentMember('ice-feature', 'Ice', 'Ice feature.', 'civ7-style-profile', ['civ7-style-features'], '#dcecef', [{ field: 'ice', equals: true }], ['cold']),
      contentMember('aquatic', 'Aquatic', 'Aquatic feature for coast, lake, or marine tiles.', 'civ7-style-profile', ['civ7-style-features'], '#6fb2be', [{ field: 'water', equals: true }], ['water'])
    ]
  },
  resources: {
    id: 'resources',
    label: 'Resources',
    description: 'Resource packs and placement-rule placeholders.',
    defaultSetId: 'civ7-resources',
    sets: [
      {
        id: 'civ7-resources',
        label: 'Civ 7 resources',
        description: 'Initial named resource set for future placement rules and icon attachments.',
        memberIds: ['cattle', 'fish', 'gold', 'gypsum', 'hardwood', 'hides', 'horses', 'incense', 'iron', 'ivory', 'jade', 'kaolin', 'lapis-lazuli', 'limestone', 'llamas', 'mangoes', 'marble', 'pearls', 'rice', 'rubies', 'salt', 'silk', 'silver', 'tin', 'turtles', 'wild-game', 'wine'],
        isDefault: true
      }
    ],
    members: [
      ...['cattle', 'fish', 'gold', 'gypsum', 'hardwood', 'hides', 'horses', 'incense', 'iron', 'ivory', 'jade', 'kaolin', 'lapis-lazuli', 'limestone', 'llamas', 'mangoes', 'marble', 'pearls', 'rice', 'rubies', 'salt', 'silk', 'silver', 'tin', 'turtles', 'wild-game', 'wine'].map((id) =>
        contentMember(id, titleCase(id), 'Civ 7 resource placeholder. Placement and yield rules are intentionally deferred until the resource cutover.', 'civ7-resource-reference', ['civ7-resources'], '#c9b56b', [], ['resource'])
      )
    ]
  }
};

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

function contentMember(
  id: string,
  label: string,
  description: string,
  source: string,
  setIds: string[],
  previewColor: string,
  rules: ContentRule[],
  tags: string[]
): ContentMember {
  return {
    id,
    label,
    description,
    source,
    setIds,
    rules,
    tags,
    assets: [
      {
        id: `${id}-preview-color`,
        label: 'Preview color',
        kind: 'preview-color',
        value: previewColor
      }
    ]
  };
}

function titleCase(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
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
