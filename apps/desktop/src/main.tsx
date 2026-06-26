import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileJson, FolderOpen, Hexagon, Image, Layers, RefreshCw, Save, Settings, Shuffle, X } from 'lucide-react';
import * as THREE from 'three';
import { createDefaultConfig, generateProject } from '@world-forge/generator-core';
import { exportHexGridSvg, exportHexTileMapJson, exportSvg, exportWforge, importWforge, projectToJson } from '@world-forge/exporters';
import { MapMode, cleanGameMapTheme, renderWorldToCanvas } from '@world-forge/renderer';
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
import './styles.css';

type RangeKey = keyof ParameterRanges;
type ViewMode = 'map' | 'globe';
type RightPanelTab = 'world' | 'hex';
type ConfigTab = ContentCategory;

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
  river: 'Rivers',
  snow: 'Snow',
  ice: 'Ice',
  aquatic: 'Aquatic'
};

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
  const [config, setConfig] = useState<GenerationConfig>(() => defaultHighConfig());
  const [project, setProject] = useState<WorldProject | null>(null);
  const [contentLibrary, setContentLibrary] = useState<ContentLibraryConfig>(() => structuredClone(defaultContentLibrary));
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('biomes');
  const [previewResolution, setPreviewResolution] = useState(previewResolutionOptions[1]);
  const [exportResolution, setExportResolution] = useState(resolutionOptions[1]);
  const [tilePresetId, setTilePresetId] = useState(defaultHexPreset.id);
  const [tileWidth, setTileWidth] = useState(defaultHexPreset.width);
  const [tileHeight, setTileHeight] = useState(defaultHexPreset.height);
  const [tileFeatures, setTileFeatures] = useState<HexTileFeature[]>(civ7StyleHexTileProfile.features);
  const [showPlates, setShowPlates] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>('biomes');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('world');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const generationEstimateRef = useRef(24000);
  const generationStartedAtRef = useRef(0);
  const generationTaskIdRef = useRef('');
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./generationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: 'complete' | 'error'; id: string; project?: WorldProject; message?: string }>) => {
      if (event.data.id !== generationTaskIdRef.current) return;
      if (event.data.type === 'complete' && event.data.project) {
        setProject(event.data.project);
        generationEstimateRef.current = Math.max(3000, event.data.project.diagnostics?.totalMs ?? generationEstimateRef.current);
      } else if (event.data.type === 'error') {
        console.error(event.data.message ?? 'Generation failed');
      }
      setGenerationProgress(1);
      setIsGenerating(false);
    };
    worker.onerror = (event) => {
      console.error(event.message);
      setIsGenerating(false);
    };
    return () => {
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
      mode: mapMode,
      targetResolution: previewResolution.width > 0 ? previewResolution : undefined
    });
  }, [mapMode, previewResolution, project, showPlates, showRivers, viewMode]);

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

  const downloadPng = () => {
    if (!project) return;
    const canvas = document.createElement('canvas');
    const showRiverOverlay = showRivers && mapMode !== 'elevation' && mapMode !== 'heightmap';
    renderWorldToCanvas(canvas, project, cleanGameMapTheme, {
      rivers: showRiverOverlay,
      plates: showPlates,
      heightmap: mapMode === 'elevation',
      mode: mapMode,
      targetResolution: exportResolution
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${project.projectName}.png`);
    }, 'image/png');
  };

  const downloadJson = () => {
    if (!project) return;
    downloadBlob(new Blob([projectToJson(project)], { type: 'application/json' }), `${project.projectName}.json`);
  };

  const downloadSvg = () => {
    if (!project) return;
    downloadBlob(new Blob([exportSvg(project)], { type: 'image/svg+xml' }), `${project.projectName}.svg`);
  };

  const tileExportConfig = () => ({
    width: tileWidth,
    height: tileHeight,
    profileId: civ7StyleHexTileProfile.id,
    enabledFeatures: tileFeatures
  });

  const downloadHexGridSvg = () => {
    if (!project) return;
    downloadBlob(new Blob([exportHexGridSvg(project, tileExportConfig())], { type: 'image/svg+xml' }), `${project.projectName}-hex-grid.svg`);
  };

  const downloadHexTileJson = () => {
    if (!project) return;
    downloadBlob(new Blob([exportHexTileMapJson(project, tileExportConfig())], { type: 'application/json' }), `${project.projectName}-hex-tiles.json`);
  };

  const downloadPackage = async () => {
    if (!project) return;
    downloadBlob(await exportWforge(project), `${project.projectName}.wforge`);
  };

  const openPackage = async (file?: File) => {
    if (!file) return;
    const parsed = await importWforge(file);
    setProject(parsed);
    setConfig(parsed.config);
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

  return (
    <main className="app-shell" aria-busy={isGenerating}>
      <section className="toolbar" aria-label="World generation controls">
        <div className="brand">
          <strong>World Forge</strong>
          <span>Seeded map generator</span>
          <button type="button" title="Configure content sets" className="icon-button" onClick={() => setConfigOpen(true)}>
            <Settings size={16} />
          </button>
        </div>
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
      </section>

      <section className="map-pane" aria-label="Generated world map">
        <div className="map-actions">
          <div className="layer-toggles">
            <label><input type="radio" name="view-mode" checked={viewMode === 'map'} onChange={() => setViewMode('map')} /> Map</label>
            <label><input type="radio" name="view-mode" checked={viewMode === 'globe'} onChange={() => setViewMode('globe')} /> Globe</label>
            <label><input type="checkbox" checked={showRivers} onChange={(event) => setShowRivers(event.target.checked)} /> Rivers</label>
            <label><input type="checkbox" checked={showPlates} onChange={(event) => setShowPlates(event.target.checked)} /> Plates</label>
            <label htmlFor="map-mode">Filter</label>
            <select id="map-mode" value={mapMode} onChange={(event) => setMapMode(event.target.value as MapMode)}>
              <option value="biomes">Biomes</option>
              <option value="elevation">Elevation</option>
              <option value="heightmap">Heightmap</option>
              <option value="temperature">Temperature</option>
              <option value="rainfall">Rainfall</option>
              <option value="wind">Wind</option>
              <option value="current">Current</option>
            </select>
          </div>
          <div className="download-actions">
            <button type="button" onClick={downloadPng} disabled={!project} title="Export PNG"><Image size={16} />PNG</button>
            <button type="button" onClick={downloadSvg} disabled={!project} title="Export simplified SVG"><Layers size={16} />SVG</button>
            <button type="button" onClick={downloadJson} disabled={!project} title="Export JSON"><FileJson size={16} />JSON</button>
            <button type="button" onClick={downloadPackage} disabled={!project} title="Save .wforge package"><Save size={16} />.wforge</button>
            <label className="file-button" title="Open .wforge package">
              <FolderOpen size={16} />Open
              <input type="file" accept=".wforge" onChange={(event) => openPackage(event.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="canvas-wrap">
          {isGenerating && (
            <div className="generation-progress" role="status" aria-live="polite">
              <span>Generating world</span>
              <progress value={generationProgress} max={1} />
              <output>{Math.round(generationProgress * 100)}%</output>
            </div>
          )}
          {!project ? (
            <div className="empty-map">
              <strong>No world generated</strong>
              <span>Adjust settings, then generate or open a .wforge package.</span>
            </div>
          ) : viewMode === 'map' ? (
            <canvas ref={canvasRef} aria-label={`Generated map for ${project.projectName}`} />
          ) : (
            <GlobeViewer project={project} mapMode={mapMode} showRivers={showRivers} showPlates={showPlates} />
          )}
        </div>
        {project && mapMode === 'biomes' && viewMode === 'map' && <BiomeLegend />}
      </section>

      <aside className="summary" aria-label="World details and exports">
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
              <button type="button" onClick={downloadHexGridSvg} disabled={!project} title="Export hex grid SVG"><Layers size={16} />Hex SVG</button>
              <button type="button" onClick={downloadHexTileJson} disabled={!project} title="Export terrain tile JSON"><FileJson size={16} />Tile JSON</button>
            </div>
            <div className="system">
              <h3>Profile</h3>
              <p>{civ7StyleHexTileProfile.label}</p>
              <p>{project ? `${tileWidth} x ${tileHeight} pointy-top odd-row hexes sampled from generated topology facts.` : 'Generate or open a world before exporting tiles.'}</p>
            </div>
          </div>
        )}
      </aside>
      {configOpen && (
        <ContentConfigModal
          library={contentLibrary}
          activeTab={configTab}
          onTab={setConfigTab}
          onClose={() => setConfigOpen(false)}
          onChange={setContentLibrary}
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
  onChange
}: {
  library: ContentLibraryConfig;
  activeTab: ConfigTab;
  onTab: (tab: ConfigTab) => void;
  onClose: () => void;
  onChange: (library: ContentLibraryConfig) => void;
}) {
  const category = library[activeTab];
  const [selectedSetId, setSelectedSetId] = useState(category.defaultSetId);
  const selectedSet = category.sets.find((set) => set.id === selectedSetId) ?? category.sets[0];
  const visibleMembers = category.members.filter((member) => selectedSet?.memberIds.includes(member.id));
  const [selectedMemberId, setSelectedMemberId] = useState(visibleMembers[0]?.id ?? category.members[0]?.id ?? '');
  const selectedMember = category.members.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? category.members[0];

  useEffect(() => {
    setSelectedSetId(library[activeTab].defaultSetId);
  }, [activeTab, library]);

  useEffect(() => {
    const nextCategory = library[activeTab];
    const nextSet = nextCategory.sets.find((set) => set.id === selectedSetId) ?? nextCategory.sets[0];
    const nextMember = nextCategory.members.find((member) => nextSet?.memberIds.includes(member.id));
    if (nextMember) setSelectedMemberId(nextMember.id);
  }, [activeTab, library, selectedSetId]);

  const updateCategory = (updater: (category: ContentCategoryConfig) => ContentCategoryConfig) => {
    onChange({ ...library, [activeTab]: updater(library[activeTab]) });
  };

  const markDefaultSet = (setId: string) => {
    updateCategory((current) => ({
      ...current,
      defaultSetId: setId,
      sets: current.sets.map((set) => ({ ...set, isDefault: set.id === setId }))
    }));
  };

  const addSet = () => {
    const baseId = `${activeTab}-set-${category.sets.length + 1}`;
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
        <div className="config-tabs" role="tablist" aria-label="Content categories">
          {(Object.keys(library) as ConfigTab[]).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => onTab(tab)}>
              {library[tab].label}
            </button>
          ))}
        </div>
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
  link.click();
  URL.revokeObjectURL(href);
}

createRoot(document.getElementById('root')!).render(<App />);
