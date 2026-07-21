import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cloud, Coffee, Copy, Download, FileJson, FolderOpen, Hexagon, Image, Layers, Mail, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCw, Save, Search, Settings, Shuffle, Upload, User, X } from 'lucide-react';
import JSZip from 'jszip';
import { createDefaultConfig } from '@world-forge/generator-core';
import { exportHexGridSvg, exportHexTileMapJson, exportSvg, exportVttGridSvg, exportVttMetadata, exportWforge, importWforge, projectToJson } from '@world-forge/exporters';
import { CoastlineTreatment, MapMode, MapTheme, PointInspectionRecord, RenderMode, cleanGameMapTheme, inspectWorldPoint, renderWorldToCanvas } from '@world-forge/renderer';
import {
  Biome,
  BiomeClassificationRule,
  GenerationConfig,
  HexTileFeature,
  ContentCategory,
  ContentLibraryConfig,
  ParameterRanges,
  WorldHexOverlayLevel,
  WorldProject,
  biomeNames,
  civ7StyleHexTileProfile,
  codeToBiome,
  defaultContentLibrary,
  hexTileMapPresets,
  parameterControlBounds,
  topologyResolutionForOutput
} from '@world-forge/shared';
import {
  CloudSyncSettings,
  LocalUserIdentity,
  SavedMapRecord,
  WorkspaceUiSettings,
  buildWorkspaceSettings,
  can,
  isLoggedIn,
  isLocalOnlyIdentity,
  loadCloudSyncSettings,
  loadIdentity,
  loadWorkspaceSettings,
  normalizeWorkspaceUiSettings,
} from './sync';
import { mergeSavedMapRecords } from './storage';
import { MyWorldsPanel } from './worlds/MyWorldsPanel';
import { useWorldLibraryCommands } from './worlds/useWorldLibraryCommands';
import { GeneratorPanel } from './generator/GeneratorPanel';
import { WorldWorkspace } from './workspace/WorldWorkspace';
import { RightPanel } from './panels/RightPanel';
import { DiagnosticsPanel, Metric, PointInspectorPanel } from './diagnostics/DiagnosticsPanels';
import { ContentConfigModal, type ConfigTab } from './config/ContentConfigModal';
import { useExportCommands, type ExportTaskState } from './exports/useExportCommands';
import { buildWorldDiagnostics } from './diagnostics/buildWorldDiagnostics';
import { DevPanel } from './dev/DevPanel';
import { GraphWorkspace } from './dev/GraphWorkspace';
import { useDevGraphWorkspace } from './dev/useDevGraphWorkspace';
import { useGenerationWorkflow } from './generation/useGenerationWorkflow';
import { GlobeViewer, type GlobeDebugMode } from './globe/GlobeViewer';
import { useCloudWorkspaceSync } from './workspace/useCloudWorkspaceSync';
import { useWorkspacePersistence } from './workspace/useWorkspacePersistence';
import { APP_SOURCE_COMMIT, APP_VERSION, APP_VISIBLE_VERSION } from './appVersion';
import { ReleaseNotesModal } from './release/ReleaseNotesModal';
import { applyParchmentShellEmbedFlag } from './shell/embedMode';
import './styles.css';
import './devWorkspace.css';

applyParchmentShellEmbedFlag();

