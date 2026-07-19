import { useState } from 'react';
import JSZip from 'jszip';
import { exportHexGridSvg, exportHexTileMapJson, exportSvg, exportVttGridSvg, exportVttMetadata, exportWforge, projectToJson } from '@world-forge/exporters';
import { renderWorldToCanvas, type CoastlineTreatment, type MapMode, type MapTheme, type RenderMode } from '@world-forge/renderer';
import { civ7StyleHexTileProfile, type HexTileFeature, type WorldProject } from '@world-forge/shared';

export type ExportKey = 'png' | 'svg' | 'json' | 'wforge' | 'hexSvg' | 'tileJson' | 'vtt';
export type ExportTaskState = {
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  message: string;
};

type Resolution = { width: number; height: number };
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

const exportKeys: ExportKey[] = ['png', 'svg', 'json', 'wforge', 'hexSvg', 'tileJson', 'vtt'];

function initialExportTasks(): Record<ExportKey, ExportTaskState> {
  return Object.fromEntries(exportKeys.map((key) => [key, { status: 'idle', progress: 0, message: '' }])) as Record<ExportKey, ExportTaskState>;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to encode canvas')), type));
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'world';
}

export function useExportCommands(args: UseExportCommandsArgs) {
  const {
    project,
    mapTheme,
    showRivers,
    showPlates,
    mapMode,
    coastlineTreatment,
    renderMode,
    exportResolution,
    tileWidth,
    tileHeight,
    tileFeatures,
    vttResolution,
    vttGridEnabled,
    vttHexSizeMiles,
    drawVttHexGridOverlay
  } = args;
  const [exportTasks, setExportTasks] = useState<Record<ExportKey, ExportTaskState>>(() => initialExportTasks());

  const setExportTask = (key: ExportKey, partial: Partial<ExportTaskState>) => {
    setExportTasks((current) => ({ ...current, [key]: { ...current[key], ...partial } }));
  };

  const runExport = async (key: ExportKey, label: string, task: (progress: (value: number) => void) => Promise<void>) => {
    try {
      setExportTask(key, { status: 'running', message: label, progress: 0.03 });
      await nextPaint();
      await task((value) => setExportTask(key, { progress: Math.max(0.03, Math.min(0.98, value)) }));
      setExportTask(key, { status: 'complete', message: 'Done', progress: 1 });
      window.setTimeout(() => setExportTask(key, { status: 'idle', message: '', progress: 0 }), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setExportTask(key, { status: 'error', message, progress: 1 });
      console.error(error);
      window.setTimeout(() => setExportTask(key, { status: 'idle', message: '', progress: 0 }), 5000);
    }
  };

  const tileExportConfig = () => ({ width: tileWidth, height: tileHeight, profileId: civ7StyleHexTileProfile.id, enabledFeatures: tileFeatures });

  const downloadPng = async () => {
    if (!project) return;
    await runExport('png', 'Rendering PNG...', async (progress) => {
      const canvas = document.createElement('canvas');
      const showRiverOverlay = showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap';
      renderWorldToCanvas(canvas, project, mapTheme, { rivers: showRiverOverlay, plates: showPlates, heightmap: mapMode === 'elevation', coastlineTreatment, renderMode, mode: mapMode, targetResolution: exportResolution });
      progress(0.65);
      downloadBlob(await canvasToBlob(canvas, 'image/png'), project.projectName + '.png');
    });
  };

  const downloadJson = async () => {
    if (!project) return;
    await runExport('json', 'Preparing JSON...', async (progress) => {
      const json = projectToJson(project, false);
      progress(0.85);
      await nextPaint();
      downloadBlob(new Blob([json], { type: 'application/json' }), project.projectName + '.json');
    });
  };

  const downloadSvg = async () => {
    if (!project) return;
    await runExport('svg', 'Preparing SVG...', async (progress) => {
      const svg = exportSvg(project, mapTheme);
      progress(0.85);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), project.projectName + '.svg');
    });
  };

  const downloadHexGridSvg = async () => {
    if (!project) return;
    await runExport('hexSvg', 'Preparing hex SVG...', async (progress) => {
      const svg = exportHexGridSvg(project, tileExportConfig());
      progress(0.85);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), project.projectName + '-hex-grid.svg');
    });
  };

  const downloadHexTileJson = async () => {
    if (!project) return;
    await runExport('tileJson', 'Preparing tile JSON...', async (progress) => {
      const json = exportHexTileMapJson(project, tileExportConfig());
      progress(0.85);
      downloadBlob(new Blob([json], { type: 'application/json' }), project.projectName + '-hex-tiles.json');
    });
  };

  const downloadPackage = async () => {
    if (!project) return;
    await runExport('wforge', 'Preparing .wforge...', async (progress) => {
      const blob = await exportWforge(project, { compressionLevel: 1, onProgress: progress });
      downloadBlob(blob, project.projectName + '.wforge');
    });
  };

  const downloadVttPackage = async () => {
    if (!project) return;
    await runExport('vtt', 'Preparing VTT ZIP...', async (progress) => {
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      renderWorldToCanvas(canvas, project, mapTheme, { rivers: showRivers, plates: false, heightmap: false, coastlineTreatment, renderMode, mode: 'biomes', targetResolution: vttResolution });
      progress(0.22);
      const config = { width: vttResolution.width, height: vttResolution.height, grid: { kind: vttGridEnabled ? 'hex-pointy' as const : 'none' as const, hexSizeMiles: vttHexSizeMiles } };
      const baseName = safeFileName(project.projectName);
      const imageBlob = await canvasToBlob(canvas, 'image/png');
      zip.file(baseName + '-vtt-map.png', imageBlob);
      zip.file(baseName + '-vtt-metadata.json', exportVttMetadata(project, config));
      if (vttGridEnabled) {
        drawVttHexGridOverlay(canvas, project, vttHexSizeMiles);
        zip.file(baseName + '-vtt-map-grid.png', await canvasToBlob(canvas, 'image/png'));
        zip.file(baseName + '-vtt-grid.svg', exportVttGridSvg(project, config));
      }
      progress(0.62);
      downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }, (metadata) => progress(0.62 + metadata.percent * 0.0035)), project.projectName + '-vtt.zip');
    });
  };

  return { exportTasks, downloadPng, downloadJson, downloadSvg, downloadHexGridSvg, downloadHexTileJson, downloadPackage, downloadVttPackage };
}
