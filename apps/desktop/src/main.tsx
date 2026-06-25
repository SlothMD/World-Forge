import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, FileJson, FolderOpen, Image, Layers, RefreshCw, Save, Shuffle } from 'lucide-react';
import { createDefaultConfig, defaultParameterRanges, generateProject } from '@world-forge/generator-core';
import { exportSvg, exportWforge, importWforge, projectToJson } from '@world-forge/exporters';
import { MapMode, cleanGameMapTheme, renderWorldToCanvas } from '@world-forge/renderer';
import { GenerationConfig, NumericRange, ParameterRanges, WorldProject } from '@world-forge/shared';
import './styles.css';

type RangeKey = keyof ParameterRanges;

const rangeLabels: Record<RangeKey, string> = {
  systemAgeGy: 'System age',
  oceanPercentage: 'Ocean',
  averageTemperatureC: 'Temperature',
  aridity: 'Aridity',
  seaLevel: 'Sea level',
  axialTiltDeg: 'Axial tilt',
  orbitalEccentricity: 'Eccentricity',
  sizeClass: 'Size',
  moonCount: 'Moons',
  impactFrequency: 'Impacts'
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

function App() {
  const [config, setConfig] = useState<GenerationConfig>(() => createDefaultConfig(defaultSeed));
  const [project, setProject] = useState<WorldProject>(() => generateProject(createDefaultConfig(defaultSeed)));
  const [previewResolution, setPreviewResolution] = useState(previewResolutionOptions[1]);
  const [exportResolution, setExportResolution] = useState(resolutionOptions[1]);
  const [showPlates, setShowPlates] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>('biomes');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderWorldToCanvas(canvasRef.current, project, cleanGameMapTheme, {
      rivers: showRivers,
      plates: showPlates,
      heightmap: mapMode === 'elevation',
      mode: mapMode,
      targetResolution: previewResolution.width > 0 ? previewResolution : undefined
    });
  }, [mapMode, previewResolution, project, showPlates, showRivers]);

  const invalidRanges = useMemo(() => {
    return Object.entries(config.parameterRanges)
      .filter(([, range]) => range.min > range.max)
      .map(([key]) => rangeLabels[key as RangeKey]);
  }, [config.parameterRanges]);

  const generate = (nextConfig = config) => {
    if (invalidRanges.length > 0) return;
    setIsGenerating(true);
    window.setTimeout(() => {
      setProject(generateProject(nextConfig));
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

  const randomizeSeed = () => {
    const seed = String(Math.floor(1000000 + Math.random() * 9000000));
    const next = { ...config, seed };
    setConfig(next);
    generate(next);
  };

  const downloadPng = () => {
    const canvas = document.createElement('canvas');
    renderWorldToCanvas(canvas, project, cleanGameMapTheme, {
      rivers: showRivers,
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
    downloadBlob(new Blob([projectToJson(project)], { type: 'application/json' }), `${project.projectName}.json`);
  };

  const downloadSvg = () => {
    downloadBlob(new Blob([exportSvg(project)], { type: 'image/svg+xml' }), `${project.projectName}.svg`);
  };

  const downloadPackage = async () => {
    downloadBlob(await exportWforge(project), `${project.projectName}.wforge`);
  };

  const openPackage = async (file?: File) => {
    if (!file) return;
    const parsed = await importWforge(file);
    setProject(parsed);
    setConfig(parsed.config);
  };

  return (
    <main className="app-shell" aria-busy={isGenerating}>
      <section className="toolbar" aria-label="World generation controls">
        <div className="brand">
          <strong>World Forge</strong>
          <span>Seeded map generator</span>
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
              bounds={defaultParameterRanges[key]}
              onMin={(value) => updateRange(key, 'min', value)}
              onMax={(value) => updateRange(key, 'max', value)}
            />
          ))}
        </div>
      </section>

      <section className="map-pane" aria-label="Generated world map">
        <div className="map-actions">
          <div className="layer-toggles">
            <label><input type="checkbox" checked={showRivers} onChange={(event) => setShowRivers(event.target.checked)} /> Rivers</label>
            <label><input type="checkbox" checked={showPlates} onChange={(event) => setShowPlates(event.target.checked)} /> Plates</label>
            <label htmlFor="map-mode">Filter</label>
            <select id="map-mode" value={mapMode} onChange={(event) => setMapMode(event.target.value as MapMode)}>
              <option value="biomes">Biomes</option>
              <option value="elevation">Elevation</option>
              <option value="temperature">Temperature</option>
              <option value="rainfall">Rainfall</option>
              <option value="wind">Wind</option>
              <option value="current">Current</option>
            </select>
          </div>
          <div className="download-actions">
            <button type="button" onClick={downloadPng} title="Export PNG"><Image size={16} />PNG</button>
            <button type="button" onClick={downloadSvg} title="Export simplified SVG"><Layers size={16} />SVG</button>
            <button type="button" onClick={downloadJson} title="Export JSON"><FileJson size={16} />JSON</button>
            <button type="button" onClick={downloadPackage} title="Save .wforge package"><Save size={16} />.wforge</button>
            <label className="file-button" title="Open .wforge package">
              <FolderOpen size={16} />Open
              <input type="file" accept=".wforge" onChange={(event) => openPackage(event.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="canvas-wrap">
          <canvas ref={canvasRef} aria-label={`Generated map for ${project.projectName}`} />
        </div>
      </section>

      <aside className="summary" aria-label="World summary">
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
      </aside>
      {isGenerating && <div className="generating-overlay">Generating world</div>}
    </main>
  );
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
  const step = bounds.unit === '%' || bounds.unit === 'deg' || label === 'Moons' ? 1 : 0.01;
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  return (
    <div className="range-control">
      <span>{label}</span>
      <div className="dual-slider">
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

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename.replace(/[^a-z0-9._-]+/gi, '-');
  link.click();
  URL.revokeObjectURL(href);
}

createRoot(document.getElementById('root')!).render(<App />);
