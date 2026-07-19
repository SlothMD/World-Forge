import { type CoastlineTreatment, type MapMode, type MapTheme, type RenderMode } from '@world-forge/renderer';
import { type HexTileFeature, type WorldProject } from '@world-forge/shared';
export type ExportKey = 'png' | 'svg' | 'json' | 'wforge' | 'hexSvg' | 'tileJson' | 'vtt';
export type ExportTaskState = {
    status: 'idle' | 'running' | 'complete' | 'error';
    progress: number;
    message: string;
};
type Resolution = {
    width: number;
    height: number;
};
type UseExportCommandsArgs = {
    project: WorldProject | null;
    mapTheme: MapTheme;
    showRivers: boolean;
    showPlates: boolean;
    mapMode: MapMode;
    coastlineTreatment: CoastlineTreatment;
    renderMode: RenderMode;
    exportResolution: Resolution;
    tileWidth: number;
    tileHeight: number;
    tileFeatures: HexTileFeature[];
    vttResolution: Resolution;
    vttGridEnabled: boolean;
    vttHexSizeMiles: number;
    drawVttHexGridOverlay: (canvas: HTMLCanvasElement, project: WorldProject, hexSizeMiles: number) => void;
};
export declare function useExportCommands(args: UseExportCommandsArgs): {
    exportTasks: Record<ExportKey, ExportTaskState>;
    downloadPng: () => Promise<void>;
    downloadJson: () => Promise<void>;
    downloadSvg: () => Promise<void>;
    downloadHexGridSvg: () => Promise<void>;
    downloadHexTileJson: () => Promise<void>;
    downloadPackage: () => Promise<void>;
    downloadVttPackage: () => Promise<void>;
};
export {};
