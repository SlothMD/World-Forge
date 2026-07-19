import { HexTileExportConfig, HexTileMap, SerializableLayer, SerializableTopologyLayer, WorldProject } from '@world-forge/shared';
import { MapTheme } from '@world-forge/renderer';
export type VttGridKind = 'none' | 'hex-pointy';
export type VttExportConfig = {
    width: number;
    height: number;
    grid: {
        kind: VttGridKind;
        hexSizeMiles: number;
        hexSizePx?: number;
    };
};
export declare function projectToJson(project: WorldProject, pretty?: boolean): string;
export declare function exportSvg(project: WorldProject, theme?: MapTheme): string;
export declare function exportHexGridSvg(project: WorldProject, config?: Partial<HexTileExportConfig>): string;
export declare function exportHexTileMapJson(project: WorldProject, config?: Partial<HexTileExportConfig>): string;
export declare function exportVttMetadata(project: WorldProject, config?: Partial<VttExportConfig>): string;
export declare function exportVttGridSvg(project: WorldProject, config?: Partial<VttExportConfig>): string;
export declare function generateVttMetadata(project: WorldProject, config?: Partial<VttExportConfig>): {
    format: string;
    formatVersion: number;
    sourceProjectId: string;
    sourceWorldId: string;
    projectName: string;
    seed: string;
    generatedAt: string;
    image: {
        file: string;
        gridFile: string | null;
        width: number;
        height: number;
        projection: "equirectangular";
        wrapMode: "east-west";
    };
    grid: {
        file: string | null;
        kind: VttGridKind;
        hexSizePx: number | null | undefined;
        hexSizeMiles: number | null;
        orientation: string | null;
        columns: number;
        rows: number;
    };
    notes: string[];
};
export declare function generateHexTileMap(project: WorldProject, config?: Partial<HexTileExportConfig>): HexTileMap;
export declare function exportWforge(project: WorldProject, options?: {
    compressionLevel?: number;
    onProgress?: (percent: number) => void;
}): Promise<Blob>;
export declare function importWforge(file: File): Promise<WorldProject>;
export declare function serializeProject(project: WorldProject, options?: {
    includeLayerData?: boolean;
}): {
    primaryWorld: {
        layers: SerializableLayer[];
        topologyLayers: SerializableTopologyLayer[];
        biomeLegend: import("@world-forge/shared").Biome[];
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
            resolution: import("@world-forge/shared").Resolution;
            projection: import("@world-forge/shared").Projection;
            wrapMode: import("@world-forge/shared").WrapMode;
        };
        topology: import("@world-forge/shared").WorldTopologySummary;
        hexOverlay?: import("@world-forge/shared").WorldHexOverlay;
        regions?: import("@world-forge/shared").WorldRegionSet;
        climate?: import("@world-forge/shared").ClimatePipelineOutput;
        plates: import("@world-forge/shared").Plate[];
        rivers: import("@world-forge/shared").River[];
    };
    projectId: string;
    projectName: string;
    createdAt: string;
    updatedAt: string;
    appVersion: string;
    generatorVersion: string;
    seed: string;
    config: import("@world-forge/shared").GenerationConfig;
    selectedValues: import("@world-forge/shared").SelectedValues;
    solarSystem: import("@world-forge/shared").SolarSystem;
    metrics: import("@world-forge/shared").WorldMetrics;
    exports: {
        packageExtension: ".wforge";
        supportedFormats: Array<"png" | "svg" | "json" | "wforge">;
    };
};
export declare function deserializeProject(serialized: any): WorldProject;
//# sourceMappingURL=index.d.ts.map