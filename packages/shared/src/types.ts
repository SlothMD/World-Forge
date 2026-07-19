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
  biomeRules?: BiomeClassificationRule[];
  climate?: Partial<ClimatePipelineConfig>;
  generationProfile: 'earthlike-mvp';
  topologyResolution?: number;
  outputResolution: Resolution;
  projection: Projection;
  wrapMode: WrapMode;
};

export type SimulationFidelity = 'preview' | 'standard' | 'deep' | 'experimental';

export type PlanetaryCalendarConfig = {
  yearLengthDays: number;
  seasonalFrameCount: number;
  axialTiltDeg: number;
  orbitalEccentricity: number;
  periapsisSeasonOffset: number;
};

export type EnergyBudgetConfig = {
  stellarFlux: number;
  greenhouseHeatRetention: number;
  surfaceAlbedoBase: number;
  oceanHeatStorage: number;
  landHeatResponse: number;
  iceAlbedoFeedback: number;
};

export type ClimatePipelineConfig = {
  fidelity: SimulationFidelity;
  calendar: PlanetaryCalendarConfig;
  energyBudget: EnergyBudgetConfig;
};

export type GeneratedLayerMetadata = {
  pipelineVersion: string;
  stageId: string;
  fidelity: SimulationFidelity;
  seed: string;
};

export type SeasonalThermalSummary = {
  seasonIndex: number;
  label: string;
  insolationMean: number;
  insolationMin: number;
  insolationMax: number;
  landTemperatureMeanC: number;
  oceanTemperatureMeanC: number;
  landTemperatureStdDevC: number;
  oceanTemperatureStdDevC: number;
  iceAlbedoCoolingMeanC: number;
};

export type ClimateCirculationBandSummary = {
  id: string;
  label: string;
  latitudeMinDeg: number;
  latitudeMaxDeg: number;
  pressureRole: 'low' | 'high' | 'transitional';
  meanPressureIndex: number;
  meanWindX: number;
  meanWindY: number;
  meanWindSpeed: number;
};

export type ClimateOceanCurrentSummary = {
  meanCurrentSpeed: number;
  coastalDeflectionIndex: number;
  northernGyreSignal: number;
  southernGyreSignal: number;
  oceanCellShare: number;
};

export type ClimateMoistureSummary = {
  meanCandidateWetness: number;
  meanCurrentWetness: number;
  meanWetnessDelta: number;
  wetnessCorrelation: number;
  aridCellShare: number;
  wetCellShare: number;
  riverSourceSupportIndex: number;
};

export type ClimateCirculationSummary = {
  itczLatitudeDeg: number;
  hadleyCellEdgeDeg: number;
  ferrelCellEdgeDeg: number;
  polarCellEdgeDeg: number;
  windTopographicDeflectionIndex: number;
  meanOrographicLiftIndex: number;
  bands: ClimateCirculationBandSummary[];
  oceanCurrents: ClimateOceanCurrentSummary;
};

export type ClimatePipelineOutput = {
  pipelineVersion: 'climate_pipeline_v1';
  fidelity: SimulationFidelity;
  metadata: GeneratedLayerMetadata;
  calendar: PlanetaryCalendarConfig;
  energyBudget: EnergyBudgetConfig;
  seasonalFrames: SeasonalThermalSummary[];
  circulation?: ClimateCirculationSummary;
  moisture?: ClimateMoistureSummary;
  diagnostics: {
    seasonalTemperatureSwingC: number;
    landSeasonalSwingC: number;
    oceanSeasonalSwingC: number;
    axialTiltSeasonalityC: number;
    meanIceAlbedoCoolingC: number;
  };
  notes: string[];
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
  topologyPath?: number[];
  sourceIndex: number;
  mouthIndex: number;
  terminus: 'ocean' | 'basin' | 'lake' | 'wetland';
};

export type WorldRegionLevel = 'region' | 'subregion' | 'local';

export type WorldRegionBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

export type WorldRegionBiomeShare = {
  biome: Biome;
  share: number;
};

export type WorldRegionPoint = {
  topologyCellId: number;
  latitude: number;
  longitude: number;
  elevation: number;
};

export type WorldRegionRiverCandidate = {
  topologyCellId: number;
  latitude: number;
  longitude: number;
  signal: number;
};

export type WorldHexOverlayLevelId = 'world-500mi' | 'world-60mi' | 'regional-24mi' | 'local-6mi' | 'local-1mi';

export type WorldHexOverlayCoverage = {
  levelId: WorldHexOverlayLevelId;
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
  wrapsLongitude: boolean;
};

export type WorldHexOverlayLevel = {
  id: WorldHexOverlayLevelId;
  label: string;
  nominalHexWidthMiles: number;
  orientation: 'pointy-top-odd-r';
  parentLevelId?: WorldHexOverlayLevelId;
  childLevelId?: WorldHexOverlayLevelId;
  dimensions: {
    columns: number;
    rows: number;
  };
  idFormat: string;
};

export type WorldHexOverlay = {
  modelVersion: 'flat-equirectangular-hex-overlay-v1';
  scheme: 'flat-equirectangular-pointy-odd-r';
  projection: Projection;
  planetCircumferenceMiles: number;
  levels: WorldHexOverlayLevel[];
};

export type WorldRegion = {
  id: string;
  level: WorldRegionLevel;
  parentId: string;
  label: string;
  bounds: WorldRegionBounds;
  center: {
    latitude: number;
    longitude: number;
  };
  topologyCellCount: number;
  areaWeight: number;
  landAreaShare: number;
  waterAreaShare: number;
  dominantBiomes: WorldRegionBiomeShare[];
  highestPoint: WorldRegionPoint | null;
  largestRiver: WorldRegionRiverCandidate | null;
  hexCoverage?: WorldHexOverlayCoverage[];
  neighborRegionIds: string[];
  subdivision: {
    scheme: 'lat-lon-grid';
    childLevel: Exclude<WorldRegionLevel, 'region'>;
    recommendedRows: number;
    recommendedColumns: number;
  };
};

export type WorldRegionEntity = {
  id: string;
  type: 'political' | 'watershed' | 'cultural' | 'ecological' | 'trade' | 'custom';
  label: string;
  regionIds: string[];
  level: WorldRegionLevel | 'multi-region';
};

export type WorldRegionSet = {
  modelVersion: 'world-regions-v1';
  scheme: 'lat-lon-grid';
  regionLevel: WorldRegionLevel;
  sourceTopologyKind: TopologyKind;
  sourceTopologyResolution: number;
  rows: number;
  columns: number;
  regions: WorldRegion[];
  crossRegionEntities: WorldRegionEntity[];
};

