import { SerializableLayer, WorldProject } from '@world-forge/shared';
export declare function projectToJson(project: WorldProject): string;
export declare function exportSvg(project: WorldProject): string;
export declare function exportWforge(project: WorldProject): Promise<Blob>;
export declare function importWforge(file: File): Promise<WorldProject>;
export declare function serializeProject(project: WorldProject): {
    primaryWorld: {
        layers: SerializableLayer[];
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