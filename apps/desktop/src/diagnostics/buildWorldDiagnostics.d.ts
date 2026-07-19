import { HexTileExportConfig, SurfaceElevationBand, SurfaceReliefCharacter, WorldProject } from '@world-forge/shared';
import { MapTheme } from '@world-forge/renderer';
export type DiagnosticSeverity = 'ok' | 'warn' | 'info';
export type DiagnosticFinding = {
    id: string;
    severity: DiagnosticSeverity;
    scope: 'world' | 'export' | 'performance' | 'renderer' | 'project';
    title: string;
    detail: string;
};
export type DiagnosticChartDatum = {
    label: string;
    value: number;
    color: string;
};
export type WorldDiagnosticsSummary = {
    generation: {
        appVersion: string;
        currentAppVersion: string;
        generatedAt: string;
        seed: string;
        starSeed: string;
        worldSeed: string;
        worldPreset: string;
        outputResolution: string;
        topologyResolution: number;
        selectedValues: Array<{
            label: string;
            value: string;
        }>;
    };
    health: {
        score: number;
        label: string;
    };
    hydrology: {
        namedRivers: number;
        topologyRiverCells: number;
        sourceCandidateCount?: number;
        terrainHeadwaterCandidateShare?: number;
        topologyRiverCellShare?: number;
        namedRiverPathCellShare?: number;
        shortRiverShare?: number;
        namedRiverCapacityUse?: number;
        riverDistributionEvenness?: number;
        riverTermini: Record<string, number>;
        riverBearingHexes: number;
        minorRiverEdges: number;
        navigableRiverEdges: number;
        navigableRiverHexes: number;
    };
    features: {
        volcanoTiles: number;
        ridgeEdges: number;
        mountainHexes: number;
        lakeHexes: number;
    };
    geography: {
        surfaceStructureModelVersion: string;
        reliefCharacter: SurfaceReliefCharacter;
        highestElevation: number;
        highestElevationBand: SurfaceElevationBand;
        highestPointLatitude: number;
        highestPointLongitude: number;
        highestPointMapX: number;
        highestPointMapY: number;
        elevatedLandShare: number;
        ruggedOrMountainousShare: number;
        mountainousLandShare: number;
        elevationDrivenTreelineShare: number;
        elevationDrivenSnowlineShare: number;
        permanentIceLandShare: number;
        collapsedBiomeComponents: number;
        collapsedBiomeCells: number;
        transitionAnomalyCount: number;
        transitionAnomalyShare: number;
        projectedBiomeFingerprint: string;
        topologyBiomeFingerprint: string;
        naturalLandAlbedoFingerprint: string;
        actualIceLandShare: number;
        paleNonIceLandShare: number;
        meanNonIceColorDistanceFromIce: number;
    };
    export: {
        hexDimensions: string;
        riverTilePercentage: number;
        hexTileCount: number;
    };
    climate?: {
        pipelineVersion: string;
        fidelity: string;
        seasonalFrameCount: number;
        landSeasonalSwingC: number;
        oceanSeasonalSwingC: number;
        seasonalTemperatureSwingC: number;
        meanIceAlbedoCoolingC: number;
        itczLatitudeDeg?: number;
        windTopographicDeflectionIndex?: number;
        meanOrographicLiftIndex?: number;
        meanCurrentSpeed?: number;
        coastalCurrentDeflectionIndex?: number;
        meanCandidateWetness?: number;
        meanCurrentWetness?: number;
        meanWetnessDelta?: number;
        wetnessCorrelation?: number;
        riverSourceSupportIndex?: number;
    };
    charts: {
        biomes: DiagnosticChartDatum[];
        elevation: DiagnosticChartDatum[];
        terrain: DiagnosticChartDatum[];
        water: DiagnosticChartDatum[];
        waterDepth: DiagnosticChartDatum[];
    };
    findings: DiagnosticFinding[];
};
export declare function buildWorldDiagnostics(project: WorldProject, tileConfig: Partial<HexTileExportConfig>, theme: MapTheme): WorldDiagnosticsSummary;