export type MapLayers = {
  elevation: Float32Array;
  water: Uint8Array;
  plates: Uint16Array;
  temperature: Float32Array;
  wetness: Float32Array;
  climateMoisture: Float32Array;
  climatePrecipitation: Float32Array;
  climateWetnessDelta: Float32Array;
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
  climateMoisture: Float32Array;
  climatePrecipitation: Float32Array;
  climateWetnessDelta: Float32Array;
  biomes: Uint8Array;
  ice: Uint8Array;
  river: Float32Array;
  lakes: Uint8Array;
  volcanism: Float32Array;
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
export type HexTileFeature = 'vegetated' | 'wet' | 'floodplain' | 'minor-river' | 'navigable-river' | 'snow' | 'ice' | 'aquatic';
export type HexTileEdge = 'e' | 'se' | 'sw' | 'w' | 'nw' | 'ne';
export type HexTileFeatureDetail =
  | 'bog'
  | 'marsh'
  | 'watering-hole'
  | 'oasis'
  | 'mangrove'
  | 'taiga'
  | 'forest'
  | 'savanna-woodland'
  | 'sagebrush-steppe'
  | 'rainforest'
  | 'aquatic'
  | 'floodplain'
  | 'river'
  | 'volcano'
  | 'snow'
  | 'ice';

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
  classificationRules?: HexTileClassificationRules;
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
  featureDetails: HexTileFeatureDetail[];
  minorRiverEdges: HexTileEdge[];
  navigableRiverEdges: HexTileEdge[];
  ridgeEdges: HexTileEdge[];
  navigableRiverCenter: boolean;
  riverStrength: number;
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
  kind?: string;
  setIds: string[];
  parentIds?: string[];
  classIds?: string[];
  compatibleWith?: Record<string, string[]>;
  targetMappings?: Record<string, string>;
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

export type BiomeRuleInput = {
  water: boolean;
  ice: boolean;
  temperatureC: number;
  elevationAboveSeaLevel: number;
  lake: boolean;
  river: number;
  wetness: number;
  polarLatitude: number;
};

export type BiomeClassificationRule = {
  biome: Biome;
  rules: ContentRule[];
  note?: string;
};

export type HexFeatureRuleInput = {
  biome: HexTileBiome;
  morphology: HexTileMorphology;
  water: boolean;
  river: number;
  lake: boolean;
  ice: boolean;
  wetness: number;
  temperatureC: number;
  elevationAboveSeaLevel: number;
  volcanism: number;
};

export type HexBiomeRuleInput = {
  sourceBiome: Biome;
  water: boolean;
  lake: boolean;
  ice: boolean;
  temperatureC: number;
  wetness: number;
};

export type HexMorphologyRuleInput = {
  biome: HexTileBiome;
  water: boolean;
  lake: boolean;
  depthBelowSeaLevel: number;
  elevationAboveSeaLevel: number;
  slope: number;
};

export type HexTileBiomeRule = {
  biome: HexTileBiome;
  rules: ContentRule[];
  note?: string;
};

export type HexTileMorphologyRule = {
  morphology: HexTileMorphology;
  rules: ContentRule[];
  note?: string;
};

export type HexTileFeatureRule = {
  feature: HexTileFeature;
  rules: ContentRule[];
  note?: string;
};

export type HexFeatureDetailRule = {
  detail: HexTileFeatureDetail;
  rules: ContentRule[];
  note?: string;
};

export type HexTileTerrainNameRule = {
  label: string;
  rules: ContentRule[];
  note?: string;
};

export type HexTileColorStyle = {
  id: HexTileBiome | HexTileMorphology | string;
  color: string;
};

export type HexTileClassificationRules = {
  biomeRules: HexTileBiomeRule[];
  morphologyRules: HexTileMorphologyRule[];
  featureRules: HexTileFeatureRule[];
  featureDetailRules: HexFeatureDetailRule[];
  terrainNameRules: HexTileTerrainNameRule[];
  colors: HexTileColorStyle[];
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
  hexOverlay?: WorldHexOverlay;
  regions?: WorldRegionSet;
  climate?: ClimatePipelineOutput;
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
  graph?: {
    targetNodeId: string;
    nodes: Array<{
      nodeId: string;
      version: string;
      dependencies: string[];
      durationMs: number;
      validation?: {
        valid: boolean;
        issues: Array<{
          severity: 'error' | 'warning';
          message: string;
        }>;
      };
      outputs: string[];
    }>;
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

export const defaultBiomeClassificationRules: BiomeClassificationRule[] = [
  { biome: 'ocean', rules: [{ field: 'water', equals: true }], note: 'Water cells classify as ocean before all land checks.' },
  { biome: 'ice_cap', rules: [{ field: 'ice', equals: true }], note: 'Permanent ice overrides land biome color and export class.' },
  { biome: 'tundra', rules: [{ field: 'temperatureC', max: 1 }, { field: 'water', equals: false }], note: 'Cold land below the old hardcoded tundra threshold.' },
  { biome: 'wetland', rules: [{ field: 'lake', equals: true }, { field: 'water', equals: false }], note: 'Lake-adjacent/standing inland water signal becomes wetland.' },
  { biome: 'wetland', rules: [{ field: 'river', min: 0.55 }, { field: 'water', equals: false }], note: 'Strong river signal becomes wetland.' },
  { biome: 'desert', rules: [{ field: 'wetness', max: 0.2 }, { field: 'water', equals: false }], note: 'Very dry land becomes desert.' },
  { biome: 'rainforest', rules: [{ field: 'wetness', min: 0.72 }, { field: 'temperatureC', min: 20 }, { field: 'water', equals: false }], note: 'Hot very wet land becomes rainforest.' },
  { biome: 'forest', rules: [{ field: 'wetness', min: 0.48 }, { field: 'water', equals: false }], note: 'Wet land becomes forest.' },
  { biome: 'forest', rules: [{ field: 'polarLatitude', max: 0.65 }, { field: 'wetness', min: 0.42 }, { field: 'water', equals: false }], note: 'Non-polar moderately wet land becomes forest.' },
  { biome: 'grassland', rules: [], note: 'Default fallback land biome.' }
];

export function classifyBiomeFromRules(input: BiomeRuleInput, rules: BiomeClassificationRule[] = defaultBiomeClassificationRules): Biome {
  return rules.find((rule) => rule.rules.every((condition) => contentRuleMatches(input, condition)))?.biome ?? 'grassland';
}

export const defaultHexTileBiomeRules: HexTileBiomeRule[] = [
  { biome: 'marine', rules: [{ field: 'water', equals: true }], note: 'Any surface water exports as marine terrain.' },
  { biome: 'marine', rules: [{ field: 'lake', equals: true }], note: 'Standing inland water exports as marine terrain before land checks.' },
  { biome: 'tundra', rules: [{ field: 'ice', equals: true }], note: 'Ice exports as tundra/ice terrain class.' },
  { biome: 'tundra', rules: [{ field: 'sourceBiome', includes: ['ice_cap', 'tundra'] }], note: 'Generated ice cap and tundra map to Civ-style tundra.' },
  { biome: 'tundra', rules: [{ field: 'temperatureC', max: 1 }], note: 'Cold land below the old exporter threshold maps to tundra.' },
  { biome: 'desert', rules: [{ field: 'sourceBiome', equals: 'desert' }], note: 'Generated desert remains desert.' },
  { biome: 'desert', rules: [{ field: 'wetness', max: 0.24 }], note: 'Very dry land maps to desert.' },
  { biome: 'tropical', rules: [{ field: 'sourceBiome', equals: 'rainforest' }], note: 'Generated rainforest maps to tropical.' },
  { biome: 'tropical', rules: [{ field: 'temperatureC', min: 21 }, { field: 'wetness', min: 0.52 }], note: 'Warm wet land maps to tropical.' },
  { biome: 'grassland', rules: [{ field: 'sourceBiome', includes: ['grassland', 'forest', 'wetland'] }, { field: 'wetness', min: 0.46 }], note: 'Moist open/vegetated generated land maps to grassland.' },
  { biome: 'plains', rules: [{ field: 'sourceBiome', includes: ['grassland', 'forest', 'wetland'] }], note: 'Drier open/vegetated generated land maps to plains.' },
  { biome: 'plains', rules: [], note: 'Default Civ-style land biome fallback.' }
];

export function classifyHexBiomeFromRules(input: HexBiomeRuleInput, rules: HexTileBiomeRule[] = defaultHexTileBiomeRules): HexTileBiome {
  return rules.find((rule) => rule.rules.every((condition) => contentRuleMatches(input, condition)))?.biome ?? 'plains';
}

export const defaultHexTileMorphologyRules: HexTileMorphologyRule[] = [
  { morphology: 'lake', rules: [{ field: 'water', equals: true }, { field: 'lake', equals: true }], note: 'Inland water exports as lake terrain.' },
  { morphology: 'ocean', rules: [{ field: 'water', equals: true }, { field: 'depthBelowSeaLevel', min: 0.12 }], note: 'Marine water below the shelf band exports as ocean.' },
  { morphology: 'coastal', rules: [{ field: 'water', equals: true }], note: 'Shallow marine water exports as coastal.' },
  { morphology: 'mountainous', rules: [{ field: 'water', equals: false }, { field: 'elevationAboveSeaLevel', min: 0.38 }], note: 'Tall land exports as mountainous.' },
  { morphology: 'mountainous', rules: [{ field: 'water', equals: false }, { field: 'slope', min: 0.13 }], note: 'Steep land exports as mountainous.' },
  { morphology: 'rough', rules: [{ field: 'water', equals: false }, { field: 'elevationAboveSeaLevel', min: 0.14 }], note: 'Moderately elevated land exports as rough.' },
  { morphology: 'rough', rules: [{ field: 'water', equals: false }, { field: 'slope', min: 0.045 }], note: 'Moderately sloped land exports as rough.' },
  { morphology: 'flat', rules: [], note: 'Default land morphology fallback.' }
];

export function classifyHexMorphologyFromRules(input: HexMorphologyRuleInput, rules: HexTileMorphologyRule[] = defaultHexTileMorphologyRules): HexTileMorphology {
  return rules.find((rule) => rule.rules.every((condition) => contentRuleMatches(input, condition)))?.morphology ?? 'flat';
}

export const defaultHexTileFeatureRules: HexTileFeatureRule[] = [
  { feature: 'aquatic', rules: [{ field: 'water', equals: true }, { field: 'morphology', includes: ['coastal', 'lake'] }], note: 'Coastal and lake water exports aquatic.' },
  { feature: 'aquatic', rules: [{ field: 'water', equals: true }, { field: 'wetness', min: 0.55 }], note: 'Wet marine tiles export aquatic.' },
  { feature: 'ice', rules: [{ field: 'water', equals: true }, { field: 'ice', equals: true }] },
  { feature: 'ice', rules: [{ field: 'water', equals: true }, { field: 'temperatureC', max: -5 }] },
  { feature: 'minor-river', rules: [{ field: 'water', equals: false }, { field: 'river', min: 0.12, max: 0.62 }] },
  { feature: 'navigable-river', rules: [{ field: 'water', equals: false }, { field: 'river', min: 0.62 }] },
  { feature: 'floodplain', rules: [{ field: 'water', equals: false }, { field: 'river', min: 0.32 }, { field: 'wetness', min: 0.55 }, { field: 'elevationAboveSeaLevel', max: 0.18 }] },
  { feature: 'wet', rules: [{ field: 'water', equals: false }, { field: 'wetness', min: 0.66 }] },
  { feature: 'wet', rules: [{ field: 'water', equals: false }, { field: 'lake', equals: true }] },
  { feature: 'vegetated', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'grassland' }, { field: 'wetness', min: 0.52 }] },
  { feature: 'vegetated', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'tropical' }] },
  { feature: 'vegetated', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'tundra' }, { field: 'wetness', min: 0.42 }] },
  { feature: 'snow', rules: [{ field: 'water', equals: false }, { field: 'ice', equals: true }] },
  { feature: 'snow', rules: [{ field: 'water', equals: false }, { field: 'temperatureC', max: -6 }] }
];

