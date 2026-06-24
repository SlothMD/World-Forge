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
export declare const biomeNames: Biome[];
export declare function biomeToCode(biome: Biome): number;
export declare function codeToBiome(code: number): Biome;
export declare const defaultParameterRanges: ParameterRanges;
export declare function createDefaultConfig(seed?: string, resolution?: Resolution): GenerationConfig;
export declare function layerIndex(x: number, y: number, width: number): number;
export declare function wrapX(x: number, width: number): number;
export declare function clamp(value: number, min?: number, max?: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function normalizeValue(value: number, min: number, max: number): number;
//# sourceMappingURL=index.d.ts.map