const APP_NAME = 'World Forge';
const FEEDBACK_EMAIL = 'support@threewheeledsloth.com';
const FEEDBACK_SUBJECT = 'World Forge Feedback';
const FEEDBACK_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(FEEDBACK_EMAIL)}&su=${encodeURIComponent(FEEDBACK_SUBJECT)}`;
type RangeKey = keyof ParameterRanges;
type ViewMode = 'map' | 'globe';
type HighestPointTarget = { x: number; y: number; width: number; height: number; latitude: number; longitude: number };
type HexInspectionTarget = { levelId: string; label: string; nominalHexWidthMiles: number; q: number; r: number; x: number; y: number; width: number; height: number };
type RightPanelTab = 'world' | 'hex' | 'diagnostics';
type LeftPanelTab = 'generator' | 'worlds' | 'dev';
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
const WORLD_FORGE_BUILD_MESSAGE = 'parchment-worlds:world-forge-build';

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

function resolutionOptionFromStored<T extends { label: string; width: number; height: number }>(options: T[], stored: { width: number; height: number } | undefined, fallback: T): T {
  return options.find((option) => option.width === stored?.width && option.height === stored?.height) ?? fallback;
}

function storedMapMode(value: string | undefined): MapMode {
  return ['biomes', 'elevation', 'heightmap', 'rainfall', 'climate-moisture', 'climate-precipitation', 'wetness-delta', 'temperature', 'wind', 'current', 'water-mask', 'sea-level', 'water-depth', 'slope', 'topology-face', 'terrain-only'].includes(value ?? '') ? value as MapMode : 'biomes';
}

function storedRenderMode(value: string | undefined): RenderMode {
  return value === 'natural' ? 'natural' : 'data';
}

function storedCoastlineTreatment(value: string | undefined): CoastlineTreatment {
  return ['bare', 'toned', 'outlined'].includes(value ?? '') ? value as CoastlineTreatment : 'toned';
}

function storedViewMode(value: string | undefined): ViewMode {
  return value === 'globe' ? 'globe' : 'map';
}

function storedRightPanelTab(value: string | undefined): RightPanelTab {
  return value === 'hex' || value === 'diagnostics' ? value : 'world';
}

function storedLeftPanelTab(value: string | undefined): LeftPanelTab {
  return value === 'worlds' || value === 'dev' ? value : 'generator';
}

function clampViewZoom(value: number): number {
  return Math.max(0.75, Math.min(8, Number.isFinite(value) ? value : 1));
}

const habitableWorldRanges: ParameterRanges = {
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

type WorldPreset = { label: string; ranges: ParameterRanges; tolerance?: number };

function rangesFrom(base: ParameterRanges, overrides: Partial<ParameterRanges>): ParameterRanges {
  return {
    ...base,
    ...overrides
  };
}

const worldPresets: WorldPreset[] = [
  {
    label: 'Earthlike',
    ranges: rangesFrom(habitableWorldRanges, {
      oceanPercentage: { min: 58, max: 72, unit: '%' },
      aridity: { min: 0.35, max: 0.6 },
      continentCount: { min: 4, max: 7 },
      continentScale: { min: 0.5, max: 0.68 },
      islandDensity: { min: 0.25, max: 0.5 },
      riverDensity: { min: 1.5, max: 2.4 }
    })
  },
  {
    label: 'Habitable World',
    ranges: habitableWorldRanges
  },
  {
    label: 'Waterworld',
    ranges: rangesFrom(habitableWorldRanges, {
      oceanPercentage: { min: 78, max: 88, unit: '%' },
      continentCount: { min: 2, max: 5 },
      continentScale: { min: 0.18, max: 0.38 },
      islandDensity: { min: 0.45, max: 0.85 },
      riverDensity: { min: 0.7, max: 1.5 }
    })
  },
  {
    label: 'Archipelago',
    ranges: rangesFrom(habitableWorldRanges, {
      oceanPercentage: { min: 64, max: 78, unit: '%' },
      continentCount: { min: 5, max: 10 },
      continentScale: { min: 0.16, max: 0.34 },
      islandDensity: { min: 0.7, max: 1 },
      riverDensity: { min: 0.8, max: 1.8 }
    })
  },
  {
    label: 'Desert World',
    ranges: rangesFrom(habitableWorldRanges, {
      oceanPercentage: { min: 28, max: 45, unit: '%' },
      aridity: { min: 0.68, max: 0.9 },
      averageTemperatureC: { min: 18, max: 30, unit: 'C' },
      continentCount: { min: 2, max: 5 },
      continentScale: { min: 0.48, max: 0.75 },
      islandDensity: { min: 0.1, max: 0.35 },
      riverDensity: { min: 0.3, max: 1.1 }
    }),
    tolerance: 8
  },
  {
    label: 'Pangea',
    ranges: rangesFrom(habitableWorldRanges, {
      oceanPercentage: { min: 48, max: 62, unit: '%' },
      continentCount: { min: 1, max: 2 },
      continentScale: { min: 0.78, max: 1 },
      islandDensity: { min: 0, max: 0.18 },
      riverDensity: { min: 1.8, max: 3.2 }
    })
  },
  {
    label: 'Random World',
    ranges: parameterControlBounds,
    tolerance: 12
  }
];

function presetByLabel(label: string) {
  return worldPresets.find((option) => option.label === label);
}

function configWithPreset(config: GenerationConfig, label: string): GenerationConfig {
  const preset = presetByLabel(label);
  if (!preset) return config;
  return {
    ...config,
    parameterRanges: preset.ranges,
    selectedValues: {
      oceanTolerancePercentagePoints: preset.tolerance ?? config.selectedValues?.oceanTolerancePercentagePoints ?? 5
    }
  };
}

function configForFreshGeneration(config: GenerationConfig): GenerationConfig {
  return {
    ...config,
    selectedValues: {
      oceanTolerancePercentagePoints: config.selectedValues?.oceanTolerancePercentagePoints ?? 5
    }
  };
}

function App() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') !== 'shell' || window.parent === window) return;
    window.parent.postMessage({
      type: WORLD_FORGE_BUILD_MESSAGE,
      payload: {
        version: APP_VERSION,
        sourceCommit: APP_SOURCE_COMMIT
      }
    }, '*');
  }, []);

  const defaultHighConfig = () => configWithPreset(normalizeGenerationConfig(createDefaultConfig(defaultSeed, { width: 2048, height: 1024 })), 'Earthlike');
  const storedWorkspace = useMemo(() => loadWorkspaceSettings(), []);
  const storedUi = useMemo(() => normalizeWorkspaceUiSettings(storedWorkspace.ui), [storedWorkspace.ui]);
  const [config, setConfig] = useState<GenerationConfig>(() => normalizeGenerationConfig(storedWorkspace.config ?? defaultHighConfig()));
  const [project, setProject] = useState<WorldProject | null>(null);
  const [contentLibrary, setContentLibrary] = useState<ContentLibraryConfig>(() => normalizeContentLibrary(storedWorkspace.contentLibrary ?? structuredClone(defaultContentLibrary)));
  const [savedMaps, setSavedMaps] = useState<SavedMapRecord[]>(() => storedWorkspace.savedMaps ?? []);
  const [identity, setIdentity] = useState<LocalUserIdentity>(() => loadIdentity());
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings>(() => loadCloudSyncSettings());
  const [configOpen, setConfigOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('biomes');
  const [selectedPreset, setSelectedPreset] = useState(storedUi.selectedPreset);
  const [previewResolution, setPreviewResolution] = useState(() => resolutionOptionFromStored(previewResolutionOptions, storedUi.previewResolution, previewResolutionOptions[1]));
  const [exportResolution, setExportResolution] = useState(() => resolutionOptionFromStored(resolutionOptions, storedUi.exportResolution, resolutionOptions[1]));
  const [tilePresetId, setTilePresetId] = useState(storedWorkspace.tileExport?.presetId ?? defaultHexPreset.id);
  const [tileWidth, setTileWidth] = useState(storedWorkspace.tileExport?.width ?? defaultHexPreset.width);
  const [tileHeight, setTileHeight] = useState(storedWorkspace.tileExport?.height ?? defaultHexPreset.height);
  const [tileFeatures, setTileFeatures] = useState<HexTileFeature[]>(() => normalizeTileFeatures(storedWorkspace.tileExport?.enabledFeatures as string[] | undefined));
  const [vttGridEnabled, setVttGridEnabled] = useState(storedUi.vttGridEnabled);
  const [vttHexSizeMiles, setVttHexSizeMiles] = useState(storedUi.vttHexSizeMiles);
  const [vttHexSizeMilesInput, setVttHexSizeMilesInput] = useState(String(storedUi.vttHexSizeMiles));
  const [vttResolution, setVttResolution] = useState(() => resolutionOptionFromStored(resolutionOptions, storedUi.vttResolution, resolutionOptions[2]));
  const [showPlates, setShowPlates] = useState(storedUi.showPlates);
  const [showRivers, setShowRivers] = useState(storedUi.showRivers);
  const [showHexes, setShowHexes] = useState(storedUi.showHexes);
  const [showGlobeShells, setShowGlobeShells] = useState(true);
  const [globeDebugMode, setGlobeDebugMode] = useState<GlobeDebugMode>('final');
  const [mapMode, setMapMode] = useState<MapMode>(() => storedMapMode(storedUi.mapMode));
  const [renderMode, setRenderMode] = useState<RenderMode>(() => storedRenderMode(storedUi.renderMode));
  const [coastlineTreatment, setCoastlineTreatment] = useState<CoastlineTreatment>(() => storedCoastlineTreatment(storedUi.coastlineTreatment));
  const [viewMode, setViewMode] = useState<ViewMode>(() => storedViewMode(storedUi.viewMode));
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>(() => storedRightPanelTab(storedUi.rightPanelTab));
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>(() => storedLeftPanelTab(storedUi.leftPanelTab));
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(storedUi.leftPanelCollapsed);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(storedUi.rightPanelCollapsed);
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [inspectionRecord, setInspectionRecord] = useState<PointInspectionRecord | null>(null);
  const [highestPointTarget, setHighestPointTarget] = useState<HighestPointTarget | null>(null);
  const [hexInspectionTarget, setHexInspectionTarget] = useState<HexInspectionTarget | null>(null);
  const [renderedHexOverlayLevel, setRenderedHexOverlayLevel] = useState<WorldHexOverlayLevel | null>(null);
  const [inspectionCopyStatus, setInspectionCopyStatus] = useState('');
  const [mapZoom, setMapZoom] = useState(() => clampViewZoom(storedUi.mapZoom));
  const [globeZoom, setGlobeZoom] = useState(() => clampViewZoom(storedUi.globeZoom));
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const mapPanRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean } | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const devGraph = useDevGraphWorkspace();
  const mapTheme = useMemo(() => contentLibraryTheme(contentLibrary), [contentLibrary]);
  const {
    exportTasks,
    downloadPng,
    downloadJson,
    downloadSvg,
    downloadHexGridSvg,
    downloadHexTileJson,
    downloadPackage,
    downloadVttPackage
  } = useExportCommands({
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
  });
  const tileExportConfig = () => ({
    width: tileWidth,
    height: tileHeight,
    profileId: civ7StyleHexTileProfile.id,
    enabledFeatures: tileFeatures
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const generation = useGenerationWorkflow({
    canvasRef,
    previousProject: project,
    onProjectGenerated: setProject
  });
  const { isGenerating, generationProgress, generationStage, generationNodeProgress } = generation;

  useEffect(() => {
    if (!configOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfigOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [configOpen]);

  useEffect(() => {
    if (!canvasRef.current || viewMode !== 'map') return;
    if (isGenerating) return;
    if (!project) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }
    const showRiverOverlay = showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap';
    renderWorldToCanvas(canvasRef.current, project, mapTheme, {
      rivers: showRiverOverlay,
      plates: showPlates,
      heightmap: mapMode === 'elevation',
      coastlineTreatment,
      renderMode,
      mode: mapMode,
      targetResolution: previewResolution.width > 0 ? previewResolution : undefined
    });
  }, [coastlineTreatment, isGenerating, mapMode, mapTheme, previewResolution, project, renderMode, showPlates, showRivers, viewMode]);

  useEffect(() => {
    setHexInspectionTarget((current) => {
      if (!current || !renderedHexOverlayLevel || current.levelId === renderedHexOverlayLevel.id) return current;
      return null;
    });
  }, [renderedHexOverlayLevel]);

  const invalidRanges = useMemo(() => {
    return Object.entries(config.parameterRanges)
      .filter(([, range]) => range.min > range.max)
      .map(([key]) => rangeLabels[key as RangeKey]);
  }, [config.parameterRanges]);

  const generate = (nextConfig = config) => {
    if (invalidRanges.length > 0) return;
    const effectiveConfig = generationConfigWithContentRules(configForFreshGeneration(nextConfig), contentLibrary);
    generation.generate(effectiveConfig);
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
    const preset = presetByLabel(label);
    if (!preset) return;
    setSelectedPreset(label);
    setConfig((current) => configWithPreset(current, label));
  };

  const applyWorkspaceUiSettings = (settings: Partial<WorkspaceUiSettings> | undefined) => {
    const ui = normalizeWorkspaceUiSettings(settings);
    setSelectedPreset(ui.selectedPreset);
    setPreviewResolution(resolutionOptionFromStored(previewResolutionOptions, ui.previewResolution, previewResolutionOptions[1]));
    setExportResolution(resolutionOptionFromStored(resolutionOptions, ui.exportResolution, resolutionOptions[1]));
    setVttResolution(resolutionOptionFromStored(resolutionOptions, ui.vttResolution, resolutionOptions[2]));
    setVttGridEnabled(ui.vttGridEnabled);
    setVttHexSizeMiles(ui.vttHexSizeMiles);
    setVttHexSizeMilesInput(String(ui.vttHexSizeMiles));
    setShowPlates(ui.showPlates);
    setShowRivers(ui.showRivers);
    setShowHexes(ui.showHexes);
    setMapMode(storedMapMode(ui.mapMode));
    setRenderMode(storedRenderMode(ui.renderMode));
    setCoastlineTreatment(storedCoastlineTreatment(ui.coastlineTreatment));
    setViewMode(storedViewMode(ui.viewMode));
    setRightPanelTab(storedRightPanelTab(ui.rightPanelTab));
    setLeftPanelTab(storedLeftPanelTab(ui.leftPanelTab));
    setLeftPanelCollapsed(ui.leftPanelCollapsed);
    setRightPanelCollapsed(ui.rightPanelCollapsed);
    setMapZoom(clampViewZoom(ui.mapZoom));
    setGlobeZoom(clampViewZoom(ui.globeZoom));
  };

  const workspaceSettings = useMemo(() => buildWorkspaceSettings({
    config,
    contentLibrary,
    tileExport: {
      presetId: tilePresetId,
      width: tileWidth,
      height: tileHeight,
      enabledFeatures: tileFeatures
    },
    ui: {
      selectedPreset,
      previewResolution,
      exportResolution,
      vttResolution,
      vttGridEnabled,
      vttHexSizeMiles,
      showPlates,
      showRivers,
      showHexes,
      mapMode,
      renderMode,
      coastlineTreatment,
      viewMode,
      rightPanelTab,
      leftPanelTab,
      leftPanelCollapsed,
      rightPanelCollapsed,
      mapZoom,
      globeZoom
    },
    savedMaps
  }), [coastlineTreatment, config, contentLibrary, exportResolution, globeZoom, leftPanelCollapsed, leftPanelTab, mapMode, mapZoom, previewResolution, renderMode, rightPanelCollapsed, rightPanelTab, savedMaps, selectedPreset, showHexes, showPlates, showRivers, tileFeatures, tileHeight, tilePresetId, tileWidth, viewMode, vttGridEnabled, vttHexSizeMiles, vttResolution]);

  const applyPulledWorkspace = (workspace: typeof workspaceSettings) => {
    setConfig(normalizeGenerationConfig(workspace.config));
    setContentLibrary(normalizeContentLibrary(workspace.contentLibrary));
    setTilePresetId(workspace.tileExport.presetId);
    setTileWidth(workspace.tileExport.width);
    setTileHeight(workspace.tileExport.height);
    setTileFeatures(normalizeTileFeatures(workspace.tileExport.enabledFeatures as string[]));
    applyWorkspaceUiSettings(workspace.ui);
    setSavedMaps(workspace.savedMaps ?? []);
  };

  const handleSavedMapsLoaded = useCallback((stored: SavedMapRecord[]) => {
    setSavedMaps((current) => mergeSavedMapRecords(current, stored));
  }, []);

  useWorkspacePersistence({
    identity,
    cloudSync,
    workspace: workspaceSettings,
    onSavedMapsLoaded: handleSavedMapsLoaded
  });

  const {
    syncStatus,
    updateDisplayName,
    updateExternalAccount,
    updateCloudSync,
    signInForSync,
    signOut,
    pushCloudSync,
    pullCloudSync
  } = useCloudWorkspaceSync({
    identity,
    setIdentity,
    cloudSync,
    setCloudSync,
    workspace: workspaceSettings,
    applyPulledWorkspace,
    clearProject: () => setProject(null)
  });
  const {
    worldLibraryStatus,
    saveCurrentWorldInApp,
    loadStoredWorld,
    deleteStoredWorld
  } = useWorldLibraryCommands({
    project,
    setProject,
    setSavedMaps,
    onWorldLoaded: (loaded) => {
      setProject(loaded);
      setConfig(normalizeGenerationConfig(loaded.config));
      setInspectionRecord(null);
      setHexInspectionTarget(null);
    }
  });

  const randomizeSeed = () => {
    const seed = String(Math.floor(1000000 + Math.random() * 9000000));
    const extended = config as GenerationConfig & { seeds?: { star?: string; world?: string } };
    setConfig({
      ...config,
      seed,
      selectedValues: {
        oceanTolerancePercentagePoints: config.selectedValues?.oceanTolerancePercentagePoints ?? 5
      },
      seeds: { ...extended.seeds, star: extended.seeds?.star ?? config.seed, world: seed }
    } as GenerationConfig);
  };

  const openPackage = async (file?: File) => {
    if (!file) return;
    const parsed = await importWforge(file);
    setProject(parsed);
    setConfig(normalizeGenerationConfig(parsed.config));
    setInspectionRecord(null);
    setHexInspectionTarget(null);
  };

  const toggleDiagnosticMode = useCallback(() => {
    setDiagnosticMode((enabled) => {
      const next = !enabled;
      if (!next) {
        setInspectionRecord(null);
        setInspectionCopyStatus('');
      }
      return next;
    });
  }, []);

  const inspectMapPoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressNextMapClickRef.current) {
      suppressNextMapClickRef.current = false;
      return;
    }
    if (!project || viewMode !== 'map' || isGenerating) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const world = project.primaryWorld;
    const x = (canvasX / Math.max(1, canvas.width)) * world.mapModel.resolution.width;
    const y = (canvasY / Math.max(1, canvas.height)) * world.mapModel.resolution.height;
    if (showHexes && renderedHexOverlayLevel) {
      setHexInspectionTarget(hexInspectionForPoint(renderedHexOverlayLevel, x, y, world.mapModel.resolution.width, world.mapModel.resolution.height));
    }
    if (diagnosticMode) {
      setInspectionRecord(inspectWorldPoint(project, { source: 'map', x, y, screen: { x: Math.round(event.clientX), y: Math.round(event.clientY) } }, mapTheme, renderMode, mapMode));
    }
  }, [diagnosticMode, isGenerating, mapMode, mapTheme, project, renderedHexOverlayLevel, renderMode, showHexes, viewMode]);

  const inspectGlobePoint = useCallback((x: number, y: number, screen: { x: number; y: number }) => {
    if (!diagnosticMode || !project) return;
    setInspectionRecord(inspectWorldPoint(project, { source: 'globe', x, y, screen }, mapTheme, renderMode, mapMode));
  }, [diagnosticMode, mapMode, mapTheme, project, renderMode]);

  const currentViewZoom = viewMode === 'globe' ? globeZoom : mapZoom;
  const handleMapWheelZoom = useCallback((event: WheelEvent, frame: HTMLDivElement) => {
    event.preventDefault();
    const container = frame.parentElement;
    const rect = frame.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const contentX = container ? container.scrollLeft + localX : localX;
    const contentY = container ? container.scrollTop + localY : localY;
    setMapZoom((current) => {
      const step = event.ctrlKey || event.metaKey ? 1.35 : 1.12;
      const next = clampViewZoom(current * (event.deltaY > 0 ? 1 / step : step));
      const ratio = next / Math.max(0.0001, current);
      window.requestAnimationFrame(() => {
        if (!container) return;
        container.scrollLeft = contentX * ratio - localX;
        container.scrollTop = contentY * ratio - localY;
      });
      return next;
    });
  }, []);
  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame || viewMode !== 'map') return;
    const onWheel = (event: WheelEvent) => handleMapWheelZoom(event, frame);
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [handleMapWheelZoom, isGenerating, project, viewMode]);
  const handleGlobeWheelZoom = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const step = event.ctrlKey || event.metaKey ? 1.35 : 1.12;
    setGlobeZoom((current) => clampViewZoom(current * (event.deltaY > 0 ? 1 / step : step)));
  }, []);
  const beginMapPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = event.currentTarget.parentElement;
    if (!container) return;
    mapPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const updateMapPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = mapPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (Math.hypot(dx, dy) > 4) pan.moved = true;
    container.scrollLeft = pan.scrollLeft - dx;
    container.scrollTop = pan.scrollTop - dy;
  }, []);
  const endMapPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = mapPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (pan.moved) suppressNextMapClickRef.current = true;
    mapPanRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const copyInspectionJson = useCallback(async () => {
    if (!inspectionRecord) return;
    const json = JSON.stringify(inspectionRecord, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setInspectionCopyStatus('Copied');
    } catch {
      setInspectionCopyStatus('Copy unavailable');
      console.info(json);
    }
    window.setTimeout(() => setInspectionCopyStatus(''), 1600);
  }, [inspectionRecord]);

  const openFeedback = async () => {
    setFeedbackStatus('');
    try {
      await navigator.clipboard?.writeText(FEEDBACK_EMAIL);
      setFeedbackStatus('Feedback email copied');
    } catch {
      setFeedbackStatus(FEEDBACK_EMAIL);
    }
    window.open(FEEDBACK_COMPOSE_URL, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => setFeedbackStatus(''), 3000);
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

  const profileStatus = (() => {
    if (!cloudSync.keepSynced) return { className: 'off', label: 'Sync off', title: 'Sync is turned off.' };
    if (cloudSync.lastError) return { className: 'warn', label: isLoggedIn(identity) ? identity.displayName : 'Not Logged In', title: cloudSync.lastError };
    if (isLoggedIn(identity) && cloudSync.serviceBaseUrl && !isLocalOnlyIdentity(identity)) return { className: 'online', label: identity.displayName, title: `Signed in. ${syncStatus}` };
    if (isLoggedIn(identity)) return { className: 'local', label: identity.displayName, title: 'Signed in locally. Cloud service is not configured or unavailable.' };
    return { className: 'offline', label: 'Not Logged In', title: syncStatus };
  })();
  const vttHexMetrics = project && vttGridEnabled ? calculateVttHexMetrics(project, vttResolution.width, vttResolution.height, vttHexSizeMiles) : null;
  const tileHexScaleMiles = project ? Math.round(planetCircumferenceMiles(project) / Math.max(1, tileWidth)) : null;
  const activeHexOverlayLevel = showHexes ? renderedHexOverlayLevel : null;
  const activeHexOverlayLabel = activeHexOverlayLevel ? `${activeHexOverlayLevel.label} (${activeHexOverlayLevel.nominalHexWidthMiles} mi)` : 'hidden until zoomed';
  const devGraphWorkspace = (
    <GraphWorkspace
      node={devGraph.node}
      selectedNodeId={devGraph.selectedNodeId}
      toolbar={devGraph.toolbar}
      onSelectNode={devGraph.actions.selectNode}
      onWorkflowChange={devGraph.actions.setWorkflow}
      onFidelityChange={devGraph.actions.setFidelity}
      onSeedChange={devGraph.actions.setSeed}
      onValidate={devGraph.actions.validate}
      onReset={devGraph.actions.reset}
    />
  );
  const worldDiagnostics = useMemo(
    () => project && rightPanelTab === 'diagnostics' ? buildWorldDiagnostics(project, tileExportConfig(), mapTheme) : null,
    [mapTheme, project, rightPanelTab, tileFeatures, tileHeight, tileWidth]
  );
  const toggleHighestPointTarget = useCallback(() => {
    if (!project || !worldDiagnostics) return;
    setHighestPointTarget((current) => {
      if (current) return null;
      const target = {
        x: worldDiagnostics.geography.highestPointMapX,
        y: worldDiagnostics.geography.highestPointMapY,
        width: project.primaryWorld.mapModel.resolution.width,
        height: project.primaryWorld.mapModel.resolution.height,
        latitude: worldDiagnostics.geography.highestPointLatitude,
        longitude: worldDiagnostics.geography.highestPointLongitude
      };
      if (viewMode === 'map') centerMapOnTarget(target, canvasRef.current);
      return target;
    });
  }, [project, viewMode, worldDiagnostics]);

  return (
    <main className={`app-shell ${leftPanelCollapsed ? 'left-collapsed' : ''} ${rightPanelCollapsed ? 'right-collapsed' : ''}`} aria-busy={isGenerating}>
      <section className={`toolbar ${leftPanelCollapsed ? 'panel-collapsed' : ''}`} aria-label="World generation controls">
        <div className="brand">
          <button type="button" title={leftPanelCollapsed ? 'Expand generation panel' : 'Collapse generation panel'} className="icon-button panel-toggle" onClick={() => setLeftPanelCollapsed((collapsed) => !collapsed)}>
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          {!leftPanelCollapsed && (
            <>
              <strong>{APP_NAME}</strong>
              <button type="button" className="brand-version release-pill" title={`Open release notes and roadmap for build ${APP_VERSION}`} onClick={() => setReleaseNotesOpen(true)}>v{APP_VISIBLE_VERSION}</button>
              <button type="button" title="Configure content sets" className="icon-button" onClick={() => setConfigOpen(true)}>
                <Settings size={16} />
              </button>
            </>
          )}
        </div>
        {leftPanelCollapsed ? (
          <div className="collapsed-panel-label">Generation</div>
        ) : (
        <>
        <div className="panel-tabs left-tabs" role="tablist" aria-label="Left panel sections">
          <button type="button" role="tab" title="Show generation controls" aria-selected={leftPanelTab === 'generator'} className={leftPanelTab === 'generator' ? 'active' : ''} onClick={() => setLeftPanelTab('generator')}>
            Generator
          </button>
          <button type="button" role="tab" title="Show saved in-app worlds" aria-selected={leftPanelTab === 'worlds'} className={leftPanelTab === 'worlds' ? 'active' : ''} onClick={() => setLeftPanelTab('worlds')}>
            My Worlds
          </button>
          <button type="button" role="tab" title="Show developer tools" aria-selected={leftPanelTab === 'dev'} className={leftPanelTab === 'dev' ? 'active' : ''} onClick={() => setLeftPanelTab('dev')}>
            Dev
          </button>
        </div>
        {leftPanelTab === 'generator' ? (
          <GeneratorPanel
            config={config}
            selectedPreset={selectedPreset}
            presetLabels={worldPresets.map((preset) => preset.label)}
            previewResolution={previewResolution}
            previewResolutionOptions={previewResolutionOptions}
            exportResolution={exportResolution}
            resolutionOptions={resolutionOptions}
            sourceTopologyResolution={config.topologyResolution ?? topologyResolutionForOutput(config.outputResolution)}
            invalidRanges={invalidRanges}
            isGenerating={isGenerating}
            profileStatus={profileStatus}
            onConfigChange={setConfig}
            onRandomizeSeed={randomizeSeed}
            onGenerate={() => generate()}
            onOpenSyncSettings={() => {
              setConfigTab('sync');
              setConfigOpen(true);
            }}
            onGenerationResolutionChange={(nextResolution) => setConfig({
              ...config,
              outputResolution: { width: nextResolution.width, height: nextResolution.height }
            })}
            onPresetChange={applyPreset}
            onPreviewResolutionChange={setPreviewResolution}
            onExportResolutionChange={setExportResolution}
            onOceanToleranceChange={updateOceanTolerance}
          />
        ) : leftPanelTab === 'dev' ? (
          <DevPanel onShowGraph={() => setLeftPanelTab('dev')} />
        ) : (
          <MyWorldsPanel
            activeProjectId={project?.projectId}
            canSaveCurrent={Boolean(project)}
            records={savedMaps}
            status={worldLibraryStatus}
            onSaveCurrent={saveCurrentWorldInApp}
            onLoad={loadStoredWorld}
            onRemove={deleteStoredWorld}
          />
        )}
        </>
        )}
        {!leftPanelCollapsed && <button type="button" className="app-version release-version-link" title={`Open release notes and roadmap for build ${APP_VERSION}`} onClick={() => setReleaseNotesOpen(true)}>v{APP_VISIBLE_VERSION}</button>}
      </section>

      <WorldWorkspace
        projectName={leftPanelTab === 'dev' ? 'Developer workspace' : project?.projectName}
        isGenerating={isGenerating}
        generationStage={generationStage}
        generationProgress={generationProgress}
        generationNodeProgress={generationNodeProgress}
        viewMode={viewMode}
        showRivers={showRivers}
        showPlates={showPlates}
        showHexes={showHexes}
        hexOverlayLabel={activeHexOverlayLabel}
        diagnosticMode={diagnosticMode}
        showGlobeShells={showGlobeShells}
        renderMode={renderMode}
        mapMode={mapMode}
        coastlineTreatment={coastlineTreatment}
        globeDebugMode={globeDebugMode}
        viewZoom={currentViewZoom}
        onViewZoomChange={viewMode === 'globe' ? setGlobeZoom : setMapZoom}
        onViewModeChange={setViewMode}
        onShowRiversChange={setShowRivers}
        onShowPlatesChange={setShowPlates}
        onShowHexesChange={setShowHexes}
        onToggleDiagnostics={toggleDiagnosticMode}
        onToggleGlobeShells={() => setShowGlobeShells((visible) => !visible)}
        onRenderModeChange={setRenderMode}
        onMapModeChange={setMapMode}
        onCoastlineTreatmentChange={setCoastlineTreatment}
        onGlobeDebugModeChange={setGlobeDebugMode}
        exportActions={(
          <>
            <ExportButton icon={<Image size={16} />} label="PNG" task={exportTasks.png} disabled={!project} title="Export PNG" onClick={downloadPng} />
            <ExportButton icon={<Layers size={16} />} label="SVG" task={exportTasks.svg} disabled={!project} title="Export simplified SVG" onClick={downloadSvg} />
            <ExportButton icon={<FileJson size={16} />} label="JSON" task={exportTasks.json} disabled={!project} title="Export JSON" onClick={downloadJson} />
            <ExportButton icon={<Save size={16} />} label=".wforge" task={exportTasks.wforge} disabled={!project} title="Save .wforge package" onClick={downloadPackage} />
            <label className="file-button" title="Open .wforge package">
              <FolderOpen size={16} />Open
              <input type="file" accept=".wforge" onChange={(event) => openPackage(event.target.files?.[0])} />
            </label>
          </>
        )}
        mapContent={leftPanelTab === 'dev' ? (
          devGraphWorkspace
        ) : viewMode === 'map' || isGenerating ? (
          <div
            ref={mapFrameRef}
            className="map-canvas-frame"
            style={{ width: `${mapZoom * 100}%` }}
            onPointerDown={beginMapPan}
            onPointerMove={updateMapPan}
            onPointerUp={endMapPan}
            onPointerCancel={endMapPan}
          >
            <canvas ref={canvasRef} aria-label={project ? 'Generated map for ' + project.projectName : 'Generating map preview'} onClick={inspectMapPoint} />
            <HexOverlayCanvas project={project} sourceCanvasRef={canvasRef} visible={showHexes && !isGenerating} zoom={mapZoom} onVisibleLevelChange={setRenderedHexOverlayLevel} />
            {diagnosticMode && inspectionRecord && <MapInspectionMarker record={inspectionRecord} />}
            {showHexes && hexInspectionTarget && <HexInspectionMarker target={hexInspectionTarget} />}
            {highestPointTarget && <HighestPointMapMarker target={highestPointTarget} />}
          </div>
        ) : project ? (
          <GlobeViewer
            project={project}
            mapMode={mapMode}
            renderMode={renderMode}
            mapTheme={mapTheme}
            showRivers={showRivers}
            showPlates={showPlates}
            showGlobeShells={showGlobeShells}
            globeDebugMode={globeDebugMode}
            diagnosticMode={diagnosticMode}
            inspectionRecord={diagnosticMode ? inspectionRecord : null}
            focusTarget={highestPointTarget}
            zoom={globeZoom}
            onZoom={handleGlobeWheelZoom}
            onInspect={inspectGlobePoint}
          />
        ) : null}
        legend={project && mapMode === 'biomes' && renderMode === 'data' && viewMode === 'map' ? <BiomeLegend theme={mapTheme} /> : null}
      />

      <RightPanel
        collapsed={rightPanelCollapsed}
        activeTab={rightPanelTab}
        feedbackStatus={feedbackStatus}
        inspectorContent={inspectionRecord ? (
          <PointInspectorPanel
            record={inspectionRecord}
            copyStatus={inspectionCopyStatus}
            onCopy={copyInspectionJson}
            onClear={() => setInspectionRecord(null)}
          />
        ) : null}
        diagnosticsContent={<DiagnosticsPanel project={project} diagnostics={worldDiagnostics} generatorConfig={config} highestPointTargetActive={Boolean(highestPointTarget)} onToggleHighestPoint={toggleHighestPointTarget} />}
        project={project}
        exportResolution={exportResolution}
        tilePresetId={tilePresetId}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        tileFeatures={tileFeatures}
        tileFeatureLabels={tileFeatureLabels}
        tileHexScaleMiles={tileHexScaleMiles}
        vttResolution={vttResolution}
        resolutionOptions={resolutionOptions}
        vttGridEnabled={vttGridEnabled}
        vttHexSizeMilesInput={vttHexSizeMilesInput}
        vttHexMetrics={vttHexMetrics}
        hexSvgTask={exportTasks.hexSvg}
        tileJsonTask={exportTasks.tileJson}
        vttTask={exportTasks.vtt}
        onCollapsedChange={setRightPanelCollapsed}
        onTabChange={setRightPanelTab}
        onFeedback={openFeedback}
        onTilePresetChange={applyTilePreset}
        onTileWidthChange={(width) => {
          setTilePresetId('custom');
          setTileWidth(width);
        }}
        onTileHeightChange={(height) => {
          setTilePresetId('custom');
          setTileHeight(height);
        }}
        onTileFeatureChange={toggleTileFeature}
        onVttResolutionChange={setVttResolution}
        onVttGridEnabledChange={setVttGridEnabled}
        onVttHexSizeInputChange={setVttHexSizeMilesInput}
        onCommitVttHexSize={() => commitVttHexSizeMiles()}
        renderExportButton={(props) => <ExportButton {...props} />}
        onDownloadHexGridSvg={downloadHexGridSvg}
        onDownloadHexTileJson={downloadHexTileJson}
        onDownloadVttPackage={downloadVttPackage}
      />
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
          onSignOut={signOut}
          onPush={pushCloudSync}
          onPull={pullCloudSync}
        />
      )}
      {releaseNotesOpen && <ReleaseNotesModal version={APP_VERSION} onClose={() => setReleaseNotesOpen(false)} />}
      {isGenerating && <div className="generating-overlay">Generating world</div>}
    </main>
  );
}

function normalizeGenerationConfig(config: Partial<GenerationConfig>): GenerationConfig {
  const fallback = createDefaultConfig(defaultSeed, { width: 2048, height: 1024 });
  const outputResolution = normalizeGenerationResolution(config.outputResolution, fallback.outputResolution);
  const parameterRanges = normalizeParameterRanges(config.parameterRanges);
  const selectedValues = normalizeSelectedValues(config.selectedValues);
  const topologyResolution = Math.max(
    16,
    Math.min(1024, Math.round(finiteNumber(config.topologyResolution, topologyResolutionForOutput(outputResolution))))
  );

  return {
    ...fallback,
    ...config,
    parameterRanges,
    selectedValues,
    generationProfile: 'earthlike-mvp',
    outputResolution,
    topologyResolution,
    projection: 'equirectangular',
    wrapMode: 'east-west'
  };
}

function normalizeGenerationResolution(resolution: Partial<GenerationConfig['outputResolution']> | undefined, fallback: GenerationConfig['outputResolution']) {
  const width = Math.round(finiteNumber(resolution?.width, fallback.width));
  const height = Math.round(finiteNumber(resolution?.height, fallback.height));
  const matchingOption = resolutionOptions.find((option) => option.width === width && option.height === height);
  return matchingOption
    ? { width: matchingOption.width, height: matchingOption.height }
    : { width: fallback.width, height: fallback.height };
}

function normalizeParameterRanges(ranges: Partial<ParameterRanges> | undefined): ParameterRanges {
  const normalized = {} as ParameterRanges;
  for (const key of Object.keys(parameterControlBounds) as RangeKey[]) {
    const bounds = parameterControlBounds[key];
    const fallback = habitableWorldRanges[key];
    const raw = ranges?.[key];
    const min = clampNumber(finiteNumber(raw?.min, fallback.min), bounds.min, bounds.max);
    const max = clampNumber(finiteNumber(raw?.max, fallback.max), bounds.min, bounds.max);
    normalized[key] = {
      min: Math.min(min, max),
      max: Math.max(min, max),
      unit: raw?.unit ?? fallback.unit ?? bounds.unit
    };
  }
  return normalized;
}

function normalizeSelectedValues(values: GenerationConfig['selectedValues'] | undefined): GenerationConfig['selectedValues'] {
  if (!values) return undefined;
  const normalized: GenerationConfig['selectedValues'] = {};
  for (const key of Object.keys(parameterControlBounds) as RangeKey[]) {
    const value = values[key];
    if (Number.isFinite(value)) normalized[key] = Number(value);
  }
  const tolerance = values.oceanTolerancePercentagePoints;
  normalized.oceanTolerancePercentagePoints = Number.isFinite(tolerance) ? clampNumber(Number(tolerance), 0, 30) : 5;
  return normalized;
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeContentLibrary(library: ContentLibraryConfig): ContentLibraryConfig {
  const defaults = structuredClone(defaultContentLibrary);
  const next = structuredClone(library);
  const staleOfficialSetIds = new Set(['civ7-tiles', 'civ7-features', 'civ7-resources', 'civ7-style-tiles', 'civ7-style-features']);
  const staleDefaultMemberIds = new Set(['ocean', 'mountain', 'lake', 'coastal', 'ocean-terrain', 'tundra-tile', 'grassland-tile', 'plains-tile', 'desert-tile', 'tropical-tile', 'flat', 'rough', 'mountainous', 'navigable-river', 'aquatic', 'vegetated', 'wet', 'floodplain', 'ice-feature']);
  const baseLabels: Record<ContentCategory, string> = {
    biomes: 'PW Base Biomes',
    tiles: 'PW Base Tiles',
    features: 'PW Base Features',
    resources: 'PW Base Resources'
  };
  for (const categoryKey of Object.keys(next) as ContentCategory[]) {
    const category = next[categoryKey];
    const defaultCategory = defaults[categoryKey];
    category.sets = category.sets
      .filter((set) => !staleOfficialSetIds.has(set.id))
      .map((set) => ({ ...set, memberIds: set.memberIds.filter((memberId) => !staleDefaultMemberIds.has(memberId)) }));
    category.members = category.members
      .filter((member) => !staleDefaultMemberIds.has(member.id))
      .map((member) => ({ ...member, setIds: member.setIds.filter((setId) => !staleOfficialSetIds.has(setId)) }));
    for (const defaultSet of defaultCategory.sets) {
      const existingIndex = category.sets.findIndex((set) => set.id === defaultSet.id);
      if (existingIndex >= 0) {
        category.sets[existingIndex] = {
          ...defaultSet,
          description: category.sets[existingIndex].description || defaultSet.description
        };
      } else {
        category.sets.push(defaultSet);
      }
    }
    for (const defaultMember of defaultCategory.members) {
      const existingIndex = category.members.findIndex((member) => member.id === defaultMember.id);
      if (existingIndex >= 0) {
        const existing = category.members[existingIndex];
        const uploadedAssets = existing.assets.filter((asset) => asset.kind !== 'preview-color');
        category.members[existingIndex] = {
          ...defaultMember,
          assets: [...defaultMember.assets, ...uploadedAssets]
        };
      } else {
        category.members.push(defaultMember);
      }
    }
    if (staleOfficialSetIds.has(category.defaultSetId)) {
      category.defaultSetId = defaultCategory.defaultSetId;
    }
    if (!category.sets.some((set) => set.id === category.defaultSetId)) category.defaultSetId = defaultCategory.defaultSetId;
    const defaultSet = category.sets.find((set) => set.id === category.defaultSetId) ?? category.sets.find((set) => set.isDefault);
    if (defaultSet) defaultSet.label = baseLabels[categoryKey];
    category.sets = category.sets.map((set) => ({ ...set, isDefault: set.id === category.defaultSetId }));
  }
  return next;
}

function HexOverlayCanvas({
  project,
  sourceCanvasRef,
  visible,
  zoom,
  onVisibleLevelChange
}: {
  project: WorldProject | null;
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  visible: boolean;
  zoom: number;
  onVisibleLevelChange?: (level: WorldHexOverlayLevel | null) => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lastLevelIdRef = useRef<string>('');

  useEffect(() => {
    const overlay = overlayRef.current;
    const source = sourceCanvasRef.current;
    if (!overlay || !source || !project || !visible || !project.primaryWorld.hexOverlay) {
      if (lastLevelIdRef.current) {
        lastLevelIdRef.current = '';
        onVisibleLevelChange?.(null);
      }
      return;
    }
    const hexOverlay = project.primaryWorld.hexOverlay;
    const frame = source.parentElement;
    const viewport = frame?.parentElement;
    if (!frame) return;

    let frameHandle = 0;
    const draw = () => {
      frameHandle = 0;
      const width = source.width || project.primaryWorld.mapModel.resolution.width;
      const height = source.height || project.primaryWorld.mapModel.resolution.height;
      if (width <= 0 || height <= 0) return;
      if (overlay.width !== width) overlay.width = width;
      if (overlay.height !== height) overlay.height = height;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const level = selectVisibleHexOverlayLevel(project, zoom);
      const renderedLevel = level ? drawFlatHexOverlay(ctx, level, hexOverlay.levels, source, frame, viewport, zoom) : null;
      const renderedLevelId = renderedLevel?.id ?? '';
      if (renderedLevelId !== lastLevelIdRef.current) {
        lastLevelIdRef.current = renderedLevelId;
        onVisibleLevelChange?.(renderedLevel);
      }
    };
    const schedule = () => {
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      frameHandle = window.requestAnimationFrame(draw);
    };

    schedule();
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(source);
    resizeObserver.observe(frame);
    viewport?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [onVisibleLevelChange, project, sourceCanvasRef, visible, zoom]);

  if (!visible || !project?.primaryWorld.hexOverlay) return null;
  return <canvas ref={overlayRef} className="hex-overlay-canvas" aria-hidden="true" />;
}

function selectVisibleHexOverlayLevel(project: WorldProject, zoom: number): WorldHexOverlayLevel | null {
  const levels = project.primaryWorld.hexOverlay?.levels ?? [];
  if (!levels.length) return null;
  const preferredIds = zoom >= 5.5
    ? ['regional-24mi', 'world-60mi', 'world-500mi']
    : zoom >= 2.25
      ? ['world-60mi', 'world-500mi']
      : ['world-500mi'];
  const width = Math.max(1, project.primaryWorld.mapModel.resolution.width * zoom);
  const minimumReadableHexPxByLevel: Record<string, number> = {
    'world-500mi': 10,
    'world-60mi': 5,
    'regional-24mi': 3.5
  };
  for (const id of preferredIds) {
    const level = levels.find((candidate) => candidate.id === id);
    if (!level) continue;
    if (width / Math.max(1, level.dimensions.columns) >= (minimumReadableHexPxByLevel[level.id] ?? 5)) return level;
  }
  return null;
}

function drawFlatHexOverlay(
  ctx: CanvasRenderingContext2D,
  initialLevel: WorldHexOverlayLevel,
  overlayLevels: WorldHexOverlayLevel[],
  source: HTMLCanvasElement,
  frame: HTMLElement,
  viewport: Element | null | undefined,
  zoom: number
): WorldHexOverlayLevel | null {
  const level = constrainHexLevelToVisibleCellBudget(initialLevel, overlayLevels, source, frame, viewport);
  if (!level) return null;
  const width = source.width;
  const height = source.height;
  const { columns, rows } = level.dimensions;
  const hexWidth = width / Math.max(1, columns);
  const rowStep = height / Math.max(1, rows);
  const radiusX = hexWidth / Math.sqrt(3);
  const radiusY = rowStep / 1.5;
  const visible = visibleCanvasRect(source, frame, viewport);
  const qStart = Math.max(0, Math.floor((visible.xMin - hexWidth * 1.5) / hexWidth));
  const qEnd = Math.min(columns - 1, Math.ceil((visible.xMax + hexWidth * 1.5) / hexWidth));
  const rStart = Math.max(0, Math.floor((visible.yMin - rowStep * 1.5) / rowStep));
  const rEnd = Math.min(rows - 1, Math.ceil((visible.yMax + rowStep * 1.5) / rowStep));
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 249, 225, 0.54)';
  ctx.lineWidth = Math.max(0.35, 1.05 / Math.max(1, zoom));
  ctx.shadowColor = 'rgba(13, 20, 18, 0.44)';
  ctx.shadowBlur = Math.max(0, 1.2 / Math.max(1, zoom));
  ctx.beginPath();
  for (let r = rStart; r <= rEnd; r += 1) {
    const rowOffset = r % 2 === 1 ? hexWidth / 2 : 0;
    const cy = r * rowStep + rowStep / 2;
    for (let q = qStart; q <= qEnd; q += 1) {
      const cx = q * hexWidth + hexWidth / 2 + rowOffset;
      for (let point = 0; point < 6; point += 1) {
        const angle = ((60 * point - 90) * Math.PI) / 180;
        const x = cx + radiusX * Math.cos(angle);
        const y = cy + radiusY * Math.sin(angle);
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
  return level;
}

function constrainHexLevelToVisibleCellBudget(
  initialLevel: WorldHexOverlayLevel,
  overlayLevels: WorldHexOverlayLevel[],
  source: HTMLCanvasElement,
  frame: HTMLElement,
  viewport: Element | null | undefined
): WorldHexOverlayLevel | null {
  const visible = visibleCanvasRect(source, frame, viewport);
  let level = initialLevel;
  for (;;) {
    const hexWidth = source.width / Math.max(1, level.dimensions.columns);
    const rowStep = source.height / Math.max(1, level.dimensions.rows);
    const visibleColumns = Math.max(1, Math.ceil((visible.xMax - visible.xMin) / Math.max(0.0001, hexWidth)) + 4);
    const visibleRows = Math.max(1, Math.ceil((visible.yMax - visible.yMin) / Math.max(0.0001, rowStep)) + 4);
    if (visibleColumns * visibleRows <= 12000) return level;
    if (!level.parentLevelId) return null;
    const parent = overlayLevels.find((candidate) => candidate.id === level.parentLevelId);
    if (!parent) return level;
    level = parent;
  }
}

function visibleCanvasRect(source: HTMLCanvasElement, frame: HTMLElement, viewport: Element | null | undefined) {
  if (!viewport || !(viewport instanceof HTMLElement) || frame.clientWidth <= 0 || frame.clientHeight <= 0) {
    return { xMin: 0, xMax: source.width, yMin: 0, yMax: source.height };
  }
  const cssXMin = Math.max(0, viewport.scrollLeft - frame.offsetLeft);
  const cssYMin = Math.max(0, viewport.scrollTop - frame.offsetTop);
  const cssXMax = Math.max(cssXMin, Math.min(frame.clientWidth, cssXMin + viewport.clientWidth));
  const cssYMax = Math.max(cssYMin, Math.min(frame.clientHeight, cssYMin + viewport.clientHeight));
  const scaleX = source.width / Math.max(1, frame.clientWidth);
  const scaleY = source.height / Math.max(1, frame.clientHeight);
  return {
    xMin: Math.max(0, cssXMin * scaleX),
    xMax: Math.min(source.width, cssXMax * scaleX),
    yMin: Math.max(0, cssYMin * scaleY),
    yMax: Math.min(source.height, cssYMax * scaleY)
  };
}

function hexInspectionForPoint(level: WorldHexOverlayLevel, x: number, y: number, width: number, height: number): HexInspectionTarget {
  const hexWidth = width / Math.max(1, level.dimensions.columns);
  const rowStep = height / Math.max(1, level.dimensions.rows);
  const r = Math.max(0, Math.min(level.dimensions.rows - 1, Math.floor(y / Math.max(0.0001, rowStep))));
  const rowOffset = r % 2 === 1 ? hexWidth / 2 : 0;
  const q = Math.max(0, Math.min(level.dimensions.columns - 1, Math.floor((x - rowOffset) / Math.max(0.0001, hexWidth))));
  const centerX = q * hexWidth + hexWidth / 2 + rowOffset;
  const centerY = r * rowStep + rowStep / 2;
  return {
    levelId: level.id,
    label: level.label,
    nominalHexWidthMiles: level.nominalHexWidthMiles,
    q,
    r,
    x: centerX,
    y: centerY,
    width,
    height
  };
}

function MapInspectionMarker({ record }: { record: PointInspectionRecord }) {
  const left = `${((record.equirectangular.x + 0.5) / Math.max(1, record.equirectangular.width)) * 100}%`;
  const top = `${((record.equirectangular.y + 0.5) / Math.max(1, record.equirectangular.height)) * 100}%`;
  return (
    <div
      className="inspection-map-marker"
      style={{ left, top }}
      aria-hidden="true"
    />
  );
}

function HexInspectionMarker({ target }: { target: HexInspectionTarget }) {
  const left = `${(target.x / Math.max(1, target.width)) * 100}%`;
  const top = `${(target.y / Math.max(1, target.height)) * 100}%`;
  return (
    <div
      className="hex-inspection-marker"
      style={{ left, top }}
      aria-label={`${target.label} q ${target.q} r ${target.r}`}
      title={`${target.label} (${target.nominalHexWidthMiles} mi): q${target.q}, r${target.r}`}
    >
      <span>{target.nominalHexWidthMiles} mi</span>
      <strong>q{target.q} r{target.r}</strong>
    </div>
  );
}

function HighestPointMapMarker({ target }: { target: HighestPointTarget }) {
  const left = `${((target.x + 0.5) / Math.max(1, target.width)) * 100}%`;
  const top = `${((target.y + 0.5) / Math.max(1, target.height)) * 100}%`;
  return <div className="highest-point-map-marker" style={{ left, top }} aria-label="Highest point" title="Highest point" />;
}

function centerMapOnTarget(target: HighestPointTarget, canvas: HTMLCanvasElement | null) {
  const frame = canvas?.parentElement;
  const viewport = frame?.parentElement;
  if (!frame || !viewport) return;
  window.requestAnimationFrame(() => {
    const targetX = ((target.x + 0.5) / Math.max(1, target.width)) * frame.clientWidth;
    const targetY = ((target.y + 0.5) / Math.max(1, target.height)) * frame.clientHeight;
    viewport.scrollLeft = Math.max(0, targetX - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, targetY - viewport.clientHeight / 2);
  });
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





function BiomeLegend({ theme }: { theme: MapTheme }) {
  const waterEntries = [
    ['deep ocean', theme.colors.oceanDeep],
    ['ocean', theme.colors.ocean],
    ['shallow shelf', theme.colors.shelf]
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
          <i style={{ background: biomeLegendColor(theme, biome) }} />
          {biome.replace('_', ' ')}
        </span>
      ))}
    </div>
  );
}

function contentLibraryTheme(library: ContentLibraryConfig): MapTheme {
  const colors = { ...cleanGameMapTheme.colors };
  const biomeConfig = library.biomes;
  const defaultSet = biomeConfig.sets.find((set) => set.id === biomeConfig.defaultSetId) ?? biomeConfig.sets.find((set) => set.isDefault);
  const allowedMembers = new Set(defaultSet?.memberIds ?? biomeConfig.members.map((member) => member.id));
  for (const member of biomeConfig.members) {
    if (!allowedMembers.has(member.id)) continue;
    const color = member.assets.find((asset) => asset.kind === 'preview-color')?.value;
    if (!isHexColor(color)) continue;
    const key = member.id.replace(/-/g, '_');
    colors[key] = color;
    if (member.id === 'ice-cap') colors.ice = color;
    if (member.id === 'ocean') colors.ocean = color;
  }
  return {
    ...cleanGameMapTheme,
    name: `${cleanGameMapTheme.name} / ${defaultSet?.label ?? biomeConfig.label}`,
    colors
  };
}

function isHexColor(value?: string): value is string {
  return Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
}

function generationConfigWithContentRules(config: GenerationConfig, library: ContentLibraryConfig): GenerationConfig {
  return {
    ...config,
    biomeRules: biomeRulesFromContentLibrary(library)
  };
}

function biomeRulesFromContentLibrary(library: ContentLibraryConfig): BiomeClassificationRule[] {
  const biomeConfig = library.biomes;
  const defaultSet = biomeConfig.sets.find((set) => set.id === biomeConfig.defaultSetId) ?? biomeConfig.sets.find((set) => set.isDefault);
  const memberIds = defaultSet?.memberIds.length ? defaultSet.memberIds : biomeConfig.members.map((member) => member.id);
  const memberById = new Map(biomeConfig.members.map((member) => [member.id, member]));
  const rules: BiomeClassificationRule[] = [];
  for (const memberId of memberIds) {
    const member = memberById.get(memberId);
    const biome = biomeFromContentMemberId(memberId);
    if (!member || !biome) continue;
    if (member.rules.length) rules.push({ biome, rules: member.rules, note: `Configured by ${member.label}` });
    if (biome === 'wetland') rules.unshift({ biome: 'wetland', rules: [{ field: 'lake', equals: true }, { field: 'water', equals: false }], note: 'Compatibility lake wetland rule.' });
    if (biome === 'forest') rules.push({ biome: 'forest', rules: [{ field: 'polarLatitude', max: 0.65 }, { field: 'wetness', min: 0.42 }, { field: 'water', equals: false }], note: 'Compatibility non-polar moderate forest rule.' });
    if (biome === 'grassland') rules.push({ biome: 'grassland', rules: [], note: 'Configured fallback land biome.' });
  }
  return rules.some((rule) => rule.biome === 'grassland' && rule.rules.length === 0) ? rules : [...rules, { biome: 'grassland', rules: [], note: 'Fallback land biome.' }];
}

function biomeFromContentMemberId(memberId: string): Biome | null {
  const neutralBiomeMap: Record<string, Biome> = {
    'open-ocean': 'ocean',
    'coastal-marine': 'ocean',
    'inland-saltwater': 'wetland',
    'freshwater-lake': 'wetland',
    riverine: 'wetland',
    wetland: 'wetland',
    'ice-cap': 'ice_cap',
    tundra: 'tundra',
    taiga: 'forest',
    'temperate-forest': 'forest',
    'temperate-rainforest': 'forest',
    'tropical-rainforest': 'rainforest',
    'tropical-seasonal-forest': 'rainforest',
    grassland: 'grassland',
    steppe: 'grassland',
    savanna: 'grassland',
    desert: 'desert',
    'semi-arid-scrub': 'grassland',
    alpine: 'tundra'
  };
  if (neutralBiomeMap[memberId]) return neutralBiomeMap[memberId];
  const normalized = memberId.replace(/-/g, '_');
  return (biomeNames as string[]).includes(normalized) ? normalized as Biome : null;
}

function biomeLegendColor(theme: MapTheme, biome: string): string {
  if (biome === 'ice_cap') return theme.colors.ice ?? cleanGameMapTheme.colors.ice;
  return theme.colors[biome] ?? theme.colors.grassland ?? cleanGameMapTheme.colors.grassland;
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
