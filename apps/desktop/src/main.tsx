import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cloud, Download, FileJson, FolderOpen, Hexagon, Image, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCw, Save, Settings, Shuffle, Upload, User, X } from 'lucide-react';
import JSZip from 'jszip';
import * as THREE from 'three';
import { GenerationPreviewFrame, createDefaultConfig, generateProject } from '@world-forge/generator-core';
import { deserializeProject, exportHexGridSvg, exportHexTileMapJson, exportSvg, exportVttGridSvg, exportVttMetadata, exportWforge, importWforge, projectToJson, serializeProject } from '@world-forge/exporters';
import { CoastlineTreatment, MapMode, cleanGameMapTheme, renderWorldToCanvas } from '@world-forge/renderer';
import {
  GenerationConfig,
  HexTileFeature,
  ContentCategory,
  ContentCategoryConfig,
  ContentLibraryConfig,
  ContentMember,
  ContentRule,
  NumericRange,
  ParameterRanges,
  WorldProject,
  biomeNames,
  civ7StyleHexTileProfile,
  codeToBiome,
  defaultContentLibrary,
  hexTileMapPresets,
  parameterControlBounds
} from '@world-forge/shared';
import {
  CloudSyncSettings,
  LocalUserIdentity,
  SavedMapRecord,
  buildSyncEnvelope,
  buildWorkspaceSettings,
  isLoggedIn,
  isLocalOnlyIdentity,
  loadCloudSyncSettings,
  loadIdentity,
  loadWorkspaceSettings,
  pullSyncEnvelope,
  pushSyncEnvelope,
  saveCloudSyncSettings,
  saveIdentity,
  saveWorkspaceSettings,
  syncIdentity
} from './sync';
import { ExternalAccountIdentity, detectSteamIdentity, googleSignInAvailable, signInWithGoogle } from './accountProviders';
import './styles.css';

type RangeKey = keyof ParameterRanges;
type ViewMode = 'map' | 'globe';
type RightPanelTab = 'world' | 'hex';
type LeftPanelTab = 'generator' | 'worlds';
type ExportKey = 'png' | 'svg' | 'json' | 'wforge' | 'hexSvg' | 'tileJson' | 'vtt';
type ExportTaskState = {
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  message: string;
};
type ConfigTab = ContentCategory | 'sync';

const rangeLabels: Record<RangeKey, string> = {
  systemAgeGy: 'System age',
  oceanPercentage: 'Ocean',
  averageTemperatureC: 'Avg temp',
  aridity: 'Aridity',
  seaLevel: 'Sea level',
  axialTiltDeg: 'Axial tilt',
  orbitalEccentricity: 'Eccentricity',
  sizeClass: 'Size',
  moonCount: 'Moons',
  impactFrequency: 'Impacts',
  plateCount: 'Plates',
  riverDensity: 'Rivers',
  continentCount: 'Regions',
  continentScale: 'Continents',
  islandDensity: 'Islands'
};

const defaultSeed = '1001001';

const resolutionOptions = [
  { label: 'Fast 256 x 128', width: 256, height: 128 },
  { label: 'Default 512 x 256', width: 512, height: 256 },
  { label: 'Large 1024 x 512', width: 1024, height: 512 },
  { label: 'High 2048 x 1024', width: 2048, height: 1024 },
  { label: 'Ultra 4096 x 2048', width: 4096, height: 2048 }
];

const previewResolutionOptions = [
  { label: 'Compact preview 512 x 256', width: 512, height: 256 },
  { label: 'Detailed preview 1024 x 512', width: 1024, height: 512 },
  { label: 'Source resolution', width: 0, height: 0 }
];

const defaultHexPreset = hexTileMapPresets.find((preset) => preset.id === 'civ7-style-standard') ?? hexTileMapPresets[0];
const tileFeatureLabels: Record<HexTileFeature, string> = {
  vegetated: 'Vegetated',
  wet: 'Wet',
  floodplain: 'Floodplain',
  'minor-river': 'Minor rivers',
  'navigable-river': 'Navigable rivers',
  snow: 'Snow',
  ice: 'Ice',
  aquatic: 'Aquatic'
};

const exportKeys: ExportKey[] = ['png', 'svg', 'json', 'wforge', 'hexSvg', 'tileJson', 'vtt'];

function initialExportTasks(): Record<ExportKey, ExportTaskState> {
  return Object.fromEntries(exportKeys.map((key) => [key, { status: 'idle', progress: 0, message: '' }])) as Record<ExportKey, ExportTaskState>;
}

function normalizeTileFeatures(features: string[] | undefined): HexTileFeature[] {
  const source = features?.length ? features : civ7StyleHexTileProfile.features;
  const normalized = new Set<HexTileFeature>();
  for (const feature of source) {
    if (feature === 'river') {
      normalized.add('minor-river');
      normalized.add('navigable-river');
    } else if (civ7StyleHexTileProfile.features.includes(feature as HexTileFeature)) {
      normalized.add(feature as HexTileFeature);
    }
  }
  return normalized.size ? [...normalized] : civ7StyleHexTileProfile.features;
}

const worldPresets: Array<{ label: string; ranges: Partial<ParameterRanges>; tolerance?: number }> = [
  {
    label: 'Earthlike',
    ranges: {
      oceanPercentage: { min: 58, max: 72, unit: '%' },
      aridity: { min: 0.35, max: 0.6 },
      continentCount: { min: 4, max: 7 },
      continentScale: { min: 0.5, max: 0.68 },
      islandDensity: { min: 0.25, max: 0.5 },
      riverDensity: { min: 1.5, max: 2.4 }
    }
  },
  {
    label: 'Waterworld',
    ranges: {
      oceanPercentage: { min: 78, max: 88, unit: '%' },
      continentCount: { min: 2, max: 5 },
      continentScale: { min: 0.18, max: 0.38 },
      islandDensity: { min: 0.45, max: 0.85 },
      riverDensity: { min: 0.7, max: 1.5 }
    }
  },
  {
    label: 'Archipelago',
    ranges: {
      oceanPercentage: { min: 64, max: 78, unit: '%' },
      continentCount: { min: 5, max: 10 },
      continentScale: { min: 0.16, max: 0.34 },
      islandDensity: { min: 0.7, max: 1 },
      riverDensity: { min: 0.8, max: 1.8 }
    }
  },
  {
    label: 'Desert World',
    ranges: {
      oceanPercentage: { min: 28, max: 45, unit: '%' },
      aridity: { min: 0.68, max: 0.9 },
      averageTemperatureC: { min: 18, max: 30, unit: 'C' },
      continentCount: { min: 2, max: 5 },
      continentScale: { min: 0.48, max: 0.75 },
      islandDensity: { min: 0.1, max: 0.35 },
      riverDensity: { min: 0.3, max: 1.1 }
    },
    tolerance: 8
  },
  {
    label: 'Pangea',
    ranges: {
      oceanPercentage: { min: 48, max: 62, unit: '%' },
      continentCount: { min: 1, max: 2 },
      continentScale: { min: 0.78, max: 1 },
      islandDensity: { min: 0, max: 0.18 },
      riverDensity: { min: 1.8, max: 3.2 }
    }
  }
];

