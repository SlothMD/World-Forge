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
export type Biome = 'ocean' | 'ice_cap' | 'tundra' | 'desert' | 'grassland' | 'forest' | 'rainforest' | 'mountain' | 'wetland';
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
export type HexTileFeatureDetail = 'bog' | 'marsh' | 'watering-hole' | 'oasis' | 'mangrove' | 'taiga' | 'forest' | 'savanna-woodland' | 'sagebrush-steppe' | 'rainforest' | 'aquatic' | 'floodplain' | 'river' | 'volcano' | 'snow' | 'ice';
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
export declare const biomeNames: Biome[];
export declare function biomeToCode(biome: Biome): number;
export declare function codeToBiome(code: number): Biome;
export declare const defaultBiomeClassificationRules: BiomeClassificationRule[];
export declare function classifyBiomeFromRules(input: BiomeRuleInput, rules?: BiomeClassificationRule[]): Biome;
export declare const defaultHexTileBiomeRules: HexTileBiomeRule[];
export declare function classifyHexBiomeFromRules(input: HexBiomeRuleInput, rules?: HexTileBiomeRule[]): HexTileBiome;
export declare const defaultHexTileMorphologyRules: HexTileMorphologyRule[];
export declare function classifyHexMorphologyFromRules(input: HexMorphologyRuleInput, rules?: HexTileMorphologyRule[]): HexTileMorphology;
export declare const defaultHexTileFeatureRules: HexTileFeatureRule[];
export declare function classifyHexFeaturesFromRules(input: HexFeatureRuleInput, rules?: HexTileFeatureRule[]): HexTileFeature[];
export declare const defaultHexFeatureDetailRules: HexFeatureDetailRule[];
export declare function classifyHexFeatureDetailsFromRules(input: HexFeatureRuleInput, rules?: HexFeatureDetailRule[]): HexTileFeatureDetail[];
export declare const defaultHexTileTerrainNameRules: HexTileTerrainNameRule[];
export declare function hexTerrainTypeNameFromRules(biome: HexTileBiome, morphology: HexTileMorphology, rules?: HexTileTerrainNameRule[]): string;
export declare const defaultHexTileColorStyles: HexTileColorStyle[];
export declare const defaultHexTileClassificationRules: HexTileClassificationRules;
export declare function hexTileColorRampFromRules(rules?: HexTileClassificationRules): Record<string, string>;
export declare function contentRuleMatches(input: Record<string, unknown>, rule: ContentRule): boolean;
export declare const civ7StyleHexTileProfile: HexTileProfile;
export declare const hexTileMapPresets: HexTileMapPreset[];
export declare const defaultContentLibrary: ContentLibraryConfig;
export declare const defaultParameterRanges: ParameterRanges;
export declare const parameterControlBounds: ParameterRanges;
export declare function createDefaultConfig(seed?: string, resolution?: Resolution): GenerationConfig;
export declare function cloneParameterRanges(ranges: ParameterRanges): ParameterRanges;
export declare function topologyResolutionForOutput(resolution: Resolution): number;
export declare function layerIndex(x: number, y: number, width: number): number;
export declare function wrapX(x: number, width: number): number;
export declare function clamp(value: number, min?: number, max?: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function normalizeValue(value: number, min: number, max: number): number;
export declare function buildCubedSphereTopology(resolution: number): CubedSphereTopology;
export declare function cubedSphereCellIndex(face: number, x: number, y: number, resolution: number): number;
export declare function cubedSphereCellForLonLat(topology: CubedSphereTopology, longitude: number, latitude: number): number;
export declare function cubedSphereCellForVector(topology: CubedSphereTopology, x: number, y: number, z: number): number;
//# sourceMappingURL=types.d.ts.map