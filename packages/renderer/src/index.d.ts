import { PrimaryWorld, SurfaceElevationBand, SurfaceMorphology, WorldProject } from '@world-forge/shared';
export type MapTheme = {
    name: string;
    colors: Record<string, string>;
};
export type MapMode = 'biomes' | 'elevation' | 'heightmap' | 'temperature' | 'rainfall' | 'climate-moisture' | 'climate-precipitation' | 'wetness-delta' | 'wind' | 'current' | 'water-mask' | 'sea-level' | 'water-depth' | 'slope' | 'topology-face' | 'terrain-only';
export type CoastlineTreatment = 'bare' | 'toned' | 'outlined';
export type RenderMode = 'data' | 'natural';
export type InspectionSource = 'map' | 'globe';
export type PointInspectionRecord = {
    source: InspectionSource;
    seed: string;
    projectId: string;
    generation: {
        configSeed: string;
        starSeed?: string;
        worldSeed: string;
        starPresetId?: string;
        worldPresetId?: string;
        outputResolution: {
            width: number;
            height: number;
        };
        topologyResolution?: number;
        selectedValues: Record<string, number>;
    };
    screen?: {
        x: number;
        y: number;
    };
    map?: {
        x: number;
        y: number;
    };
    geo: {
        latitude: number;
        longitude: number;
    };
    equirectangular: {
        x: number;
        y: number;
        index: number;
        width: number;
        height: number;
    };
    topology: {
        kind: string;
        face: number;
        x: number;
        y: number;
        index: number;
        resolution: number;
    };
    worldData: {
        biome: string;
        topologyBiome: string;
        climateRegime?: string;
        terrainClass: 'marine' | SurfaceMorphology;
        elevationBand: 'marine' | SurfaceElevationBand;
        elevation: number;
        topologyElevation: number;
        seaLevel: number;
        elevationRelativeToSeaLevel: number;
        topologyElevationRelativeToSeaLevel: number;
        isWater: boolean;
        isLake: boolean;
        isIce: boolean;
        permanentIce: boolean;
        elevationDrivenTreeline: boolean;
        elevationDrivenSnowline: boolean;
        temperatureC: number;
        wetness: number;
        slope: number;
        hillshade: number;
        river: number;
        plateId: number;
        topologyPlateId: number;
        volcanism: number;
    };
    renderData: {
        mode: RenderMode;
        mapMode: MapMode;
        baseBiomeColor: string;
        depthColor: string;
        sourceMatchesTopology: boolean;
        sourceToFinalColorDistance: number;
        coastalBlend: number;
        seabedTint: number;
        rockBlend: number;
        snowTint: number;
        reliefLight: number;
        elevationTint: number;
        grainNoise: number;
        hillshade: number;
        finalAlbedo: string;
        interpretation: string;
        oceanShellEnabled: boolean;
        oceanShellOpacity: number;
        atmosphereEnabled: boolean;
    };
};
export type RenderOptions = {
    rivers: boolean;
    plates: boolean;
    heightmap: boolean;
    coastlineTreatment?: CoastlineTreatment;
    renderMode?: RenderMode;
    mode?: MapMode;
    targetResolution?: {
        width: number;
        height: number;
    };
};
export declare const cleanGameMapTheme: MapTheme;
export type DerivedRenderLayers = {
    landDistanceToWater: Float32Array;
    waterDistanceToLand: Float32Array;
    slope: Float32Array;
    hillshade: Float32Array;
    landElevationLow: number;
    landElevationHigh: number;
    surfaceElevationBand: Uint8Array;
    surfaceMorphology: Uint8Array;
    surfacePermanentIce: Uint8Array;
    surfaceTreeline: Uint8Array;
    surfaceSnowline: Uint8Array;
};
export type BiomeRenderParityDiagnostics = {
    projectedBiomeFingerprint: string;
    topologyBiomeFingerprint: string;
    naturalLandAlbedoFingerprint: string;
    landCellCount: number;
    actualIceLandShare: number;
    paleNonIceLandShare: number;
    meanNonIceColorDistanceFromIce: number;
};
export declare function createDerivedRenderLayers(world: PrimaryWorld): DerivedRenderLayers;
export declare function renderWorldToCanvas(canvas: HTMLCanvasElement, project: WorldProject, theme?: MapTheme, visible?: RenderOptions): void;
export declare function inspectWorldPoint(project: WorldProject, input: {
    source: InspectionSource;
    x: number;
    y: number;
    screen?: {
        x: number;
        y: number;
    };
}, theme?: MapTheme, renderMode?: RenderMode, mapMode?: MapMode): PointInspectionRecord;
export declare function analyzeBiomeRenderParity(project: WorldProject, theme?: MapTheme): BiomeRenderParityDiagnostics;
export declare function worldToSvg(project: WorldProject, theme?: MapTheme): string;
export declare function landElevationPercentileRange(values: Float32Array, water: Uint8Array, lowPercentile: number, highPercentile: number): [number, number];
export declare function naturalSnowTintStrength(input: {
    ice: boolean;
    temperatureC: number;
    landElevation01: number;
    altitudeAboveSeaLevel: number;
    slope: number;
}): number;
//# sourceMappingURL=index.d.ts.map