export function classifyHexFeaturesFromRules(input: HexFeatureRuleInput, rules: HexTileFeatureRule[] = defaultHexTileFeatureRules): HexTileFeature[] {
  const features = new Set<HexTileFeature>();
  for (const rule of rules) {
    if (rule.rules.every((condition) => contentRuleMatches(input, condition))) features.add(rule.feature);
  }
  return [...features];
}

export const defaultHexFeatureDetailRules: HexFeatureDetailRule[] = [
  { detail: 'aquatic', rules: [{ field: 'water', equals: true }], note: 'Water tiles are aquatic.' },
  { detail: 'aquatic', rules: [{ field: 'biome', equals: 'marine' }], note: 'Marine biome tiles are aquatic.' },
  { detail: 'ice', rules: [{ field: 'water', equals: true }, { field: 'ice', equals: true }], note: 'Icy water exports ice detail.' },
  { detail: 'ice', rules: [{ field: 'water', equals: true }, { field: 'temperatureC', max: -5 }], note: 'Very cold water exports ice detail.' },
  { detail: 'river', rules: [{ field: 'water', equals: false }, { field: 'river', min: 0.12 }], note: 'Land river signal exports river detail.' },
  { detail: 'river', rules: [{ field: 'water', equals: false }, { field: 'morphology', equals: 'navigable-river' }], note: 'Navigable river morphology exports river detail.' },
  { detail: 'floodplain', rules: [{ field: 'water', equals: false }, { field: 'river', min: 0.32 }, { field: 'wetness', min: 0.55 }, { field: 'elevationAboveSeaLevel', max: 0.18 }] },
  { detail: 'snow', rules: [{ field: 'water', equals: false }, { field: 'ice', equals: true }] },
  { detail: 'snow', rules: [{ field: 'water', equals: false }, { field: 'temperatureC', max: -6 }] },
  { detail: 'taiga', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'tundra' }, { field: 'wetness', min: 0.42 }] },
  { detail: 'rainforest', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'tropical' }, { field: 'wetness', min: 0.68 }] },
  { detail: 'savanna-woodland', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'tropical' }, { field: 'wetness', min: 0.5, max: 0.68 }] },
  { detail: 'forest', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'grassland' }, { field: 'wetness', min: 0.55 }] },
  { detail: 'sagebrush-steppe', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'plains' }, { field: 'wetness', max: 0.34 }] },
  { detail: 'marsh', rules: [{ field: 'water', equals: false }, { field: 'wetness', min: 0.74 }, { field: 'temperatureC', min: 16 }] },
  { detail: 'bog', rules: [{ field: 'water', equals: false }, { field: 'wetness', min: 0.74 }, { field: 'temperatureC', max: 16 }] },
  { detail: 'oasis', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'desert' }, { field: 'river', min: 0.16 }] },
  { detail: 'watering-hole', rules: [{ field: 'water', equals: false }, { field: 'biome', equals: 'desert' }, { field: 'wetness', min: 0.36 }] },
  { detail: 'mangrove', rules: [{ field: 'water', equals: false }, { field: 'morphology', equals: 'coastal' }, { field: 'wetness', min: 0.58 }, { field: 'temperatureC', min: 18 }] },
  { detail: 'mangrove', rules: [{ field: 'water', equals: false }, { field: 'lake', equals: true }, { field: 'wetness', min: 0.58 }, { field: 'temperatureC', min: 18 }] },
  { detail: 'volcano', rules: [{ field: 'water', equals: false }, { field: 'volcanism', min: 0.68 }, { field: 'elevationAboveSeaLevel', min: 0.08 }, { field: 'morphology', equals: 'mountainous' }] },
  { detail: 'volcano', rules: [{ field: 'water', equals: false }, { field: 'volcanism', min: 0.68 }, { field: 'elevationAboveSeaLevel', min: 0.08 }, { field: 'morphology', equals: 'rough' }] }
];

export function classifyHexFeatureDetailsFromRules(input: HexFeatureRuleInput, rules: HexFeatureDetailRule[] = defaultHexFeatureDetailRules): HexTileFeatureDetail[] {
  const details = new Set<HexTileFeatureDetail>();
  for (const rule of rules) {
    if (rule.rules.every((condition) => contentRuleMatches(input, condition))) details.add(rule.detail);
  }
  return [...details];
}

export const defaultHexTileTerrainNameRules: HexTileTerrainNameRule[] = [
  { label: 'Lake', rules: [{ field: 'biome', equals: 'marine' }, { field: 'morphology', equals: 'lake' }] },
  { label: 'Ocean', rules: [{ field: 'biome', equals: 'marine' }, { field: 'morphology', equals: 'ocean' }] },
  { label: 'Coastal', rules: [{ field: 'biome', equals: 'marine' }, { field: 'morphology', equals: 'coastal' }] },
  { label: 'Navigable River', rules: [{ field: 'morphology', equals: 'navigable-river' }] }
];

export function hexTerrainTypeNameFromRules(
  biome: HexTileBiome,
  morphology: HexTileMorphology,
  rules: HexTileTerrainNameRule[] = defaultHexTileTerrainNameRules
): string {
  const configured = rules.find((rule) => rule.rules.every((condition) => contentRuleMatches({ biome, morphology }, condition)));
  if (configured) return configured.label;
  return `${titleCase(morphology)} ${titleCase(biome)}`;
}

export const defaultHexTileColorStyles: HexTileColorStyle[] = [
  { id: 'marine', color: '#2f7fa6' },
  { id: 'tundra', color: '#c8d6c7' },
  { id: 'grassland', color: '#9bbf6a' },
  { id: 'plains', color: '#c8b873' },
  { id: 'desert', color: '#e3c76b' },
  { id: 'tropical', color: '#3c8b5f' },
  { id: 'flat', color: '#9bbf6a' },
  { id: 'rough', color: '#a99a72' },
  { id: 'mountainous', color: '#7f7a70' },
  { id: 'navigable-river', color: '#8fc9d4' },
  { id: 'coastal', color: '#4f9fba' },
  { id: 'ocean', color: '#1e4f73' },
  { id: 'lake', color: '#6fb2be' }
];

export const defaultHexTileClassificationRules: HexTileClassificationRules = {
  biomeRules: defaultHexTileBiomeRules,
  morphologyRules: defaultHexTileMorphologyRules,
  featureRules: defaultHexTileFeatureRules,
  featureDetailRules: defaultHexFeatureDetailRules,
  terrainNameRules: defaultHexTileTerrainNameRules,
  colors: defaultHexTileColorStyles
};

export function hexTileColorRampFromRules(rules: HexTileClassificationRules = defaultHexTileClassificationRules): Record<string, string> {
  return Object.fromEntries(rules.colors.map((entry) => [entry.id, entry.color]));
}

export function contentRuleMatches(input: Record<string, unknown>, rule: ContentRule): boolean {
  const value = input[rule.field];
  if (rule.equals !== undefined && value !== rule.equals) return false;
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) return false;
    if (rule.max !== undefined && value > rule.max) return false;
  } else if (rule.min !== undefined || rule.max !== undefined) {
    return false;
  }
  if (rule.includes?.length) {
    if (Array.isArray(value)) return rule.includes.every((entry) => value.includes(entry));
    if (typeof value === 'string') return rule.includes.includes(value);
    return false;
  }
  return true;
}

export const civ7StyleHexTileProfile: HexTileProfile = {
  id: 'civ7-style-default',
  label: 'Civ 7-style default',
  description: 'Generic Civ-style profile using Civilization VII terrain vocabulary: land biomes, terrain morphology, marine tiles, and feature classes.',
  biomes: ['tundra', 'grassland', 'plains', 'desert', 'tropical', 'marine'],
  morphologies: ['flat', 'rough', 'mountainous', 'navigable-river', 'coastal', 'ocean', 'lake'],
  features: ['vegetated', 'wet', 'floodplain', 'minor-river', 'navigable-river', 'snow', 'ice', 'aquatic']
};