function App() {
  const defaultHighConfig = () => createDefaultConfig(defaultSeed, { width: 2048, height: 1024 });
  const storedWorkspace = useMemo(() => loadWorkspaceSettings(), []);
  const [config, setConfig] = useState<GenerationConfig>(() => storedWorkspace.config ?? defaultHighConfig());
  const [project, setProject] = useState<WorldProject | null>(null);
  const [contentLibrary, setContentLibrary] = useState<ContentLibraryConfig>(() => storedWorkspace.contentLibrary ?? structuredClone(defaultContentLibrary));
  const [savedMaps, setSavedMaps] = useState<SavedMapRecord[]>(() => storedWorkspace.savedMaps ?? []);
  const [identity, setIdentity] = useState<LocalUserIdentity>(() => loadIdentity());
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings>(() => loadCloudSyncSettings());
  const [syncStatus, setSyncStatus] = useState('Local profile ready');
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('biomes');
  const [previewResolution, setPreviewResolution] = useState(previewResolutionOptions[1]);
  const [exportResolution, setExportResolution] = useState(resolutionOptions[1]);
  const [tilePresetId, setTilePresetId] = useState(storedWorkspace.tileExport?.presetId ?? defaultHexPreset.id);
  const [tileWidth, setTileWidth] = useState(storedWorkspace.tileExport?.width ?? defaultHexPreset.width);
  const [tileHeight, setTileHeight] = useState(storedWorkspace.tileExport?.height ?? defaultHexPreset.height);
  const [tileFeatures, setTileFeatures] = useState<HexTileFeature[]>(() => normalizeTileFeatures(storedWorkspace.tileExport?.enabledFeatures as string[] | undefined));
  const [vttGridEnabled, setVttGridEnabled] = useState(true);
  const [vttHexSizeMiles, setVttHexSizeMiles] = useState(1200);
  const [vttHexSizeMilesInput, setVttHexSizeMilesInput] = useState('1200');
  const [vttResolution, setVttResolution] = useState(resolutionOptions[2]);
  const [showPlates, setShowPlates] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>('biomes');
  const [coastlineTreatment, setCoastlineTreatment] = useState<CoastlineTreatment>('toned');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('world');
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('generator');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [exportTasks, setExportTasks] = useState<Record<ExportKey, ExportTaskState>>(() => initialExportTasks());
  const [worldLibraryStatus, setWorldLibraryStatus] = useState('');
  const generationEstimateRef = useRef(24000);
  const generationStartedAtRef = useRef(0);
  const generationTaskIdRef = useRef('');
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const generationPreviewRef = useRef<GenerationPreviewFrame | null>(null);
  const generationPreviewFrameRef = useRef(0);
  const initialSyncDoneRef = useRef(false);
  const suppressAutoPushRef = useRef(false);
  const steamLinkDoneRef = useRef(false);

  const currentWorkspace = () =>
    buildWorkspaceSettings({
      config,
      contentLibrary,
      tileExport: {
        presetId: tilePresetId,
        width: tileWidth,
        height: tileHeight,
        enabledFeatures: tileFeatures
      },
      savedMaps
    });

  useEffect(() => {
    saveIdentity(identity);
  }, [identity]);

  useEffect(() => {
    saveCloudSyncSettings(cloudSync);
  }, [cloudSync]);

  useEffect(() => {
    saveWorkspaceSettings(currentWorkspace());
  }, [config, contentLibrary, savedMaps, tileFeatures, tileHeight, tilePresetId, tileWidth]);

  useEffect(() => {
    if (steamLinkDoneRef.current) return;
    const steamIdentity = detectSteamIdentity();
    if (!steamIdentity) return;
    steamLinkDoneRef.current = true;
    const nextIdentity = identityWithExternalAccount(identity, steamIdentity);
    setIdentity(nextIdentity);
    if (!cloudSync.keepSynced) return;
    let cancelled = false;
    const linkSteam = async () => {
      try {
        setSyncStatus('Signing in with Steam...');
        const signedIn = await syncIdentity(cloudSync, nextIdentity);
        if (cancelled) return;
        setIdentity(signedIn);
        setCloudSync((current) => ({ ...current, lastError: '' }));
        setSyncStatus(isLocalOnlyIdentity(signedIn) ? 'Steam account linked locally.' : 'Steam account linked.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Steam sign-in failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    };
    void linkSteam();
    return () => {
      cancelled = true;
    };
  }, [cloudSync, identity]);

  useEffect(() => {
    let cancelled = false;
    const loadStoredWorlds = async () => {
      const stored = await listStoredWorldRecords().catch(() => []);
      if (!cancelled && stored.length) setSavedMaps((current) => mergeSavedMapRecords(current, stored));
    };
    void loadStoredWorlds();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudSync.keepSynced || !cloudSync.serviceBaseUrl || initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    let cancelled = false;
    const runInitialSync = async () => {
      try {
        setSyncStatus('Signing in...');
        const signedIn = await syncIdentity(cloudSync, identity);
        if (cancelled) return;
        setIdentity(signedIn);
        if (isLocalOnlyIdentity(signedIn)) {
          setCloudSync((current) => ({ ...current, lastError: '' }));
          setSyncStatus('Signed in locally. Cloud service is not configured or unavailable.');
          return;
        }
        setSyncStatus('Checking cloud data...');
        const pulled = await pullSyncEnvelope(cloudSync, signedIn).catch((error) => {
          if (/404/.test(String(error?.message || ''))) return null;
          throw error;
        });
        if (cancelled) return;
        if (pulled?.workspace) {
          suppressAutoPushRef.current = true;
          setConfig(pulled.workspace.config);
          setContentLibrary(pulled.workspace.contentLibrary);
          setTilePresetId(pulled.workspace.tileExport.presetId);
          setTileWidth(pulled.workspace.tileExport.width);
          setTileHeight(pulled.workspace.tileExport.height);
          setTileFeatures(normalizeTileFeatures(pulled.workspace.tileExport.enabledFeatures as string[]));
          setSavedMaps(pulled.workspace.savedMaps ?? []);
          setCloudSync((current) => ({
            ...current,
            lastPulledAt: pulled.updatedAt,
            lastError: ''
          }));
          setSyncStatus(`Synced from cloud ${new Date(pulled.updatedAt).toLocaleString()}`);
          window.setTimeout(() => {
            suppressAutoPushRef.current = false;
          }, 0);
          return;
        }
        setSyncStatus('Signed in. Local data will sync automatically.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud sign-in failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    };
    void runInitialSync();
    return () => {
      cancelled = true;
    };
  }, [cloudSync, identity]);

  useEffect(() => {
    if (!cloudSync.keepSynced || !cloudSync.serviceBaseUrl || !isLoggedIn(identity) || isLocalOnlyIdentity(identity) || suppressAutoPushRef.current) return;
    const timer = window.setTimeout(async () => {
      try {
        setSyncStatus('Syncing changes...');
        const envelope = buildSyncEnvelope({ identity, workspace: currentWorkspace() });
        const synced = await pushSyncEnvelope(cloudSync, identity, envelope);
        setCloudSync((current) => ({
          ...current,
          lastSyncedAt: synced.updatedAt,
          lastError: ''
        }));
        setSyncStatus(`Synced ${new Date(synced.updatedAt).toLocaleString()}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud sync failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [cloudSync.keepSynced, cloudSync.serviceBaseUrl, config, contentLibrary, identity, savedMaps, tileFeatures, tileHeight, tilePresetId, tileWidth]);

  useEffect(() => {
    const worker = new Worker(new URL('./generationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: 'progress' | 'complete' | 'error'; id: string; preview?: GenerationPreviewFrame; project?: WorldProject; message?: string }>) => {
      if (event.data.id !== generationTaskIdRef.current) return;
      if (event.data.type === 'progress' && event.data.preview) {
        generationPreviewRef.current = event.data.preview;
        setGenerationStage(event.data.preview.label);
        setGenerationProgress((current) => Math.max(current, event.data.preview?.progress ?? current));
        scheduleGenerationPreviewPaint();
        return;
      } else if (event.data.type === 'complete' && event.data.project) {
        generationPreviewRef.current = null;
        setProject(event.data.project);
        generationEstimateRef.current = Math.max(3000, event.data.project.diagnostics?.totalMs ?? generationEstimateRef.current);
      } else if (event.data.type === 'error') {
        console.error(event.data.message ?? 'Generation failed');
      }
      setGenerationProgress(1);
      setGenerationStage('');
      setIsGenerating(false);
    };
    worker.onerror = (event) => {
      console.error(event.message);
      setGenerationStage('');
      setIsGenerating(false);
    };
    const scheduleGenerationPreviewPaint = () => {
      if (generationPreviewFrameRef.current) return;
      generationPreviewFrameRef.current = window.requestAnimationFrame(() => {
        generationPreviewFrameRef.current = 0;
        drawGenerationPreview();
      });
    };
    const drawGenerationPreview = () => {
      const preview = generationPreviewRef.current;
      const canvas = canvasRef.current;
      if (!preview || !canvas) return;
      canvas.width = preview.width;
      canvas.height = preview.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixels = new Uint8ClampedArray(preview.rgba.buffer as ArrayBuffer);
      ctx.putImageData(new ImageData(pixels, preview.width, preview.height), 0, 0);
    };
    return () => {
      if (generationPreviewFrameRef.current) window.cancelAnimationFrame(generationPreviewFrameRef.current);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0);
      return;
    }
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - generationStartedAtRef.current;
      const linear = Math.min(0.96, elapsed / Math.max(1000, generationEstimateRef.current));
      setGenerationProgress(1 - (1 - linear) ** 2);
    }, 150);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => {
    if (!canvasRef.current || viewMode !== 'map') return;
    if (isGenerating) return;
    if (!project) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }
    const showRiverOverlay = showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap';
    renderWorldToCanvas(canvasRef.current, project, cleanGameMapTheme, {
      rivers: showRiverOverlay,
      plates: showPlates,
      heightmap: mapMode === 'elevation',
      coastlineTreatment,
      mode: mapMode,
      targetResolution: previewResolution.width > 0 ? previewResolution : undefined
    });
  }, [coastlineTreatment, isGenerating, mapMode, previewResolution, project, showPlates, showRivers, viewMode]);

  const invalidRanges = useMemo(() => {
    return Object.entries(config.parameterRanges)
      .filter(([, range]) => range.min > range.max)
      .map(([key]) => rangeLabels[key as RangeKey]);
  }, [config.parameterRanges]);

  const generate = (nextConfig = config) => {
    if (invalidRanges.length > 0) return;
    const taskId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    generationTaskIdRef.current = taskId;
    generationStartedAtRef.current = performance.now();
    generationEstimateRef.current = Math.max(3000, project?.diagnostics?.totalMs ?? generationEstimateRef.current);
    generationPreviewRef.current = null;
    setGenerationStage('Starting generation...');
    setGenerationProgress(0.02);
    setIsGenerating(true);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'generate', id: taskId, config: nextConfig });
      return;
    }
    window.setTimeout(() => {
      const nextProject = generateProject(nextConfig);
      if (generationTaskIdRef.current !== taskId) return;
      setProject(nextProject);
      generationEstimateRef.current = Math.max(3000, nextProject.diagnostics?.totalMs ?? generationEstimateRef.current);
      setGenerationProgress(1);
      setGenerationStage('');
      setIsGenerating(false);
    }, 20);
  };

  const updateRange = (key: RangeKey, field: keyof NumericRange, value: number) => {
    setConfig((current) => ({
      ...current,
      parameterRanges: {
        ...current.parameterRanges,
        [key]: {
          ...current.parameterRanges[key],
          [field]: value
        }
      }
    }));
  };

  const updateOceanTolerance = (value: number) => {
    setConfig((current) => ({
      ...current,
      selectedValues: {
        ...current.selectedValues,
        oceanTolerancePercentagePoints: Math.max(0, value)
      }
    }));
  };

  const applyPreset = (label: string) => {
    const preset = worldPresets.find((option) => option.label === label);
    if (!preset) return;
    setConfig((current) => ({
      ...current,
      parameterRanges: {
        ...current.parameterRanges,
        ...preset.ranges
      },
      selectedValues: {
        ...current.selectedValues,
        oceanTolerancePercentagePoints: preset.tolerance ?? current.selectedValues?.oceanTolerancePercentagePoints ?? 5
      }
    }));
  };

  const randomizeSeed = () => {
    const seed = String(Math.floor(1000000 + Math.random() * 9000000));
    setConfig({ ...config, seed });
  };

  const setExportTask = (key: ExportKey, partial: Partial<ExportTaskState>) => {
    setExportTasks((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...partial
      }
    }));
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

  const downloadPng = async () => {
    if (!project) return;
    await runExport('png', 'Rendering PNG...', async (progress) => {
      const canvas = document.createElement('canvas');
      const showRiverOverlay = showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap';
      renderWorldToCanvas(canvas, project, cleanGameMapTheme, {
        rivers: showRiverOverlay,
        plates: showPlates,
        heightmap: mapMode === 'elevation',
        coastlineTreatment,
        mode: mapMode,
        targetResolution: exportResolution
      });
      progress(0.65);
      downloadBlob(await canvasToBlob(canvas, 'image/png'), `${project.projectName}.png`);
    });
  };

  const downloadJson = async () => {
    if (!project) return;
    await runExport('json', 'Preparing JSON...', async (progress) => {
      const json = projectToJson(project, false);
      progress(0.85);
      await nextPaint();
      downloadBlob(new Blob([json], { type: 'application/json' }), `${project.projectName}.json`);
    });
  };

  const downloadSvg = async () => {
    if (!project) return;
    await runExport('svg', 'Preparing SVG...', async (progress) => {
      const svg = exportSvg(project);
      progress(0.85);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${project.projectName}.svg`);
    });
  };

  const tileExportConfig = () => ({
    width: tileWidth,
    height: tileHeight,
    profileId: civ7StyleHexTileProfile.id,
    enabledFeatures: tileFeatures
  });

  const downloadHexGridSvg = async () => {
    if (!project) return;
    await runExport('hexSvg', 'Preparing hex SVG...', async (progress) => {
      const svg = exportHexGridSvg(project, tileExportConfig());
      progress(0.85);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${project.projectName}-hex-grid.svg`);
    });
  };

  const downloadHexTileJson = async () => {
    if (!project) return;
    await runExport('tileJson', 'Preparing tile JSON...', async (progress) => {
      const json = exportHexTileMapJson(project, tileExportConfig());
      progress(0.85);
      downloadBlob(new Blob([json], { type: 'application/json' }), `${project.projectName}-hex-tiles.json`);
    });
  };

  const downloadPackage = async () => {
    if (!project) return;
    await runExport('wforge', 'Preparing .wforge...', async (progress) => {
      const blob = await exportWforge(project, {
        compressionLevel: 1,
        onProgress: (percent) => progress(percent)
      });
      downloadBlob(blob, `${project.projectName}.wforge`);
    });
  };

  const downloadVttPackage = async () => {
    if (!project) return;
    await runExport('vtt', 'Preparing VTT ZIP...', async (progress) => {
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      renderWorldToCanvas(canvas, project, cleanGameMapTheme, {
        rivers: showRivers,
        plates: false,
        heightmap: false,
        coastlineTreatment,
        mode: 'biomes',
        targetResolution: vttResolution
      });
      progress(0.22);
      const config = {
        width: vttResolution.width,
        height: vttResolution.height,
        grid: {
          kind: vttGridEnabled ? 'hex-pointy' as const : 'none' as const,
          hexSizeMiles: vttHexSizeMiles
        }
      };
      const baseName = safeFileName(project.projectName);
      const imageBlob = await canvasToBlob(canvas, 'image/png');
      zip.file(`${baseName}-vtt-map.png`, imageBlob);
      zip.file(`${baseName}-vtt-metadata.json`, exportVttMetadata(project, config));
      if (vttGridEnabled) {
        drawVttHexGridOverlay(canvas, project, vttHexSizeMiles);
        zip.file(`${baseName}-vtt-map-grid.png`, await canvasToBlob(canvas, 'image/png'));
        zip.file(`${baseName}-vtt-grid.svg`, exportVttGridSvg(project, config));
      }
      progress(0.62);
      downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }, (metadata) => progress(0.62 + metadata.percent * 0.0035)), `${project.projectName}-vtt.zip`);
    });
  };

  const openPackage = async (file?: File) => {
    if (!file) return;
    const parsed = await importWforge(file);
    setProject(parsed);
    setConfig(parsed.config);
  };

  const saveCurrentWorldInApp = async () => {
    if (!project) return;
    setWorldLibraryStatus('Saving world...');
    try {
      const projectToSave = { ...project, updatedAt: new Date().toISOString() };
      const record = savedMapRecordForProject(projectToSave);
      await saveStoredWorld(projectToSave);
      setProject(projectToSave);
      setSavedMaps((current) => mergeSavedMapRecords([record], current).slice(0, 24));
      setWorldLibraryStatus(`Saved ${project.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save world';
      setWorldLibraryStatus(message);
    }
  };

  const loadStoredWorld = async (record: SavedMapRecord) => {
    setWorldLibraryStatus(`Loading ${record.projectName}...`);
    try {
      const loaded = await loadStoredWorldProject(record.projectId);
      if (!loaded) {
        setWorldLibraryStatus('Saved world data is not available on this machine.');
        return;
      }
      setProject(loaded);
      setConfig(loaded.config);
      setWorldLibraryStatus(`Loaded ${loaded.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load world';
      setWorldLibraryStatus(message);
    }
  };

  const deleteStoredWorld = async (record: SavedMapRecord) => {
    setWorldLibraryStatus(`Removing ${record.projectName}...`);
    try {
      await deleteStoredWorldProject(record.projectId);
      setSavedMaps((current) => current.filter((entry) => entry.projectId !== record.projectId));
      setWorldLibraryStatus(`Removed ${record.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove world';
      setWorldLibraryStatus(message);
    }
  };

  const applyTilePreset = (presetId: string) => {
    const preset = hexTileMapPresets.find((option) => option.id === presetId);
    setTilePresetId(presetId);
    if (!preset) return;
    setTileWidth(preset.width);
    setTileHeight(preset.height);
  };

  const toggleTileFeature = (feature: HexTileFeature, enabled: boolean) => {
    setTileFeatures((current) => {
      if (enabled) return current.includes(feature) ? current : [...current, feature];
      return current.filter((item) => item !== feature);
    });
  };

  const commitVttHexSizeMiles = (value = vttHexSizeMilesInput) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.max(50, Math.round(parsed)) : vttHexSizeMiles;
    setVttHexSizeMiles(next);
    setVttHexSizeMilesInput(String(next));
  };

  const updateDisplayName = (displayName: string) => {
    setIdentity((current) => ({
      ...current,
      displayName,
      updatedAt: new Date().toISOString()
    }));
  };

  const updateExternalAccount = (account: ExternalAccountIdentity) => {
    setIdentity((current) => ({
      ...identityWithExternalAccount(current, account)
    }));
  };

  const updateCloudSync = (partial: Partial<CloudSyncSettings>) => {
    setCloudSync((current) => ({
      ...current,
      ...partial,
      schemaVersion: 1
    }));
  };

  const signInForSync = async () => {
    try {
      setSyncStatus('Signing in...');
      const steamIdentity = detectSteamIdentity();
      const providerIdentity = steamIdentity ?? (googleSignInAvailable() ? await signInWithGoogle() : null);
      const identityToSync = providerIdentity ? identityWithExternalAccount(identity, providerIdentity) : identity;
      if (providerIdentity) updateExternalAccount(providerIdentity);
      const signedIn = await syncIdentity(cloudSync, identityToSync);
      setIdentity(signedIn);
      setCloudSync((current) => ({ ...current, lastError: '' }));
      setSyncStatus(isLocalOnlyIdentity(signedIn) ? 'Signed in locally. Cloud service is not configured or unavailable.' : `Signed in as ${signedIn.profileId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  };

  const pushCloudSync = async () => {
    try {
      setSyncStatus('Pushing settings and assets...');
      const signedIn = isLoggedIn(identity) ? identity : await syncIdentity(cloudSync, identity);
      setIdentity(signedIn);
      if (isLocalOnlyIdentity(signedIn)) {
        setCloudSync((current) => ({ ...current, lastError: '' }));
        setSyncStatus('Signed in locally. Cloud service is not configured or unavailable.');
        return;
      }
      const envelope = buildSyncEnvelope({ identity: signedIn, workspace: currentWorkspace() });
      const synced = await pushSyncEnvelope(cloudSync, signedIn, envelope);
      setCloudSync((current) => ({
        ...current,
        lastSyncedAt: synced.updatedAt,
        lastError: ''
      }));
      setSyncStatus(`Pushed ${new Date(synced.updatedAt).toLocaleString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud push failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  };

  const pullCloudSync = async () => {
    try {
      if (isLocalOnlyIdentity(identity)) {
        setSyncStatus('Cloud pull needs a service-backed login.');
        return;
      }
      setSyncStatus('Pulling settings and assets...');
      const synced = await pullSyncEnvelope(cloudSync, identity);
      if (!synced) {
        setSyncStatus('No cloud profile found for this user.');
        return;
      }
      suppressAutoPushRef.current = true;
      setIdentity(synced.identity);
      setConfig(synced.workspace.config);
      setContentLibrary(synced.workspace.contentLibrary);
      setTilePresetId(synced.workspace.tileExport.presetId);
      setTileWidth(synced.workspace.tileExport.width);
      setTileHeight(synced.workspace.tileExport.height);
      setTileFeatures(normalizeTileFeatures(synced.workspace.tileExport.enabledFeatures as string[]));
      setSavedMaps(synced.workspace.savedMaps ?? []);
      setProject(null);
      setCloudSync((current) => ({
        ...current,
        lastPulledAt: synced.updatedAt,
        lastSyncedAt: synced.updatedAt,
        lastError: ''
      }));
      setSyncStatus(`Pulled ${new Date(synced.updatedAt).toLocaleString()}`);
      window.setTimeout(() => {
        suppressAutoPushRef.current = false;
      }, 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud pull failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  };

  const profileStatus = (() => {
    if (!cloudSync.keepSynced) return { className: 'off', label: 'Sync off', title: 'Sync is turned off.' };
    if (cloudSync.lastError) return { className: 'warn', label: isLoggedIn(identity) ? identity.displayName : 'Not Logged In', title: cloudSync.lastError };
    if (isLoggedIn(identity) && cloudSync.serviceBaseUrl && !isLocalOnlyIdentity(identity)) return { className: 'online', label: identity.displayName, title: `Signed in. ${syncStatus}` };
    if (isLoggedIn(identity)) return { className: 'local', label: identity.displayName, title: 'Signed in locally. Cloud service is not configured or unavailable.' };
    return { className: 'offline', label: 'Not Logged In', title: syncStatus };
  })();
  const vttHexMetrics = project && vttGridEnabled ? calculateVttHexMetrics(project, vttResolution.width, vttResolution.height, vttHexSizeMiles) : null;
  const tileHexScaleMiles = project ? Math.round(planetCircumferenceMiles(project) / Math.max(1, tileWidth)) : null;

  return (
    <main className={`app-shell ${leftPanelCollapsed ? 'left-collapsed' : ''} ${rightPanelCollapsed ? 'right-collapsed' : ''}`} aria-busy={isGenerating}>
      <section className={`toolbar ${leftPanelCollapsed ? 'panel-collapsed' : ''}`} aria-label="World generation controls">
        <div className="brand">
          {!leftPanelCollapsed && (
            <>
              <strong>World Forge</strong>
              <button type="button" title="Configure content sets" className="icon-button" onClick={() => setConfigOpen(true)}>
                <Settings size={16} />
              </button>
            </>
          )}
          <button type="button" title={leftPanelCollapsed ? 'Expand generation panel' : 'Collapse generation panel'} className="icon-button panel-toggle" onClick={() => setLeftPanelCollapsed((collapsed) => !collapsed)}>
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        {leftPanelCollapsed ? (
          <div className="collapsed-panel-label">Generation</div>
        ) : (
        <>
        <div className="panel-tabs left-tabs" role="tablist" aria-label="Left panel sections">
          <button type="button" role="tab" aria-selected={leftPanelTab === 'generator'} className={leftPanelTab === 'generator' ? 'active' : ''} onClick={() => setLeftPanelTab('generator')}>
            Generator
          </button>
          <button type="button" role="tab" aria-selected={leftPanelTab === 'worlds'} className={leftPanelTab === 'worlds' ? 'active' : ''} onClick={() => setLeftPanelTab('worlds')}>
            My Worlds
          </button>
        </div>
        {leftPanelTab === 'generator' ? (
        <>
        <div className="seed-row">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            inputMode="numeric"
            pattern="[0-9]*"
            value={config.seed}
            onChange={(event) => setConfig({ ...config, seed: event.target.value.replace(/\D/g, '') })}
          />
          <button type="button" title="Randomize seed" onClick={randomizeSeed}>
            <Shuffle size={16} />
          </button>
          <button type="button" title="Generate world" disabled={invalidRanges.length > 0 || isGenerating} onClick={() => generate()}>
            <RefreshCw size={16} />
            Generate
          </button>
        </div>
        <button
          type="button"
          className={`profile-pill ${profileStatus.className}`}
          title={profileStatus.title}
          onClick={() => {
            setConfigTab('sync');
            setConfigOpen(true);
          }}
        >
          <User size={15} />
          <span>{profileStatus.label}</span>
        </button>
        <div className="resolution-row">
          <label htmlFor="generation-resolution">Generation</label>
          <select
            id="generation-resolution"
            value={`${config.outputResolution.width}x${config.outputResolution.height}`}
            onChange={(event) => {
              const nextResolution = resolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value);
              if (!nextResolution) return;
              setConfig({
                ...config,
                outputResolution: { width: nextResolution.width, height: nextResolution.height }
              });
            }}
          >
            {resolutionOptions.map((option) => (
              <option key={option.label} value={`${option.width}x${option.height}`}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="resolution-row">
          <label htmlFor="world-preset">Preset</label>
          <select id="world-preset" defaultValue="" onChange={(event) => applyPreset(event.target.value)}>
            <option value="" disabled>Choose preset</option>
            {worldPresets.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div className="resolution-row">
          <label htmlFor="preview-resolution">Preview</label>
          <select
            id="preview-resolution"
            value={`${previewResolution.width}x${previewResolution.height}`}
            onChange={(event) => {
              const nextResolution = previewResolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value);
              if (nextResolution) setPreviewResolution(nextResolution);
            }}
          >
            {previewResolutionOptions.map((option) => (
              <option key={option.label} value={`${option.width}x${option.height}`}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="resolution-row">
          <label htmlFor="export-resolution">PNG export</label>
          <select
            id="export-resolution"
            value={`${exportResolution.width}x${exportResolution.height}`}
            onChange={(event) => {
              const nextResolution = resolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value);
              if (nextResolution) setExportResolution(nextResolution);
            }}
          >
            {resolutionOptions.map((option) => (
              <option key={option.label} value={`${option.width}x${option.height}`}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="resolution-row">
          <label htmlFor="ocean-tolerance">Tolerance</label>
          <input
            id="ocean-tolerance"
            min="0"
            step="0.5"
            type="number"
            value={config.selectedValues?.oceanTolerancePercentagePoints ?? 5}
            onChange={(event) => updateOceanTolerance(Number(event.target.value))}
          />
        </div>
        {invalidRanges.length > 0 && <div className="validation">Invalid ranges: {invalidRanges.join(', ')}</div>}
        <div className="range-grid">
          {(Object.keys(config.parameterRanges) as RangeKey[]).map((key) => (
            <RangeControl
              key={key}
              label={rangeLabels[key]}
              range={config.parameterRanges[key]}
              bounds={parameterControlBounds[key]}
              onMin={(value) => updateRange(key, 'min', value)}
              onMax={(value) => updateRange(key, 'max', value)}
            />
          ))}
        </div>
        </>
        ) : (
          <div className="my-worlds-panel" role="tabpanel" aria-label="My Worlds">
            <div className="world-library-actions">
              <button type="button" disabled={!project} onClick={saveCurrentWorldInApp}>
                <Save size={16} />
                Save Current
              </button>
              <span>{savedMaps.length} saved</span>
            </div>
            {worldLibraryStatus && <div className="world-library-status">{worldLibraryStatus}</div>}
            {savedMaps.length === 0 ? (
              <div className="empty-library">
                <strong>No saved worlds</strong>
                <span>Generate a world, then save it here for in-app loading.</span>
              </div>
            ) : (
              <div className="world-list">
                {savedMaps.map((record) => (
                  <article key={record.projectId} className={`world-list-item ${project?.projectId === record.projectId ? 'active' : ''}`}>
                    <div>
                      <strong>{record.projectName}</strong>
                      <span>Seed {record.seed} · {new Date(record.updatedAt).toLocaleString()}</span>
                    </div>
                    <div className="world-list-actions">
                      <button type="button" onClick={() => loadStoredWorld(record)}>Load</button>
                      <button type="button" className="subtle-button" onClick={() => deleteStoredWorld(record)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        </>
        )}
      </section>

      <section className="map-pane" aria-label="Generated world map">
        <div className="map-actions">
          <div className="layer-toggles">
            <label><input type="radio" name="view-mode" checked={viewMode === 'map'} onChange={() => setViewMode('map')} /> Map</label>
            <label><input type="radio" name="view-mode" checked={viewMode === 'globe'} onChange={() => setViewMode('globe')} /> Globe</label>
            <label><input type="checkbox" checked={showRivers} onChange={(event) => setShowRivers(event.target.checked)} /> Rivers</label>
            <label><input type="checkbox" checked={showPlates} onChange={(event) => setShowPlates(event.target.checked)} /> Plates</label>
            <select id="map-mode" aria-label="Map filter" value={mapMode} onChange={(event) => setMapMode(event.target.value as MapMode)}>
              <option value="biomes">Biomes</option>
              <option value="elevation">Elevation</option>
              <option value="heightmap">Heightmap</option>
              <option value="temperature">Temperature</option>
              <option value="rainfall">Rainfall</option>
              <option value="wind">Wind</option>
              <option value="current">Current</option>
            </select>
            <select aria-label="Coastline treatment" value={coastlineTreatment} onChange={(event) => setCoastlineTreatment(event.target.value as CoastlineTreatment)} disabled={mapMode !== 'biomes'}>
              <option value="bare">Bare coast</option>
              <option value="toned">Toned coast</option>
              <option value="outlined">Outlined coast</option>
            </select>
          </div>
          <div className="download-actions">
            <ExportButton icon={<Image size={16} />} label="PNG" task={exportTasks.png} disabled={!project} title="Export PNG" onClick={downloadPng} />
            <ExportButton icon={<Layers size={16} />} label="SVG" task={exportTasks.svg} disabled={!project} title="Export simplified SVG" onClick={downloadSvg} />
            <ExportButton icon={<FileJson size={16} />} label="JSON" task={exportTasks.json} disabled={!project} title="Export JSON" onClick={downloadJson} />
            <ExportButton icon={<Save size={16} />} label=".wforge" task={exportTasks.wforge} disabled={!project} title="Save .wforge package" onClick={downloadPackage} />
            <label className="file-button" title="Open .wforge package">
              <FolderOpen size={16} />Open
              <input type="file" accept=".wforge" onChange={(event) => openPackage(event.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="canvas-wrap">
          {isGenerating && (
            <div className="generation-progress" role="status" aria-live="polite">
              <span>{generationStage || 'Generating world'}</span>
              <progress value={generationProgress} max={1} />
              <output>{Math.round(generationProgress * 100)}%</output>
            </div>
          )}
          {!project && !isGenerating ? (
            <div className="empty-map">
              <strong>No world generated</strong>
              <span>Adjust settings, then generate or open a .wforge package.</span>
            </div>
          ) : viewMode === 'map' || isGenerating ? (
            <canvas ref={canvasRef} aria-label={project ? `Generated map for ${project.projectName}` : 'Generating map preview'} />
          ) : project ? (
            <GlobeViewer project={project} mapMode={mapMode} showRivers={showRivers} showPlates={showPlates} />
          ) : (
            <div className="empty-map">
              <strong>No world generated</strong>
              <span>Adjust settings, then generate or open a .wforge package.</span>
            </div>
          )}
        </div>
        {project && mapMode === 'biomes' && viewMode === 'map' && <BiomeLegend />}
      </section>

      <aside className={`summary ${rightPanelCollapsed ? 'panel-collapsed' : ''}`} aria-label="World details and exports">
        <button type="button" title={rightPanelCollapsed ? 'Expand details panel' : 'Collapse details panel'} className="icon-button panel-toggle" onClick={() => setRightPanelCollapsed((collapsed) => !collapsed)}>
          {rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>
        {rightPanelCollapsed ? (
          <div className="collapsed-panel-label">Details</div>
        ) : (
        <>
        <div className="summary-tabs" role="tablist" aria-label="Right panel">
          <button type="button" role="tab" aria-selected={rightPanelTab === 'world'} className={rightPanelTab === 'world' ? 'active' : ''} onClick={() => setRightPanelTab('world')}>
            World
          </button>
          <button type="button" role="tab" aria-selected={rightPanelTab === 'hex'} className={rightPanelTab === 'hex' ? 'active' : ''} onClick={() => setRightPanelTab('hex')}>
            Hex Tile Export
          </button>
        </div>
        {rightPanelTab === 'world' ? (
          <div role="tabpanel" aria-label="World">
            {!project ? (
              <div className="empty-panel">
                <h2>World</h2>
                <p>No generated world is loaded.</p>
              </div>
            ) : (
            <>
            <h2>{project.projectName}</h2>
            <Metric label="Ocean" value={`${project.metrics.oceanPercentage}%`} status={project.metrics.validation.oceanWithinTolerance ? 'ok' : 'warn'} />
            <Metric label="Ocean target" value={`${project.selectedValues.oceanPercentage}% +/- ${project.selectedValues.oceanTolerancePercentagePoints}`} />
            <Metric label="Land" value={`${project.metrics.landPercentage}%`} />
            <Metric label="Ice" value={`${project.metrics.icePercentage}%`} />
            <Metric label="Rivers" value={String(project.metrics.riverCount)} status={project.metrics.validation.riverPathsValid ? 'ok' : 'warn'} />
            <Metric label="Lake cells" value={String(project.metrics.lakeCellCount)} />
            <Metric label="Map scale" value={`${project.primaryWorld.mapModel.resolution.width} x ${project.primaryWorld.mapModel.resolution.height}`} />
            <Metric label="PNG export" value={`${exportResolution.width} x ${exportResolution.height}`} />
            {project.diagnostics && <Metric label="Generated in" value={`${Math.round(project.diagnostics.totalMs)} ms`} />}
            <Metric label="Planet size" value={`${project.primaryWorld.sizeClass} Earth radii`} />
            <Metric label="Tide influence" value={String(project.primaryWorld.tideInfluence)} />
            <Metric label="Axial tilt" value={`${project.primaryWorld.axialTiltDeg} deg`} />
            <Metric label="Eccentricity" value={String(project.primaryWorld.orbitalEccentricity)} />
            <div className="system">
              <h3>System</h3>
              <p>{project.solarSystem.star.type}, {project.solarSystem.ageGy} Gy</p>
              <p>{project.solarSystem.bodies.length} major bodies, {project.primaryWorld.tideInfluence > 0 ? 'moon-influenced tides' : 'no major moon tide'}</p>
            </div>
            <div className="system">
              <h3>Moons</h3>
              {project.solarSystem.bodies.find((body) => body.isPrimaryWorld)?.moons.length ? (
                project.solarSystem.bodies.find((body) => body.isPrimaryWorld)?.moons.map((moon) => (
                  <p key={moon.id}>{moon.name}: size {moon.sizeClass}, orbit {moon.orbitalDistanceClass}, tide {moon.tideInfluence}</p>
                ))
              ) : (
                <p>No major moons</p>
              )}
            </div>
            <div className="biomes">
              <h3>Biomes</h3>
              {Object.entries(project.metrics.biomeCounts).map(([biome, count]) => (
                <span key={biome}>{biome.replace('_', ' ')}: {count}</span>
              ))}
            </div>
            {project.diagnostics && (
              <div className="biomes">
                <h3>Slow Phases</h3>
                {project.diagnostics.phases
                  .filter((phase) => !phase.name.includes('primary-world'))
                  .sort((a, b) => b.ms - a.ms)
                  .slice(0, 5)
                  .map((phase) => (
                    <span key={phase.name}>{phase.name}: {Math.round(phase.ms)} ms</span>
                  ))}
              </div>
            )}
            </>
            )}
          </div>
        ) : (
          <div className="tile-export-panel" role="tabpanel" aria-label="Hex tile export">
            <div className="tile-export-title">
              <Hexagon size={16} />
              <strong>Hex tile export</strong>
            </div>
            <label htmlFor="tile-size-preset">
              Tile size
              <select id="tile-size-preset" value={tilePresetId} onChange={(event) => applyTilePreset(event.target.value)}>
                {hexTileMapPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            <div className="tile-dimensions">
              <label htmlFor="tile-width">
                Width
                <input
                  id="tile-width"
                  min="8"
                  max="240"
                  type="number"
                  value={tileWidth}
                  onChange={(event) => {
                    setTilePresetId('custom');
                    setTileWidth(Math.max(1, Number(event.target.value)));
                  }}
                />
              </label>
              <label htmlFor="tile-height">
                Height
                <input
                  id="tile-height"
                  min="6"
                  max="160"
                  type="number"
                  value={tileHeight}
                  onChange={(event) => {
                    setTilePresetId('custom');
                    setTileHeight(Math.max(1, Number(event.target.value)));
                  }}
                />
              </label>
            </div>
            <div className="tile-feature-row" aria-label="Tile feature classes">
              {civ7StyleHexTileProfile.features.map((feature) => (
                <label key={feature}>
                  <input type="checkbox" checked={tileFeatures.includes(feature)} onChange={(event) => toggleTileFeature(feature, event.target.checked)} />
                  {tileFeatureLabels[feature]}
                </label>
              ))}
            </div>
            <div className="tile-export-actions">
              <ExportButton icon={<Layers size={16} />} label="Hex SVG" task={exportTasks.hexSvg} disabled={!project} title="Export hex grid SVG" onClick={downloadHexGridSvg} />
              <ExportButton icon={<FileJson size={16} />} label="Tile JSON" task={exportTasks.tileJson} disabled={!project} title="Export terrain tile JSON" onClick={downloadHexTileJson} />
            </div>
            <div className="vtt-export-block">
              <div className="tile-export-title">
                <Image size={16} />
                <strong>VTT package</strong>
              </div>
              <label htmlFor="vtt-resolution">
                Image size
                <select id="vtt-resolution" value={vttResolution.label} onChange={(event) => setVttResolution(resolutionOptions.find((option) => option.label === event.target.value) ?? resolutionOptions[2])}>
                  {resolutionOptions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label.replace('Fast ', '').replace('Default ', '').replace('Large ', '').replace('High ', '').replace('Ultra ', '')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sync-toggle">
                <input type="checkbox" checked={vttGridEnabled} onChange={(event) => setVttGridEnabled(event.target.checked)} />
                Include hex grid overlay
              </label>
              <label htmlFor="vtt-hex-size">
                Hex size miles
                <input
                  id="vtt-hex-size"
                  min="50"
                  max="5000"
                  step="50"
                  type="number"
                  value={vttHexSizeMilesInput}
                  disabled={!vttGridEnabled}
                  onBlur={() => commitVttHexSizeMiles()}
                  onChange={(event) => setVttHexSizeMilesInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitVttHexSizeMiles();
                  }}
                />
              </label>
              <div className="export-readout">
                <span>Grid hexes</span>
                <strong>{vttHexMetrics ? `${vttHexMetrics.columns} x ${vttHexMetrics.rows}` : 'No grid'}</strong>
              </div>
              <div className="tile-export-actions">
                <ExportButton icon={<Download size={16} />} label="VTT ZIP" task={exportTasks.vtt} disabled={!project} title="Export VTT-ready ZIP" onClick={downloadVttPackage} />
              </div>
            </div>
            <div className="system">
              <h3>Profile</h3>
              <p>{civ7StyleHexTileProfile.label}</p>
              <div className="export-readout">
                <span>Hex scale</span>
                <strong>{tileHexScaleMiles ? `${tileHexScaleMiles.toLocaleString()} miles` : 'Generate world'}</strong>
              </div>
              <p>{project ? `${tileWidth} x ${tileHeight} pointy-top odd-row hexes sampled from generated topology facts. VTT export is a neutral map package with optional hex overlay and metadata.` : 'Generate or open a world before exporting tiles or VTT packages.'}</p>
            </div>
          </div>
        )}
        </>
        )}
      </aside>
      {configOpen && (
        <ContentConfigModal
          library={contentLibrary}
          activeTab={configTab}
          onTab={setConfigTab}
          onClose={() => setConfigOpen(false)}
          onChange={setContentLibrary}
          identity={identity}
          cloudSync={cloudSync}
          syncStatus={syncStatus}
          savedMapCount={savedMaps.length}
          onDisplayName={updateDisplayName}
          onCloudSync={updateCloudSync}
          onSignIn={signInForSync}
          onPush={pushCloudSync}
          onPull={pullCloudSync}
        />
      )}
      {isGenerating && <div className="generating-overlay">Generating world</div>}
    </main>
  );
}

function ContentConfigModal({
  library,
  activeTab,
  onTab,
  onClose,
  onChange,
  identity,
  cloudSync,
  syncStatus,
  savedMapCount,
  onDisplayName,
  onCloudSync,
  onSignIn,
  onPush,
  onPull
}: {
  library: ContentLibraryConfig;
  activeTab: ConfigTab;
  onTab: (tab: ConfigTab) => void;
  onClose: () => void;
  onChange: (library: ContentLibraryConfig) => void;
  identity: LocalUserIdentity;
  cloudSync: CloudSyncSettings;
  syncStatus: string;
  savedMapCount: number;
  onDisplayName: (displayName: string) => void;
  onCloudSync: (settings: Partial<CloudSyncSettings>) => void;
  onSignIn: () => void;
  onPush: () => void;
  onPull: () => void;
}) {
  const contentTab: ContentCategory = activeTab === 'sync' ? 'biomes' : activeTab;
  const category = library[contentTab];
  const [selectedSetId, setSelectedSetId] = useState(category.defaultSetId);
  const selectedSet = category.sets.find((set) => set.id === selectedSetId) ?? category.sets[0];
  const visibleMembers = category.members.filter((member) => selectedSet?.memberIds.includes(member.id));
  const [selectedMemberId, setSelectedMemberId] = useState(visibleMembers[0]?.id ?? category.members[0]?.id ?? '');
  const selectedMember = category.members.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? category.members[0];

  useEffect(() => {
    setSelectedSetId(library[contentTab].defaultSetId);
  }, [contentTab, library]);

  useEffect(() => {
    const nextCategory = library[contentTab];
    const nextSet = nextCategory.sets.find((set) => set.id === selectedSetId) ?? nextCategory.sets[0];
    const nextMember = nextCategory.members.find((member) => nextSet?.memberIds.includes(member.id));
    if (nextMember) setSelectedMemberId(nextMember.id);
  }, [contentTab, library, selectedSetId]);

  const updateCategory = (updater: (category: ContentCategoryConfig) => ContentCategoryConfig) => {
    onChange({ ...library, [contentTab]: updater(library[contentTab]) });
  };

  const markDefaultSet = (setId: string) => {
    updateCategory((current) => ({
      ...current,
      defaultSetId: setId,
      sets: current.sets.map((set) => ({ ...set, isDefault: set.id === setId }))
    }));
  };

  const addSet = () => {
    const baseId = `${contentTab}-set-${category.sets.length + 1}`;
    const setId = uniqueId(baseId, category.sets.map((set) => set.id));
    updateCategory((current) => ({
      ...current,
      sets: [
        ...current.sets,
        {
          id: setId,
          label: `New ${current.label} Set`,
          description: 'User-defined set.',
          memberIds: [],
          isDefault: false
        }
      ]
    }));
    setSelectedSetId(setId);
  };

  const copyMemberToSet = (memberId: string, setId: string) => {
    updateCategory((current) => ({
      ...current,
      sets: current.sets.map((set) => (set.id === setId && !set.memberIds.includes(memberId) ? { ...set, memberIds: [...set.memberIds, memberId] } : set)),
      members: current.members.map((member) => (member.id === memberId && !member.setIds.includes(setId) ? { ...member, setIds: [...member.setIds, setId] } : member))
    }));
  };

  const updateMemberAsset = (memberId: string, assetId: string, value: string) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              assets: member.assets.map((asset) => (asset.id === assetId ? { ...asset, value } : asset))
            }
          : member
      )
    }));
  };

  const attachUploadedAsset = (memberId: string, file: File, kind: 'texture' | 'icon') => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      updateCategory((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.id === memberId
            ? {
                ...member,
                assets: [
                  ...member.assets,
                  {
                    id: `${member.id}-${kind}-${Date.now()}`,
                    label: file.name,
                    kind,
                    value
                  }
                ]
              }
            : member
        )
      }));
    };
    reader.readAsDataURL(file);
  };

  if (activeTab === 'sync') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="config-modal sync-config-modal" role="dialog" aria-modal="true" aria-label="Sync configuration">
          <header className="config-modal-header">
            <div>
              <h2>Content Configuration</h2>
              <p>Keep user settings, content assets, and saved maps available across machines.</p>
            </div>
            <button type="button" title="Close configuration" className="icon-button" onClick={onClose}><X size={18} /></button>
          </header>
          <ConfigTabs activeTab={activeTab} library={library} onTab={onTab} />
          <div className="sync-config-body">
            <section className="member-detail">
              <h3>Sync</h3>
              <label className="sync-toggle large">
                <input
                  type="checkbox"
                  checked={cloudSync.keepSynced}
                  onChange={(event) => onCloudSync({ keepSynced: event.target.checked })}
                />
                Keep data synced
              </label>
              <p>When this is on and you are signed in, World Forge automatically syncs configured content, uploaded assets, generation settings, hex export settings, and saved maps.</p>
              <div className="sync-actions">
                <button type="button" onClick={onSignIn} disabled={!cloudSync.keepSynced}>
                  <User size={15} />
                  {isLoggedIn(identity) ? 'Refresh Sign-In' : 'Sign In'}
                </button>
                <button type="button" onClick={onPush} disabled={!cloudSync.serviceBaseUrl || !cloudSync.keepSynced || isLocalOnlyIdentity(identity)}>
                  <Upload size={15} />
                  Sync Now
                </button>
                <button type="button" onClick={onPull} disabled={!cloudSync.serviceBaseUrl || !cloudSync.keepSynced || !isLoggedIn(identity) || isLocalOnlyIdentity(identity)}>
                  <Download size={15} />
                  Pull Latest
                </button>
              </div>
              <div className="sync-status">
                <Cloud size={14} />
                <span>{syncStatus}</span>
              </div>
              <div className="identity-summary-grid">
                <div className="identity-summary-row"><span>Profile</span><span>{isLoggedIn(identity) ? identity.profileId : 'Not signed in'}</span></div>
                <div className="identity-summary-row"><span>Saved maps</span><span>{savedMapCount}</span></div>
                <div className="identity-summary-row"><span>Last push</span><span>{cloudSync.lastSyncedAt ? new Date(cloudSync.lastSyncedAt).toLocaleString() : 'Never'}</span></div>
                <div className="identity-summary-row"><span>Last pull</span><span>{cloudSync.lastPulledAt ? new Date(cloudSync.lastPulledAt).toLocaleString() : 'Never'}</span></div>
              </div>
              {cloudSync.lastError && <div className="sync-error">{cloudSync.lastError}</div>}
            </section>
            <section className="member-detail">
              <h3>Account</h3>
              <label>
                Display name
                <input value={identity.displayName} onChange={(event) => onDisplayName(event.target.value)} />
              </label>
              <div className="identity-summary-grid">
                <div className="identity-summary-row"><span>Google</span><span>{identity.externalIds.googleId ? 'Linked' : 'Not linked'}</span></div>
                <div className="identity-summary-row"><span>Steam</span><span>{identity.externalIds.steamId ? 'Linked' : 'Not linked'}</span></div>
              </div>
              <button type="button" onClick={onSignIn} disabled={!cloudSync.keepSynced}>
                <User size={15} />
                {googleSignInAvailable() ? 'Sign In with Google' : 'Sign In'}
              </button>
              <label>
                Service URL
                <input
                  value={cloudSync.serviceBaseUrl}
                  placeholder="Configured by hosted build"
                  onChange={(event) => onCloudSync({ serviceBaseUrl: event.target.value })}
                />
              </label>
              <p>The hosted build should preconfigure Google and service credentials. Steam builds can inject the Steam account at launch, and the app links it without a manual ID field.</p>
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="config-modal" role="dialog" aria-modal="true" aria-label="Content configuration">
        <header className="config-modal-header">
          <div>
            <h2>Content Configuration</h2>
            <p>Configure data sets now; generation cutover will use these defaults in a later pass.</p>
          </div>
          <button type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <ConfigTabs activeTab={activeTab} library={library} onTab={onTab} />
        <div className="config-body">
          <aside className="config-sets" aria-label={`${category.label} sets`}>
            <div className="config-section-title">
              <strong>Sets</strong>
              <button type="button" onClick={addSet}>Add</button>
            </div>
            {category.sets.map((set) => (
              <button key={set.id} type="button" className={set.id === selectedSetId ? 'set-button active' : 'set-button'} onClick={() => setSelectedSetId(set.id)}>
                <span>{set.label}</span>
                {set.isDefault && <em>Default</em>}
              </button>
            ))}
            {selectedSet && (
              <button type="button" onClick={() => markDefaultSet(selectedSet.id)} disabled={selectedSet.isDefault}>
                Mark Default
              </button>
            )}
          </aside>
          <section className="config-members" aria-label={`${category.label} members`}>
            <div className="config-section-title">
              <strong>{selectedSet?.label ?? category.label}</strong>
              <span>{visibleMembers.length} members</span>
            </div>
            <div className="member-grid">
              {visibleMembers.map((member) => (
                <button key={member.id} type="button" className={member.id === selectedMember?.id ? 'member-button active' : 'member-button'} onClick={() => setSelectedMemberId(member.id)}>
                  <span className="member-swatch" style={{ background: previewColor(member) }} />
                  {member.label}
                </button>
              ))}
            </div>
            <div className="copy-row">
              <label htmlFor="copy-member-target">Copy selected to</label>
              <select id="copy-member-target" onChange={(event) => selectedMember && copyMemberToSet(selectedMember.id, event.target.value)} defaultValue="">
                <option value="" disabled>Select set</option>
                {category.sets.filter((set) => selectedMember && !set.memberIds.includes(selectedMember.id)).map((set) => (
                  <option key={set.id} value={set.id}>{set.label}</option>
                ))}
              </select>
            </div>
          </section>
          <section className="member-detail" aria-label="Selected member detail">
            {selectedMember ? (
              <>
                <h3>{selectedMember.label}</h3>
                <p>{selectedMember.description}</p>
                <Metric label="Source" value={selectedMember.source} />
                <Metric label="Sets" value={selectedMember.setIds.length.toString()} />
                <div className="rule-list">
                  <h4>Rules</h4>
                  {selectedMember.rules.length ? selectedMember.rules.map((rule, index) => <code key={`${rule.field}-${index}`}>{formatRule(rule)}</code>) : <span>No mapping rules yet</span>}
                </div>
                <div className="asset-list">
                  <h4>Assets</h4>
                  {selectedMember.assets.map((asset) => (
                    <label key={asset.id}>
                      {asset.label}
                      <input value={asset.value} onChange={(event) => updateMemberAsset(selectedMember.id, asset.id, event.target.value)} />
                    </label>
                  ))}
                  <label className="asset-upload">
                    Attach texture
                    <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && attachUploadedAsset(selectedMember.id, event.target.files[0], 'texture')} />
                  </label>
                  <label className="asset-upload">
                    Attach icon
                    <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && attachUploadedAsset(selectedMember.id, event.target.files[0], 'icon')} />
                  </label>
                </div>
              </>
            ) : (
              <p>No member selected.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function ConfigTabs({
  activeTab,
  library,
  onTab
}: {
  activeTab: ConfigTab;
  library: ContentLibraryConfig;
  onTab: (tab: ConfigTab) => void;
}) {
  const tabs: ConfigTab[] = [...(Object.keys(library) as ContentCategory[]), 'sync'];
  return (
    <div className="config-tabs" role="tablist" aria-label="Content categories">
      {tabs.map((tab) => (
        <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => onTab(tab)}>
          {tab === 'sync' ? 'Sync' : library[tab].label}
        </button>
      ))}
    </div>
  );
}

function uniqueId(baseId: string, existing: string[]): string {
  if (!existing.includes(baseId)) return baseId;
  let index = 2;
  while (existing.includes(`${baseId}-${index}`)) index += 1;
  return `${baseId}-${index}`;
}

function previewColor(member: ContentMember): string {
  return member.assets.find((asset) => asset.kind === 'preview-color')?.value || '#9f998d';
}

function formatRule(rule: ContentRule): string {
  const parts = [rule.field];
  if (rule.equals !== undefined) parts.push(`= ${String(rule.equals)}`);
  if (rule.min !== undefined) parts.push(`>= ${rule.min}`);
  if (rule.max !== undefined) parts.push(`<= ${rule.max}`);
  if (rule.includes?.length) parts.push(`in ${rule.includes.join(', ')}`);
  if (rule.note) parts.push(rule.note);
  return parts.join(' ');
}

function GlobeViewer({ project, mapMode, showRivers, showPlates }: { project: WorldProject; mapMode: MapMode; showRivers: boolean; showPlates: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(0, 0.12, 3.15);

    const texture = new THREE.CanvasTexture(createGlobeTexture(project, mapMode, showRivers, showPlates));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const geometry = createGlobeGeometry(project);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.86,
      metalness: 0.02
    });
    const globe = new THREE.Mesh(geometry, material);
    globe.rotation.y = -0.55;
    scene.add(globe);

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(1.0025, 160, 80),
      new THREE.MeshPhysicalMaterial({
        color: 0x2f7fa6,
        transparent: true,
        opacity: 0.82,
        roughness: 0.18,
        metalness: 0,
        transmission: 0,
        depthWrite: true
      })
    );
    scene.add(ocean);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 96, 48),
      new THREE.MeshBasicMaterial({ color: 0x7fc7df, transparent: true, opacity: 0.08, depthWrite: false })
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0xc7d7df, 1.65));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
    sun.position.set(-2.8, 2.4, 3.2);
    scene.add(sun);

    const drag = { active: false, x: 0, y: 0, vx: 0, vy: 0 };
    const onPointerDown = (event: PointerEvent) => {
      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.vx = dx * 0.006;
      drag.vy = dy * 0.004;
      globe.rotation.y += drag.vx;
      globe.rotation.x = clampGlobeTilt(globe.rotation.x + drag.vy);
    };
    const onPointerUp = (event: PointerEvent) => {
      drag.active = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (!drag.active) {
        globe.rotation.y += 0.0017 + drag.vx * 0.02;
        globe.rotation.x = clampGlobeTilt(globe.rotation.x + drag.vy * 0.018);
        drag.vx *= 0.94;
        drag.vy *= 0.9;
      }
      ocean.rotation.copy(globe.rotation);
      atmosphere.rotation.copy(globe.rotation);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      ocean.geometry.dispose();
      (ocean.material as THREE.Material).dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [mapMode, project, showPlates, showRivers]);

  return <div ref={hostRef} className="globe-viewer" aria-label={`Generated globe for ${project.projectName}`} />;
}

function createGlobeTexture(project: WorldProject, mapMode: MapMode, showRivers: boolean, showPlates: boolean): HTMLCanvasElement {
  if (mapMode === 'biomes') return createGlobeAlbedoTexture(project, showRivers, showPlates);
  const canvas = document.createElement('canvas');
  renderWorldToCanvas(canvas, project, cleanGameMapTheme, {
    rivers: showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap',
    plates: showPlates,
    heightmap: mapMode === 'elevation',
    mode: mapMode,
    targetResolution: { width: 2048, height: 1024 }
  });
  return canvas;
}

function createGlobeAlbedoTexture(project: WorldProject, showRivers: boolean, showPlates: boolean): HTMLCanvasElement {
  const world = project.primaryWorld;
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(width, height);
  const [lowElevation, highElevation] = rasterPercentileRange(world.layers.elevation, 0.02, 0.98);
  const sourceWidth = world.mapModel.resolution.width;
  const sourceHeight = world.mapModel.resolution.height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x / width) * sourceWidth));
      const sourceY = Math.min(sourceHeight - 1, Math.floor((y / height) * sourceHeight));
      const index = sourceY * sourceWidth + sourceX;
      const color = globeAlbedoColor(project, index, sourceX, sourceY, lowElevation, highElevation);
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  if (showRivers) drawGlobeTextureRivers(ctx, world, width, height);
  if (showPlates) drawGlobeTexturePlateEdges(ctx, world, width, height);
  return canvas;
}

function globeAlbedoColor(project: WorldProject, index: number, x: number, y: number, lowElevation: number, highElevation: number): [number, number, number] {
  const world = project.primaryWorld;
  const elevation = world.layers.elevation[index];
  const elevation01 = clamp01((elevation - lowElevation) / Math.max(0.0001, highElevation - lowElevation));
  const water = world.layers.water[index] === 1;
  const wetness = world.layers.wetness[index];
  const grain = deterministicGrain(x, y, project.seed);
  if (water) {
    const depth = clamp01((world.seaLevel - elevation) / 0.42);
    const shore = clamp01(1 - depth * 3.2);
    const base = mixRgb([36, 102, 142], [16, 54, 90], depth);
    return mixRgb(base, [72, 146, 174], shore * 0.34);
  }

  const biome = codeToBiome(world.layers.biomes[index]);
  let color: [number, number, number];
  if (biome === 'desert') color = [203, 181, 105];
  else if (biome === 'grassland') color = [114, 153, 86];
  else if (biome === 'forest') color = [59, 122, 72];
  else if (biome === 'rainforest') color = [35, 100, 69];
  else if (biome === 'tundra') color = [162, 179, 154];
  else if (biome === 'wetland') color = [82, 132, 107];
  else if (biome === 'mountain') color = [129, 124, 112];
  else color = [126, 154, 91];

  const slope = globeSlopeSignal(world, index);
  const rock = smoothStep01(0.08, 0.34, slope) * smoothStep01(0.36, 0.82, elevation01);
  color = mixRgb(color, [112, 107, 96], rock * 0.65);
  if (world.layers.ice[index]) color = mixRgb(color, [239, 245, 241], elevation01 > 0.6 ? 0.86 : 0.62);
  const shade = 0.92 + elevation01 * 0.1 + (grain - 0.5) * (biome === 'desert' ? 0.08 : 0.055) + wetness * 0.025;
  return scaleRgb(color, shade);
}

function drawGlobeTextureRivers(ctx: CanvasRenderingContext2D, world: WorldProject['primaryWorld'], textureWidth: number, textureHeight: number): void {
  const scaleX = textureWidth / world.mapModel.resolution.width;
  const scaleY = textureHeight / world.mapModel.resolution.height;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(176, 223, 226, 0.48)';
  ctx.lineWidth = Math.max(0.75, textureWidth / 2200);
  for (const river of world.rivers) {
    if (river.path.length < 4) continue;
    ctx.beginPath();
    let started = false;
    let previousX = 0;
    for (const cell of river.path) {
      if (world.layers.water[cell] === 1) {
        started = false;
        continue;
      }
      const x = (cell % world.mapModel.resolution.width) * scaleX;
      const y = Math.floor(cell / world.mapModel.resolution.width) * scaleY;
      if (!started || Math.abs(x - previousX) > textureWidth / 2) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      previousX = x;
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlobeTexturePlateEdges(ctx: CanvasRenderingContext2D, world: WorldProject['primaryWorld'], textureWidth: number, textureHeight: number): void {
  const sourceWidth = world.mapModel.resolution.width;
  const sourceHeight = world.mapModel.resolution.height;
  const image = ctx.getImageData(0, 0, textureWidth, textureHeight);
  for (let y = 1; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      const sx = Math.min(sourceWidth - 1, Math.floor((x / textureWidth) * sourceWidth));
      const sy = Math.min(sourceHeight - 1, Math.floor((y / textureHeight) * sourceHeight));
      const index = sy * sourceWidth + sx;
      const right = sy * sourceWidth + ((sx + 1) % sourceWidth);
      const up = Math.max(0, sy - 1) * sourceWidth + sx;
      if (world.layers.plates[index] === world.layers.plates[right] && world.layers.plates[index] === world.layers.plates[up]) continue;
      const offset = (y * textureWidth + x) * 4;
      image.data[offset] = Math.round(image.data[offset] * 0.78);
      image.data[offset + 1] = Math.round(image.data[offset + 1] * 0.72);
      image.data[offset + 2] = Math.round(image.data[offset + 2] * 0.66);
    }
  }
  ctx.putImageData(image, 0, 0);
}

function createGlobeGeometry(project: WorldProject): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 160, 80);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  const [, highElevation] = rasterPercentileRange(world.layers.elevation, 0.02, 0.98);
  const landRange = Math.max(0.0001, highElevation - world.seaLevel);
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i).normalize();
    const longitude = Math.atan2(vertex.z, vertex.x);
    const latitude = Math.asin(vertex.y);
    const x = Math.max(0, Math.min(width - 1, Math.floor(((longitude + Math.PI) / (Math.PI * 2)) * width)));
    const y = Math.max(0, Math.min(height - 1, Math.floor((0.5 - latitude / Math.PI) * height)));
    const index = y * width + x;
    const elevation = world.layers.elevation[index];
    const land01 = clamp01((elevation - world.seaLevel) / landRange);
    const shoreLift = world.layers.water[index] === 1 ? 0 : 0.0025;
    const radius = world.layers.water[index] === 1 ? 0.982 : 1 + shoreLift + land01 * 0.026;
    positions.setXYZ(i, vertex.x * radius, vertex.y * radius, vertex.z * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function rasterPercentileRange(values: Float32Array, lowPercentile: number, highPercentile: number): [number, number] {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const low = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * lowPercentile)))];
  const high = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * highPercentile)))];
  return low === high ? [sorted[0] ?? 0, sorted[sorted.length - 1] ?? 1] : [low, high];
}

function globeSlopeSignal(world: WorldProject['primaryWorld'], index: number): number {
  const { width, height } = world.mapModel.resolution;
  const x = index % width;
  const y = Math.floor(index / width);
  const current = world.layers.elevation[index];
  const left = world.layers.elevation[y * width + ((x - 1 + width) % width)];
  const right = world.layers.elevation[y * width + ((x + 1) % width)];
  const up = world.layers.elevation[Math.max(0, y - 1) * width + x];
  const down = world.layers.elevation[Math.min(height - 1, y + 1) * width + x];
  return Math.abs(current - left) + Math.abs(current - right) + Math.abs(current - up) + Math.abs(current - down);
}

function deterministicGrain(x: number, y: number, seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= Math.imul(x + 374761393, 668265263);
  h ^= Math.imul(y + 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const amount = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ];
}

function scaleRgb(color: [number, number, number], scale: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * scale))),
    Math.max(0, Math.min(255, Math.round(color[1] * scale))),
    Math.max(0, Math.min(255, Math.round(color[2] * scale)))
  ];
}

function smoothStep01(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clampGlobeTilt(value: number): number {
  return Math.max(-1.1, Math.min(1.1, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function identityWithExternalAccount(identity: LocalUserIdentity, account: ExternalAccountIdentity): LocalUserIdentity {
  const displayName = account.displayName?.trim();
  return {
    ...identity,
    displayName: displayName && identity.displayName === 'World Builder' ? displayName : identity.displayName,
    externalIds: {
      ...identity.externalIds,
      googleId: account.provider === 'google' ? account.externalId : identity.externalIds.googleId,
      steamId: account.provider === 'steam' ? account.externalId : identity.externalIds.steamId
    },
    updatedAt: new Date().toISOString()
  };
}

const worldLibraryDbName = 'world-forge-library';
const worldLibraryStore = 'worlds';

type StoredWorldRecord = SavedMapRecord & {
  project: unknown;
};

function savedMapRecordForProject(project: WorldProject): SavedMapRecord {
  return {
    projectId: project.projectId,
    projectName: project.projectName,
    seed: project.seed,
    updatedAt: project.updatedAt
  };
}

function mergeSavedMapRecords(...groups: SavedMapRecord[][]): SavedMapRecord[] {
  const byId = new Map<string, SavedMapRecord>();
  for (const record of groups.flat()) {
    const existing = byId.get(record.projectId);
    if (!existing || new Date(record.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byId.set(record.projectId, record);
    }
  }
  return [...byId.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function saveStoredWorld(project: WorldProject): Promise<void> {
  const record: StoredWorldRecord = {
    ...savedMapRecordForProject(project),
    project: serializeProject(project, { includeLayerData: true })
  };
  const db = await openWorldLibraryDb();
  await idbRequest(db.transaction(worldLibraryStore, 'readwrite').objectStore(worldLibraryStore).put(record));
  db.close();
}

async function loadStoredWorldProject(projectId: string): Promise<WorldProject | null> {
  const db = await openWorldLibraryDb();
  const record = await idbRequest<StoredWorldRecord | undefined>(db.transaction(worldLibraryStore, 'readonly').objectStore(worldLibraryStore).get(projectId));
  db.close();
  return record?.project ? deserializeProject(record.project) : null;
}

async function deleteStoredWorldProject(projectId: string): Promise<void> {
  const db = await openWorldLibraryDb();
  await idbRequest(db.transaction(worldLibraryStore, 'readwrite').objectStore(worldLibraryStore).delete(projectId));
  db.close();
}

async function listStoredWorldRecords(): Promise<SavedMapRecord[]> {
  const db = await openWorldLibraryDb();
  const records = await idbRequest<StoredWorldRecord[]>(db.transaction(worldLibraryStore, 'readonly').objectStore(worldLibraryStore).getAll());
  db.close();
  return records.map(({ project, ...record }) => record).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function openWorldLibraryDb(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('In-app world storage is not available in this environment.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(worldLibraryDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(worldLibraryStore)) db.createObjectStore(worldLibraryStore, { keyPath: 'projectId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open world library.'));
  });
}

function idbRequest<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('World library request failed.'));
  });
}

function RangeControl({
  label,
  range,
  bounds,
  onMin,
  onMax
}: {
  label: string;
  range: NumericRange;
  bounds: NumericRange;
  onMin: (value: number) => void;
  onMax: (value: number) => void;
}) {
  const step = bounds.unit === '%' || bounds.unit === 'deg' || label === 'Moons' || label === 'Plates' || label === 'Regions' ? 1 : 0.01;
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  const minPercent = ((min - bounds.min) / (bounds.max - bounds.min)) * 100;
  const maxPercent = ((max - bounds.min) / (bounds.max - bounds.min)) * 100;
  return (
    <div className="range-control">
      <span>{label}</span>
      <div
        className="range-slider"
        style={{
          '--range-min': `${minPercent}%`,
          '--range-max': `${maxPercent}%`
        } as React.CSSProperties}
      >
        <input
          aria-label={`${label} minimum`}
          max={bounds.max}
          min={bounds.min}
          step={step}
          type="range"
          value={min}
          onChange={(event) => onMin(Math.min(Number(event.target.value), max))}
        />
        <input
          aria-label={`${label} maximum`}
          max={bounds.max}
          min={bounds.min}
          step={step}
          type="range"
          value={max}
          onChange={(event) => onMax(Math.max(Number(event.target.value), min))}
        />
      </div>
      <output>{formatRange(min, max, range.unit, label)}</output>
    </div>
  );
}

function formatRange(min: number, max: number, unit?: string, label?: string): string {
  const places = unit === '%' || unit === 'deg' || label === 'Moons' ? 0 : 2;
  return `${min.toFixed(places)}-${max.toFixed(places)}${unit ? ` ${unit}` : ''}`;
}

function ExportButton({ icon, label, task, disabled, title, onClick }: { icon: React.ReactNode; label: string; task: ExportTaskState; disabled: boolean; title: string; onClick: () => void }) {
  const running = task.status === 'running';
  const complete = task.status === 'complete';
  const errored = task.status === 'error';
  const progressLabel = running ? `${Math.round(task.progress * 100)}%` : complete ? 'Done' : errored ? 'Error' : label;
  return (
    <button
      type="button"
      className={`export-button ${task.status}`}
      disabled={disabled || running}
      title={task.message || title}
      style={{ '--progress': task.progress } as React.CSSProperties}
      onClick={onClick}
    >
      {icon}
      <span>{progressLabel}</span>
    </button>
  );
}

function Metric({ label, value, status }: { label: string; value: string; status?: 'ok' | 'warn' }) {
  return (
    <div className={`metric ${status ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BiomeLegend() {
  const waterEntries = [
    ['deep ocean', cleanGameMapTheme.colors.oceanDeep],
    ['ocean', cleanGameMapTheme.colors.ocean],
    ['shallow shelf', cleanGameMapTheme.colors.shelf]
  ];
  return (
    <div className="map-legend" aria-label="Biome color legend">
      {waterEntries.map(([label, color]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
      {biomeNames.map((biome) => (
        <span key={biome}>
          <i style={{ background: biomeLegendColor(biome) }} />
          {biome.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
}

function biomeLegendColor(biome: string): string {
  if (biome === 'ice_cap') return cleanGameMapTheme.colors.ice;
  return cleanGameMapTheme.colors[biome] ?? cleanGameMapTheme.colors.grassland;
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename.replace(/[^a-z0-9._-]+/gi, '-');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to encode canvas export.'));
    }, type);
  });
}

function drawVttHexGridOverlay(canvas: HTMLCanvasElement, project: WorldProject, hexSizeMiles: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const circumferenceMiles = planetCircumferenceMiles(project);
  const milesPerPixel = circumferenceMiles / canvas.width;
  const hexWidth = Math.max(8, hexSizeMiles / Math.max(0.0001, milesPerPixel));
  const radius = hexWidth / Math.sqrt(3);
  const rowStep = radius * 1.5;
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 27, 31, 0.62)';
  ctx.lineWidth = Math.max(1, hexWidth * 0.018);
  let row = 0;
  for (let cy = radius; cy <= canvas.height + radius; cy += rowStep) {
    const rowOffset = row % 2 === 1 ? hexWidth / 2 : 0;
    for (let cx = rowOffset; cx <= canvas.width + hexWidth; cx += hexWidth) {
      ctx.beginPath();
      for (let point = 0; point < 6; point += 1) {
        const angle = ((60 * point - 90) * Math.PI) / 180;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    row += 1;
  }
  ctx.restore();
}

function calculateVttHexMetrics(project: WorldProject, width: number, height: number, hexSizeMiles: number): { columns: number; rows: number; hexSizePx: number } {
  const milesPerPixel = planetCircumferenceMiles(project) / Math.max(1, width);
  const hexSizePx = Math.max(8, hexSizeMiles / Math.max(0.0001, milesPerPixel));
  const radius = hexSizePx / Math.sqrt(3);
  return {
    columns: Math.ceil(width / hexSizePx),
    rows: Math.ceil(height / Math.max(1, radius * 1.5)),
    hexSizePx: Math.round(hexSizePx)
  };
}

function planetCircumferenceMiles(project: WorldProject): number {
  return Math.PI * 2 * 3959 * Math.max(0.1, project.primaryWorld.sizeClass);
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-');
}

createRoot(document.getElementById('root')!).render(<App />);