export const hexTileMapPresets: HexTileMapPreset[] = [
  { id: 'civ7-style-tiny', label: 'Civ 7 Tiny', width: 60, height: 38, note: 'Civilization VII Tiny: 4 players, 3 natural wonders, 2 continents.' },
  { id: 'civ7-style-small', label: 'Civ 7 Small', width: 74, height: 46, note: 'Civilization VII Small: 6 players, 4 natural wonders, 4 continents.' },
  { id: 'civ7-style-standard', label: 'Civ 7 Standard', width: 84, height: 54, note: 'Civilization VII Standard: 8 players, 5 natural wonders, 4 continents.' },
  { id: 'civ7-style-large', label: 'Civ 7 Large', width: 96, height: 60, note: 'Civilization VII Large: 10 players, 6 natural wonders, 6 continents.' },
  { id: 'civ7-style-huge', label: 'Civ 7 Huge', width: 106, height: 66, note: 'Civilization VII Huge: 10-12 players, 7 natural wonders, 6 continents.' }
];

export const defaultContentLibrary: ContentLibraryConfig = {
  biomes: {
    id: 'biomes',
    label: 'Biomes',
    description: 'Neutral ecological and water-identity biomes used as source facts before target tile translation.',
    defaultSetId: 'world-forge-biomes',
    sets: [
      {
        id: 'world-forge-biomes',
        label: 'PW Base Biomes',
        description: 'Neutral Parchment Worlds biome ontology. Terrain/relief such as mountains lives in Tiles/Terrain, not here.',
        memberIds: ['open-ocean', 'coastal-marine', 'inland-saltwater', 'freshwater-lake', 'riverine', 'wetland', 'ice-cap', 'tundra', 'taiga', 'temperate-forest', 'temperate-rainforest', 'tropical-rainforest', 'tropical-seasonal-forest', 'grassland', 'steppe', 'savanna', 'desert', 'semi-arid-scrub', 'alpine'],
        isDefault: true
      }
    ],
    members: [
      contentMember('open-ocean', 'Open Ocean', 'Deep saltwater away from coasts and shelves.', 'world-forge-base', ['world-forge-biomes'], '#1e4f73', [{ field: 'water', equals: true }, { field: 'lake', equals: false }], ['water', 'saltwater', 'marine'], { kind: 'water-biome', targetMappings: { generatorBiome: 'ocean' } }),
      contentMember('coastal-marine', 'Coastal Marine', 'Near-shore saltwater, shelves, reefs, and coastal marine ecosystems.', 'world-forge-base', ['world-forge-biomes'], '#4f9fba', [{ field: 'water', equals: true }, { field: 'lake', equals: false }], ['water', 'saltwater', 'coastal'], { kind: 'water-biome', parentIds: ['open-ocean'], targetMappings: { generatorBiome: 'ocean' } }),
      contentMember('inland-saltwater', 'Inland Saltwater', 'Salt lakes, inland seas, and evaporative basins.', 'world-forge-base', ['world-forge-biomes'], '#5f9aa7', [{ field: 'lake', equals: true }, { field: 'wetness', max: 0.36 }], ['water', 'saltwater', 'lake'], { kind: 'water-biome', targetMappings: { generatorBiome: 'wetland' } }),
      contentMember('freshwater-lake', 'Freshwater Lake', 'Standing freshwater lakes and lacustrine shore systems.', 'world-forge-base', ['world-forge-biomes'], '#6fb2be', [{ field: 'lake', equals: true }], ['water', 'freshwater', 'lake'], { kind: 'water-biome', targetMappings: { generatorBiome: 'wetland' } }),
      contentMember('riverine', 'Riverine', 'Riparian river corridors and immediate floodplain ecology.', 'world-forge-base', ['world-forge-biomes'], '#7bb6a0', [{ field: 'river', min: 0.55 }, { field: 'water', equals: false }], ['freshwater', 'river'], { kind: 'water-biome', targetMappings: { generatorBiome: 'wetland' } }),
      contentMember('wetland', 'Wetland', 'Saturated land including marsh, bog, swamp, and fen systems.', 'world-forge-base', ['world-forge-biomes'], '#6f9f78', [{ field: 'wetness', min: 0.72 }, { field: 'water', equals: false }], ['wet', 'freshwater'], { kind: 'land-biome', targetMappings: { generatorBiome: 'wetland' } }),
      contentMember('ice-cap', 'Ice Cap', 'Permanent continental or polar ice cover.', 'world-forge-base', ['world-forge-biomes'], '#eef7fb', [{ field: 'ice', equals: true }], ['ice', 'cold'], { kind: 'cover-biome', targetMappings: { generatorBiome: 'ice_cap' } }),
      contentMember('tundra', 'Tundra', 'Cold low-vegetation biome over permafrost or seasonal thaw.', 'world-forge-base', ['world-forge-biomes'], '#b6c7ad', [{ field: 'temperatureC', max: 1 }, { field: 'water', equals: false }], ['cold', 'land'], { kind: 'land-biome', targetMappings: { generatorBiome: 'tundra' } }),
      contentMember('taiga', 'Taiga', 'Boreal coniferous forest biome.', 'world-forge-base', ['world-forge-biomes'], '#6f9367', [{ field: 'temperatureC', min: 1, max: 7 }, { field: 'wetness', min: 0.42 }, { field: 'water', equals: false }], ['cold', 'forest'], { kind: 'land-biome', targetMappings: { generatorBiome: 'forest' } }),
      contentMember('temperate-forest', 'Temperate Forest', 'Broadleaf or mixed temperate forest biome.', 'world-forge-base', ['world-forge-biomes'], '#4f8f55', [{ field: 'wetness', min: 0.48 }, { field: 'temperatureC', min: 7, max: 21 }, { field: 'water', equals: false }], ['temperate', 'forest'], { kind: 'land-biome', targetMappings: { generatorBiome: 'forest' } }),
      contentMember('temperate-rainforest', 'Temperate Rainforest', 'Cool very wet forest, often coastal or windward.', 'world-forge-base', ['world-forge-biomes'], '#3f7c58', [{ field: 'wetness', min: 0.74 }, { field: 'temperatureC', min: 4, max: 18 }, { field: 'water', equals: false }], ['temperate', 'forest', 'rainforest'], { kind: 'land-biome', targetMappings: { generatorBiome: 'forest' } }),
      contentMember('tropical-rainforest', 'Tropical Rainforest', 'Hot very wet closed-canopy forest.', 'world-forge-base', ['world-forge-biomes'], '#2c6f45', [{ field: 'wetness', min: 0.72 }, { field: 'temperatureC', min: 20 }, { field: 'water', equals: false }], ['tropical', 'forest', 'rainforest'], { kind: 'land-biome', targetMappings: { generatorBiome: 'rainforest' } }),
      contentMember('tropical-seasonal-forest', 'Tropical Seasonal Forest', 'Warm forest with a pronounced dry season.', 'world-forge-base', ['world-forge-biomes'], '#4f8e4f', [{ field: 'temperatureC', min: 20 }, { field: 'wetness', min: 0.48, max: 0.72 }, { field: 'water', equals: false }], ['tropical', 'forest', 'seasonal'], { kind: 'land-biome', targetMappings: { generatorBiome: 'rainforest' } }),
      contentMember('grassland', 'Grassland', 'Moist open grass ecosystem.', 'world-forge-base', ['world-forge-biomes'], '#9bbf6a', [{ field: 'wetness', min: 0.34, max: 0.48 }, { field: 'water', equals: false }], ['temperate', 'open'], { kind: 'land-biome', targetMappings: { generatorBiome: 'grassland' } }),
      contentMember('steppe', 'Steppe', 'Dry grass and shrub transition biome.', 'world-forge-base', ['world-forge-biomes'], '#b0b66a', [{ field: 'wetness', min: 0.22, max: 0.34 }, { field: 'water', equals: false }], ['dry', 'open'], { kind: 'land-biome', targetMappings: { generatorBiome: 'grassland' } }),
      contentMember('savanna', 'Savanna', 'Warm grassland with seasonal tree cover.', 'world-forge-base', ['world-forge-biomes'], '#b5b85e', [{ field: 'temperatureC', min: 18 }, { field: 'wetness', min: 0.34, max: 0.54 }, { field: 'water', equals: false }], ['tropical', 'open'], { kind: 'land-biome', targetMappings: { generatorBiome: 'grassland' } }),
      contentMember('desert', 'Desert', 'Arid low-vegetation biome.', 'world-forge-base', ['world-forge-biomes'], '#d6bf72', [{ field: 'wetness', max: 0.2 }, { field: 'water', equals: false }], ['dry', 'arid'], { kind: 'land-biome', targetMappings: { generatorBiome: 'desert' } }),
      contentMember('semi-arid-scrub', 'Semi-Arid Scrub', 'Shrubland and chaparral-like desert margin biome.', 'world-forge-base', ['world-forge-biomes'], '#b6a96e', [{ field: 'wetness', min: 0.2, max: 0.32 }, { field: 'water', equals: false }], ['dry', 'scrub'], { kind: 'land-biome', targetMappings: { generatorBiome: 'grassland' } }),
      contentMember('alpine', 'Alpine', 'High-elevation cold ecological band over whatever terrain creates it.', 'world-forge-base', ['world-forge-biomes'], '#c9d2c8', [{ field: 'elevationAboveSeaLevel', min: 0.46 }, { field: 'temperatureC', max: 8 }, { field: 'water', equals: false }], ['cold', 'highland'], { kind: 'overlay-biome', targetMappings: { generatorBiome: 'tundra' } })
    ]
  },
  tiles: {
    id: 'tiles',
    label: 'Tiles',
    description: 'Tile biome and terrain packs plus map-to-tile rules.',
    defaultSetId: 'world-forge-tiles',
    sets: [
      {
        id: 'world-forge-tiles',
        label: 'PW Base Tiles',
        description: 'Base tile vocabulary aligned to separate biome and terrain concepts.',
        memberIds: ['desert-biome', 'grassland-biome', 'marine-biome', 'plains-biome', 'tropical-biome', 'tundra-biome', 'flat-terrain', 'rolling-terrain', 'rough-terrain', 'mountainous-terrain', 'ridge-terrain', 'cliff-terrain', 'plateau-terrain', 'basin-terrain', 'valley-terrain', 'canyon-terrain', 'volcanic-highland-terrain', 'glaciated-terrain', 'dune-field-terrain', 'karst-terrain', 'floodplain-terrain', 'deep-ocean-terrain', 'shallow-sea-terrain', 'continental-shelf-terrain', 'coast-terrain', 'lake-terrain', 'river-channel-terrain', 'delta-terrain', 'estuary-terrain'],
        isDefault: true
      }
    ],
    members: [
      contentMember('desert-biome', 'Desert', 'Dry land biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#e3c76b', [{ field: 'wetness', max: 0.24 }], ['tile-biome', 'dry'], { kind: 'tile-biome' }),
      contentMember('grassland-biome', 'Grassland', 'Moist temperate land biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#9bbf6a', [{ field: 'wetness', min: 0.46 }, { field: 'water', equals: false }], ['tile-biome', 'land'], { kind: 'tile-biome' }),
      contentMember('marine-biome', 'Marine', 'Water biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#2f7fa6', [{ field: 'water', equals: true }], ['tile-biome', 'water'], { kind: 'tile-biome' }),
      contentMember('plains-biome', 'Plains', 'Moderate or dry open land biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#c8b873', [{ field: 'wetness', min: 0.24, max: 0.46 }, { field: 'water', equals: false }], ['tile-biome', 'land'], { kind: 'tile-biome' }),
      contentMember('tropical-biome', 'Tropical', 'Hot wet land biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#3c8b5f', [{ field: 'temperatureC', min: 21 }, { field: 'wetness', min: 0.52 }, { field: 'water', equals: false }], ['tile-biome', 'hot', 'wet'], { kind: 'tile-biome' }),
      contentMember('tundra-biome', 'Tundra', 'Cold land biome tile classification.', 'world-forge-base', ['world-forge-tiles'], '#c8d6c7', [{ field: 'temperatureC', max: 1 }, { field: 'water', equals: false }], ['tile-biome', 'cold'], { kind: 'tile-biome' }),
      contentMember('flat-terrain', 'Flat', 'Low-slope, low-relief terrain.', 'world-forge-base', ['world-forge-tiles'], '#9bbf6a', [{ field: 'water', equals: false }, { field: 'slope', max: 0.035 }], ['terrain', 'land'], { kind: 'terrain' }),
      contentMember('rolling-terrain', 'Rolling', 'Gentle hills and low local relief.', 'world-forge-base', ['world-forge-tiles'], '#aab56c', [{ field: 'water', equals: false }, { field: 'slope', min: 0.025, max: 0.065 }], ['terrain', 'land'], { kind: 'terrain' }),
      contentMember('rough-terrain', 'Rough', 'Broken foothills, badlands, and rugged terrain.', 'world-forge-base', ['world-forge-tiles'], '#a99a72', [{ field: 'water', equals: false }, { field: 'slope', min: 0.045 }], ['terrain', 'land'], { kind: 'terrain' }),
      contentMember('mountainous-terrain', 'Mountainous', 'Strong relief and high-slope mountain terrain.', 'world-forge-base', ['world-forge-tiles'], '#7f7a70', [{ field: 'water', equals: false }, { field: 'slope', min: 0.13 }], ['terrain', 'highland'], { kind: 'terrain' }),
      contentMember('ridge-terrain', 'Ridge', 'Linear high-relief crest or escarpment.', 'world-forge-base', ['world-forge-tiles'], '#8a8374', [{ field: 'water', equals: false }, { field: 'slope', min: 0.1 }], ['terrain', 'highland', 'linear'], { kind: 'terrain' }),
      contentMember('cliff-terrain', 'Cliff', 'Sharp elevation discontinuity or impassable edge.', 'world-forge-base', ['world-forge-tiles'], '#6f695f', [{ field: 'water', equals: false }, { field: 'slope', min: 0.18 }], ['terrain', 'edge'], { kind: 'terrain' }),
      contentMember('plateau-terrain', 'Plateau', 'Broad elevated flat or rolling landform.', 'world-forge-base', ['world-forge-tiles'], '#b0a47c', [{ field: 'water', equals: false }, { field: 'elevationAboveSeaLevel', min: 0.22 }, { field: 'slope', max: 0.055 }], ['terrain', 'highland'], { kind: 'terrain' }),
      contentMember('basin-terrain', 'Basin', 'Low enclosed or depositional terrain.', 'world-forge-base', ['world-forge-tiles'], '#b8ad84', [{ field: 'water', equals: false }, { field: 'elevationAboveSeaLevel', max: 0.08 }], ['terrain', 'lowland'], { kind: 'terrain' }),
      contentMember('valley-terrain', 'Valley', 'Drainage-shaped low corridor.', 'world-forge-base', ['world-forge-tiles'], '#8fb076', [{ field: 'water', equals: false }, { field: 'river', min: 0.18 }], ['terrain', 'river'], { kind: 'terrain' }),
      contentMember('canyon-terrain', 'Canyon', 'Steep river-cut valley.', 'world-forge-base', ['world-forge-tiles'], '#9b7b61', [{ field: 'water', equals: false }, { field: 'river', min: 0.18 }, { field: 'slope', min: 0.11 }], ['terrain', 'river', 'rough'], { kind: 'terrain' }),
      contentMember('volcanic-highland-terrain', 'Volcanic Highland', 'Volcanic terrain form, separate from individual volcano features.', 'world-forge-base', ['world-forge-tiles'], '#8f6d5b', [{ field: 'water', equals: false }, { field: 'volcanism', min: 0.48 }], ['terrain', 'volcanic'], { kind: 'terrain' }),
      contentMember('glaciated-terrain', 'Glaciated', 'Smoothed, scoured, or ice-shaped terrain modifier.', 'world-forge-base', ['world-forge-tiles'], '#cbd8d8', [{ field: 'ice', equals: true }], ['terrain', 'glacial'], { kind: 'terrain' }),
      contentMember('dune-field-terrain', 'Dune Field', 'Aeolian dune terrain modifier.', 'world-forge-base', ['world-forge-tiles'], '#d8bd6b', [{ field: 'wetness', max: 0.18 }, { field: 'water', equals: false }], ['terrain', 'arid'], { kind: 'terrain' }),
      contentMember('karst-terrain', 'Karst', 'Limestone, sinkhole, and cave-prone terrain modifier.', 'world-forge-base', ['world-forge-tiles'], '#b9b49c', [{ field: 'water', equals: false }, { field: 'wetness', min: 0.42 }], ['terrain', 'geologic'], { kind: 'terrain' }),
      contentMember('floodplain-terrain', 'Floodplain', 'Low depositional river terrain.', 'world-forge-base', ['world-forge-tiles'], '#b6b776', [{ field: 'water', equals: false }, { field: 'river', min: 0.32 }, { field: 'elevationAboveSeaLevel', max: 0.18 }], ['terrain', 'river'], { kind: 'terrain' }),
      contentMember('deep-ocean-terrain', 'Deep Ocean', 'Deep marine terrain.', 'world-forge-base', ['world-forge-tiles'], '#1e4f73', [{ field: 'water', equals: true }, { field: 'depthBelowSeaLevel', min: 0.18 }], ['terrain', 'water', 'marine'], { kind: 'terrain' }),
      contentMember('shallow-sea-terrain', 'Shallow Sea', 'Shallow marine water.', 'world-forge-base', ['world-forge-tiles'], '#3e8fb0', [{ field: 'water', equals: true }, { field: 'depthBelowSeaLevel', max: 0.12 }], ['terrain', 'water', 'marine'], { kind: 'terrain' }),
      contentMember('continental-shelf-terrain', 'Continental Shelf', 'Broad shallow shelf seas near continents.', 'world-forge-base', ['world-forge-tiles'], '#4f9fba', [{ field: 'water', equals: true }, { field: 'depthBelowSeaLevel', max: 0.1 }], ['terrain', 'water', 'marine', 'coastal'], { kind: 'terrain' }),
      contentMember('coast-terrain', 'Coast', 'Immediate land-water boundary terrain.', 'world-forge-base', ['world-forge-tiles'], '#88b6a4', [{ field: 'water', equals: true }, { field: 'depthBelowSeaLevel', max: 0.06 }], ['terrain', 'coastal'], { kind: 'terrain' }),
      contentMember('lake-terrain', 'Lake', 'Inland freshwater terrain.', 'world-forge-base', ['world-forge-tiles'], '#6fb2be', [{ field: 'lake', equals: true }], ['terrain', 'water', 'fresh'], { kind: 'terrain' }),
      contentMember('river-channel-terrain', 'River Channel', 'River channel or immediate river corridor terrain.', 'world-forge-base', ['world-forge-tiles'], '#8fc9d4', [{ field: 'water', equals: false }, { field: 'river', min: 0.55 }], ['terrain', 'river'], { kind: 'terrain' }),
      contentMember('delta-terrain', 'Delta', 'Depositional river mouth terrain.', 'world-forge-base', ['world-forge-tiles'], '#8bbf8a', [{ field: 'river', min: 0.45 }, { field: 'wetness', min: 0.6 }], ['terrain', 'river', 'coastal'], { kind: 'terrain' }),
      contentMember('estuary-terrain', 'Estuary', 'Tidal river-mouth terrain mixing fresh and salt water.', 'world-forge-base', ['world-forge-tiles'], '#75aeb0', [{ field: 'river', min: 0.35 }, { field: 'water', equals: true }], ['terrain', 'river', 'coastal'], { kind: 'terrain' })
    ]
  },
  features: {
    id: 'features',
    label: 'Features',
    description: 'Feature class and isolated feature packs plus map-to-feature rules.',
    defaultSetId: 'world-forge-features',
    sets: [
      {
        id: 'world-forge-features',
        label: 'PW Base Features',
        description: 'Base feature vocabulary aligned to separate feature class and isolated feature concepts.',
        memberIds: ['vegetated-class', 'wet-class', 'aquatic-class', 'floodplain-class', 'glacial-class', 'volcanic-class', 'geologic-class', 'arid-class', 'coastal-class', 'riverine-class', 'hazard-class', 'special-class', 'forest', 'rainforest', 'temperate-rainforest-feature', 'taiga', 'mangrove', 'savanna-woodland', 'sagebrush-steppe', 'scrubland', 'bamboo-forest', 'marsh', 'bog', 'swamp', 'fen', 'oasis', 'watering-hole', 'reed-beds', 'lotus-wetland', 'reef', 'atoll', 'kelp-forest', 'river-feature', 'navigable-river-feature', 'minor-river-feature', 'delta-feature', 'estuary-feature', 'desert-floodplain', 'grassland-floodplain', 'plains-floodplain', 'tropical-floodplain', 'tundra-floodplain', 'glacier', 'ice-sheet', 'sea-ice', 'snowfield', 'permafrost', 'volcano', 'caldera', 'lava-field', 'hot-springs', 'geyser-field', 'badlands', 'canyon-feature', 'mesa', 'karst-caves', 'salt-flat', 'dune-sea'],
        isDefault: true
      }
    ],
    members: [
      contentMember('vegetated-class', 'Vegetated', 'Feature class for forest, woodland, scrub, and other plant cover.', 'world-forge-base', ['world-forge-features'], '#3f8b52', [{ field: 'wetness', min: 0.42 }, { field: 'water', equals: false }], ['feature-class', 'vegetated'], { kind: 'feature-class' }),
      contentMember('wet-class', 'Wet', 'Feature class for saturated land and freshwater-adjacent features.', 'world-forge-base', ['world-forge-features'], '#6f9f78', [{ field: 'wetness', min: 0.66 }, { field: 'water', equals: false }], ['feature-class', 'wet'], { kind: 'feature-class' }),
      contentMember('aquatic-class', 'Aquatic', 'Feature class for water-associated and marine features.', 'world-forge-base', ['world-forge-features'], '#6fb2be', [{ field: 'water', equals: true }], ['feature-class', 'water'], { kind: 'feature-class' }),
      contentMember('floodplain-class', 'Floodplain', 'Feature class for river floodplain features.', 'world-forge-base', ['world-forge-features'], '#b6b776', [{ field: 'river', min: 0.32 }, { field: 'elevationAboveSeaLevel', max: 0.18 }], ['feature-class', 'river'], { kind: 'feature-class' }),
      contentMember('glacial-class', 'Glacial', 'Feature class for ice and glacial features.', 'world-forge-base', ['world-forge-features'], '#dcecef', [{ field: 'ice', equals: true }], ['feature-class', 'cold'], { kind: 'feature-class' }),
      contentMember('volcanic-class', 'Volcanic', 'Feature class for volcanoes and geothermal features.', 'world-forge-base', ['world-forge-features'], '#8f5543', [{ field: 'volcanism', min: 0.48 }], ['feature-class', 'volcanic'], { kind: 'feature-class' }),
      contentMember('geologic-class', 'Geologic', 'Feature class for exposed or distinctive geological landforms.', 'world-forge-base', ['world-forge-features'], '#9d8e77', [{ field: 'slope', min: 0.08 }], ['feature-class', 'geologic'], { kind: 'feature-class' }),
      contentMember('arid-class', 'Arid', 'Feature class for dryland, dune, and evaporative features.', 'world-forge-base', ['world-forge-features'], '#c7ad62', [{ field: 'wetness', max: 0.24 }], ['feature-class', 'dry'], { kind: 'feature-class' }),
      contentMember('coastal-class', 'Coastal', 'Feature class for coast, tidal, and shoreline features.', 'world-forge-base', ['world-forge-features'], '#79aaa1', [{ field: 'water', equals: true }], ['feature-class', 'coastal'], { kind: 'feature-class' }),
      contentMember('riverine-class', 'Riverine', 'Feature class for river-channel and riparian features.', 'world-forge-base', ['world-forge-features'], '#8fc9d4', [{ field: 'river', min: 0.12 }], ['feature-class', 'river'], { kind: 'feature-class' }),
      contentMember('hazard-class', 'Hazard', 'Feature class for dangerous or difficult terrain features.', 'world-forge-base', ['world-forge-features'], '#9a6a55', [], ['feature-class', 'hazard'], { kind: 'feature-class' }),
      contentMember('special-class', 'Special', 'Feature class for exceptional map facts and future wonders.', 'world-forge-base', ['world-forge-features'], '#b39152', [], ['feature-class', 'special'], { kind: 'feature-class' }),
      contentMember('forest', 'Forest', 'Temperate forest feature.', 'world-forge-base', ['world-forge-features'], '#4f8f55', [{ field: 'wetness', min: 0.55 }, { field: 'temperatureC', max: 21 }], ['feature', 'vegetated'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['temperate-forest', 'grassland'] } }),
      contentMember('rainforest', 'Rainforest', 'Hot wet forest feature.', 'world-forge-base', ['world-forge-features'], '#2c6f45', [{ field: 'temperatureC', min: 20 }, { field: 'wetness', min: 0.68 }], ['feature', 'vegetated', 'tropical'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['tropical-rainforest', 'tropical-seasonal-forest'] } }),
      contentMember('temperate-rainforest-feature', 'Temperate Rainforest', 'Cool wet forest feature.', 'world-forge-base', ['world-forge-features'], '#3f7c58', [{ field: 'temperatureC', max: 18 }, { field: 'wetness', min: 0.74 }], ['feature', 'vegetated', 'rainforest'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['temperate-rainforest'] } }),
      contentMember('taiga', 'Taiga', 'Cold coniferous forest feature.', 'world-forge-base', ['world-forge-features'], '#6f9367', [{ field: 'temperatureC', max: 7 }, { field: 'wetness', min: 0.42 }], ['feature', 'vegetated', 'cold'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['taiga', 'tundra'] } }),
      contentMember('mangrove', 'Mangrove', 'Warm coastal or lake-edge wet forest feature.', 'world-forge-base', ['world-forge-features'], '#477c55', [{ field: 'temperatureC', min: 18 }, { field: 'wetness', min: 0.58 }], ['feature', 'wet', 'coastal', 'vegetated'], { kind: 'feature', classIds: ['vegetated-class', 'wet-class', 'coastal-class'], compatibleWith: { biomes: ['coastal-marine', 'wetland', 'freshwater-lake'] } }),
      contentMember('savanna-woodland', 'Savanna Woodland', 'Warm seasonal woodland feature.', 'world-forge-base', ['world-forge-features'], '#6f9e50', [{ field: 'temperatureC', min: 18 }, { field: 'wetness', min: 0.5, max: 0.68 }], ['feature', 'vegetated'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['savanna', 'tropical-seasonal-forest'] } }),
      contentMember('sagebrush-steppe', 'Sagebrush Steppe', 'Dry plains and steppe vegetation feature.', 'world-forge-base', ['world-forge-features'], '#8f9b5a', [{ field: 'wetness', max: 0.34 }], ['feature', 'vegetated', 'dry'], { kind: 'feature', classIds: ['vegetated-class', 'arid-class'], compatibleWith: { biomes: ['steppe', 'semi-arid-scrub'] } }),
      contentMember('scrubland', 'Scrubland', 'Shrub-dominated dryland vegetation feature.', 'world-forge-base', ['world-forge-features'], '#9f9c65', [{ field: 'wetness', min: 0.2, max: 0.36 }], ['feature', 'vegetated', 'dry'], { kind: 'feature', classIds: ['vegetated-class', 'arid-class'], compatibleWith: { biomes: ['semi-arid-scrub', 'steppe'] } }),
      contentMember('bamboo-forest', 'Bamboo Forest', 'Dense warm wet bamboo or cane forest feature.', 'world-forge-base', ['world-forge-features'], '#4f9d54', [{ field: 'temperatureC', min: 16 }, { field: 'wetness', min: 0.62 }], ['feature', 'vegetated'], { kind: 'feature', classIds: ['vegetated-class'], compatibleWith: { biomes: ['tropical-seasonal-forest', 'temperate-rainforest'] } }),
      contentMember('marsh', 'Marsh', 'Warm saturated wetland feature.', 'world-forge-base', ['world-forge-features'], '#6f9f78', [{ field: 'temperatureC', min: 16 }, { field: 'wetness', min: 0.74 }], ['feature', 'wet'], { kind: 'feature', classIds: ['wet-class'], compatibleWith: { biomes: ['wetland', 'riverine'] } }),
      contentMember('bog', 'Bog', 'Cold acidic saturated wetland feature.', 'world-forge-base', ['world-forge-features'], '#78947c', [{ field: 'temperatureC', max: 16 }, { field: 'wetness', min: 0.74 }], ['feature', 'wet', 'cold'], { kind: 'feature', classIds: ['wet-class'], compatibleWith: { biomes: ['wetland', 'tundra'] } }),
      contentMember('swamp', 'Swamp', 'Forested saturated wetland feature.', 'world-forge-base', ['world-forge-features'], '#527c5a', [{ field: 'wetness', min: 0.74 }], ['feature', 'wet', 'vegetated'], { kind: 'feature', classIds: ['wet-class', 'vegetated-class'], compatibleWith: { biomes: ['wetland', 'temperate-forest', 'tropical-seasonal-forest'] } }),
      contentMember('fen', 'Fen', 'Mineral-rich saturated wetland feature.', 'world-forge-base', ['world-forge-features'], '#82a378', [{ field: 'wetness', min: 0.7 }], ['feature', 'wet'], { kind: 'feature', classIds: ['wet-class'], compatibleWith: { biomes: ['wetland'] } }),
      contentMember('oasis', 'Oasis', 'Desert water feature.', 'world-forge-base', ['world-forge-features'], '#7bb6a0', [{ field: 'wetness', min: 0.36 }, { field: 'temperatureC', min: 12 }], ['feature', 'wet', 'dry'], { kind: 'feature', classIds: ['wet-class', 'arid-class'], compatibleWith: { biomes: ['desert', 'semi-arid-scrub'] } }),
      contentMember('watering-hole', 'Watering Hole', 'Small dryland water feature.', 'world-forge-base', ['world-forge-features'], '#86b39c', [{ field: 'wetness', min: 0.34 }], ['feature', 'wet', 'dry'], { kind: 'feature', classIds: ['wet-class', 'arid-class'], compatibleWith: { biomes: ['savanna', 'steppe', 'desert'] } }),
      contentMember('reed-beds', 'Reed Beds', 'Dense reeds along lakes, marshes, and slow rivers.', 'world-forge-base', ['world-forge-features'], '#7f9d65', [{ field: 'wetness', min: 0.66 }], ['feature', 'wet', 'river'], { kind: 'feature', classIds: ['wet-class', 'riverine-class'], compatibleWith: { biomes: ['freshwater-lake', 'riverine', 'wetland'] } }),
      contentMember('lotus-wetland', 'Lotus Wetland', 'Warm still-water wetland vegetation feature.', 'world-forge-base', ['world-forge-features'], '#8fbf91', [{ field: 'wetness', min: 0.74 }, { field: 'temperatureC', min: 16 }], ['feature', 'wet'], { kind: 'feature', classIds: ['wet-class'], compatibleWith: { biomes: ['freshwater-lake', 'wetland'] } }),
      contentMember('reef', 'Reef', 'Shallow marine reef feature.', 'world-forge-base', ['world-forge-features'], '#76c1bd', [{ field: 'water', equals: true }], ['feature', 'aquatic'], { kind: 'feature', classIds: ['aquatic-class', 'coastal-class'], compatibleWith: { biomes: ['coastal-marine'] } }),
      contentMember('atoll', 'Atoll', 'Ring reef and lagoon feature in warm shallow seas.', 'world-forge-base', ['world-forge-features'], '#8bd0c6', [{ field: 'water', equals: true }, { field: 'temperatureC', min: 18 }], ['feature', 'aquatic'], { kind: 'feature', classIds: ['aquatic-class', 'coastal-class'], compatibleWith: { biomes: ['coastal-marine', 'open-ocean'] } }),
      contentMember('kelp-forest', 'Kelp Forest', 'Cool shallow marine vegetated feature.', 'world-forge-base', ['world-forge-features'], '#3c786b', [{ field: 'water', equals: true }, { field: 'temperatureC', max: 16 }], ['feature', 'aquatic', 'vegetated'], { kind: 'feature', classIds: ['aquatic-class', 'vegetated-class'], compatibleWith: { biomes: ['coastal-marine'] } }),
      contentMember('river-feature', 'River', 'General visible river feature.', 'world-forge-base', ['world-forge-features'], '#9fcbd0', [{ field: 'water', equals: false }, { field: 'river', min: 0.12 }], ['feature', 'river'], { kind: 'feature', classIds: ['riverine-class'], compatibleWith: { biomes: ['riverine', 'wetland', 'grassland', 'temperate-forest'] } }),
      contentMember('navigable-river-feature', 'Navigable River', 'Major river feature for transport-scale rivers.', 'world-forge-base', ['world-forge-features'], '#b0dfe2', [{ field: 'river', min: 0.62 }], ['feature', 'river'], { kind: 'feature', classIds: ['riverine-class'], compatibleWith: { biomes: ['riverine'] } }),
      contentMember('minor-river-feature', 'Minor River', 'Small river or stream feature.', 'world-forge-base', ['world-forge-features'], '#9fcbd0', [{ field: 'river', min: 0.12, max: 0.62 }], ['feature', 'river'], { kind: 'feature', classIds: ['riverine-class'], compatibleWith: { biomes: ['riverine'] } }),
      contentMember('delta-feature', 'Delta', 'River-mouth delta feature.', 'world-forge-base', ['world-forge-features'], '#8bbf8a', [{ field: 'river', min: 0.45 }, { field: 'wetness', min: 0.6 }], ['feature', 'river', 'coastal'], { kind: 'feature', classIds: ['riverine-class', 'coastal-class', 'wet-class'], compatibleWith: { biomes: ['riverine', 'coastal-marine'] } }),
      contentMember('estuary-feature', 'Estuary', 'Tidal river-mouth feature.', 'world-forge-base', ['world-forge-features'], '#75aeb0', [{ field: 'river', min: 0.35 }], ['feature', 'river', 'coastal'], { kind: 'feature', classIds: ['riverine-class', 'coastal-class'], compatibleWith: { biomes: ['riverine', 'coastal-marine'] } }),
      contentMember('desert-floodplain', 'Desert Floodplain', 'Floodplain feature through desert.', 'world-forge-base', ['world-forge-features'], '#d7bc72', [{ field: 'river', min: 0.32 }], ['feature', 'floodplain'], { kind: 'feature', classIds: ['floodplain-class'], compatibleWith: { biomes: ['desert'] } }),
      contentMember('grassland-floodplain', 'Grassland Floodplain', 'Floodplain feature through grassland.', 'world-forge-base', ['world-forge-features'], '#a9c777', [{ field: 'river', min: 0.32 }], ['feature', 'floodplain'], { kind: 'feature', classIds: ['floodplain-class'], compatibleWith: { biomes: ['grassland'] } }),
      contentMember('plains-floodplain', 'Plains Floodplain', 'Floodplain feature through plains or steppe.', 'world-forge-base', ['world-forge-features'], '#c6b978', [{ field: 'river', min: 0.32 }], ['feature', 'floodplain'], { kind: 'feature', classIds: ['floodplain-class'], compatibleWith: { biomes: ['steppe', 'semi-arid-scrub'] } }),
      contentMember('tropical-floodplain', 'Tropical Floodplain', 'Floodplain feature through tropical biomes.', 'world-forge-base', ['world-forge-features'], '#73ad65', [{ field: 'river', min: 0.32 }], ['feature', 'floodplain'], { kind: 'feature', classIds: ['floodplain-class'], compatibleWith: { biomes: ['tropical-rainforest', 'tropical-seasonal-forest', 'savanna'] } }),
      contentMember('tundra-floodplain', 'Tundra Floodplain', 'Floodplain feature through tundra.', 'world-forge-base', ['world-forge-features'], '#a9b89f', [{ field: 'river', min: 0.32 }], ['feature', 'floodplain'], { kind: 'feature', classIds: ['floodplain-class'], compatibleWith: { biomes: ['tundra'] } }),
      contentMember('glacier', 'Glacier', 'Flowing land ice feature.', 'world-forge-base', ['world-forge-features'], '#dbe9ef', [{ field: 'ice', equals: true }], ['feature', 'glacial'], { kind: 'feature', classIds: ['glacial-class'], compatibleWith: { biomes: ['ice-cap', 'alpine'] } }),
      contentMember('ice-sheet', 'Ice Sheet', 'Large permanent ice cover feature.', 'world-forge-base', ['world-forge-features'], '#eef7fb', [{ field: 'ice', equals: true }], ['feature', 'glacial'], { kind: 'feature', classIds: ['glacial-class'], compatibleWith: { biomes: ['ice-cap'] } }),
      contentMember('sea-ice', 'Sea Ice', 'Frozen ocean or coastal water feature.', 'world-forge-base', ['world-forge-features'], '#dcecef', [{ field: 'water', equals: true }, { field: 'temperatureC', max: -5 }], ['feature', 'glacial', 'aquatic'], { kind: 'feature', classIds: ['glacial-class', 'aquatic-class'], compatibleWith: { biomes: ['open-ocean', 'coastal-marine'] } }),
      contentMember('snowfield', 'Snowfield', 'Persistent snow cover feature.', 'world-forge-base', ['world-forge-features'], '#eef7fb', [{ field: 'temperatureC', max: -6 }], ['feature', 'glacial'], { kind: 'feature', classIds: ['glacial-class'], compatibleWith: { biomes: ['tundra', 'alpine', 'ice-cap'] } }),
      contentMember('permafrost', 'Permafrost', 'Frozen-ground feature.', 'world-forge-base', ['world-forge-features'], '#c8d6c7', [{ field: 'temperatureC', max: 0 }], ['feature', 'glacial'], { kind: 'feature', classIds: ['glacial-class'], compatibleWith: { biomes: ['tundra', 'taiga'] } }),
      contentMember('volcano', 'Volcano', 'Individual volcanic cone or vent feature.', 'world-forge-base', ['world-forge-features'], '#8f5543', [{ field: 'volcanism', min: 0.68 }, { field: 'elevationAboveSeaLevel', min: 0.08 }], ['feature', 'volcanic', 'hazard'], { kind: 'feature', classIds: ['volcanic-class', 'hazard-class', 'special-class'] }),
      contentMember('caldera', 'Caldera', 'Collapsed volcanic crater or volcanic basin feature.', 'world-forge-base', ['world-forge-features'], '#8b6a57', [{ field: 'volcanism', min: 0.58 }], ['feature', 'volcanic', 'geologic'], { kind: 'feature', classIds: ['volcanic-class', 'geologic-class'] }),
      contentMember('lava-field', 'Lava Field', 'Recent or exposed lava terrain feature.', 'world-forge-base', ['world-forge-features'], '#6f5148', [{ field: 'volcanism', min: 0.55 }], ['feature', 'volcanic', 'hazard'], { kind: 'feature', classIds: ['volcanic-class', 'hazard-class'] }),
      contentMember('hot-springs', 'Hot Springs', 'Geothermal spring feature.', 'world-forge-base', ['world-forge-features'], '#78b9aa', [{ field: 'volcanism', min: 0.35 }, { field: 'wetness', min: 0.35 }], ['feature', 'volcanic', 'wet'], { kind: 'feature', classIds: ['volcanic-class', 'wet-class'] }),
      contentMember('geyser-field', 'Geyser Field', 'Clustered geyser/geothermal feature.', 'world-forge-base', ['world-forge-features'], '#93b7a4', [{ field: 'volcanism', min: 0.42 }, { field: 'wetness', min: 0.35 }], ['feature', 'volcanic', 'wet'], { kind: 'feature', classIds: ['volcanic-class', 'wet-class', 'special-class'] }),
      contentMember('badlands', 'Badlands', 'Eroded dry geologic feature.', 'world-forge-base', ['world-forge-features'], '#b08c65', [{ field: 'wetness', max: 0.28 }, { field: 'slope', min: 0.045 }], ['feature', 'geologic', 'dry'], { kind: 'feature', classIds: ['geologic-class', 'arid-class'] }),
      contentMember('canyon-feature', 'Canyon', 'Steep river-cut geologic feature.', 'world-forge-base', ['world-forge-features'], '#9b7b61', [{ field: 'river', min: 0.18 }, { field: 'slope', min: 0.11 }], ['feature', 'geologic', 'river'], { kind: 'feature', classIds: ['geologic-class', 'riverine-class'] }),
      contentMember('mesa', 'Mesa', 'Flat-topped isolated highland feature.', 'world-forge-base', ['world-forge-features'], '#a78664', [{ field: 'wetness', max: 0.34 }, { field: 'elevationAboveSeaLevel', min: 0.18 }], ['feature', 'geologic', 'dry'], { kind: 'feature', classIds: ['geologic-class', 'arid-class'] }),
      contentMember('karst-caves', 'Karst Caves', 'Cave and sinkhole karst feature.', 'world-forge-base', ['world-forge-features'], '#b9b49c', [{ field: 'wetness', min: 0.42 }], ['feature', 'geologic'], { kind: 'feature', classIds: ['geologic-class'] }),
      contentMember('salt-flat', 'Salt Flat', 'Evaporative salt pan feature.', 'world-forge-base', ['world-forge-features'], '#d8d0b7', [{ field: 'wetness', max: 0.16 }], ['feature', 'arid', 'geologic'], { kind: 'feature', classIds: ['arid-class', 'geologic-class'], compatibleWith: { biomes: ['inland-saltwater', 'desert'] } }),
      contentMember('dune-sea', 'Dune Sea', 'Large sand dune field feature.', 'world-forge-base', ['world-forge-features'], '#d8bd6b', [{ field: 'wetness', max: 0.14 }], ['feature', 'arid'], { kind: 'feature', classIds: ['arid-class'], compatibleWith: { biomes: ['desert'] } })
    ]
  },
  resources: {
    id: 'resources',
    label: 'Resources',
    description: 'Resource packs and placement-rule placeholders.',
    defaultSetId: 'world-forge-resources',
    sets: [
      {
        id: 'world-forge-resources',
        label: 'PW Base Resources',
        description: 'Base resource set for future placement rules and icon attachments.',
        memberIds: ['cattle', 'fish', 'gold', 'gypsum', 'hardwood', 'hides', 'horses', 'incense', 'iron', 'ivory', 'jade', 'kaolin', 'lapis-lazuli', 'limestone', 'llamas', 'mangoes', 'marble', 'pearls', 'rice', 'rubies', 'salt', 'silk', 'silver', 'tin', 'turtles', 'wild-game', 'wine'],
        isDefault: true
      }
    ],
    members: [
      ...['cattle', 'fish', 'gold', 'gypsum', 'hardwood', 'hides', 'horses', 'incense', 'iron', 'ivory', 'jade', 'kaolin', 'lapis-lazuli', 'limestone', 'llamas', 'mangoes', 'marble', 'pearls', 'rice', 'rubies', 'salt', 'silk', 'silver', 'tin', 'turtles', 'wild-game', 'wine'].map((id) =>
        contentMember(id, titleCase(id), 'Resource placeholder. Placement and yield rules are intentionally deferred until the resource cutover.', 'world-forge-base', ['world-forge-resources'], '#c9b56b', [], ['resource'], { kind: 'resource-placeholder' })
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
    topologyResolution: topologyResolutionForOutput(resolution),
    outputResolution: resolution,
    projection: 'equirectangular',
    wrapMode: 'east-west'
  };
}

export function cloneParameterRanges(ranges: ParameterRanges): ParameterRanges {
  return Object.fromEntries(Object.entries(ranges).map(([key, range]) => [key, { ...range }])) as ParameterRanges;
}

export function topologyResolutionForOutput(resolution: Resolution): number {
  return Math.max(16, Math.round(Math.min(resolution.width, resolution.height) / 2));
}

function contentMember(
  id: string,
  label: string,
  description: string,
  source: string,
  setIds: string[],
  previewColor: string,
  rules: ContentRule[],
  tags: string[],
  metadata: Partial<Pick<ContentMember, 'kind' | 'parentIds' | 'classIds' | 'compatibleWith' | 'targetMappings'>> = {}
): ContentMember {
  return {
    id,
    label,
    description,
    source,
    setIds,
    ...metadata,
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

const cubedSphereTopologyCache = new Map<number, CubedSphereTopology>();

export function buildCubedSphereTopology(resolution: number): CubedSphereTopology {
  const size = Math.max(2, Math.round(resolution));
  const cached = cubedSphereTopologyCache.get(size);
  if (cached) return cached;
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

  const topology: CubedSphereTopology = {
    kind: 'cubed-sphere',
    resolution: size,
    cellCount,
    positions,
    latitudes,
    longitudes,
    areaWeights,
    neighbors
  };
  cubedSphereTopologyCache.set(size, topology);
  return topology;
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
