import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, FileJson, FolderOpen, Image, Layers, RefreshCw, Save, Shuffle } from 'lucide-react';
import { createDefaultConfig, defaultParameterRanges, generateProject } from '@world-forge/generator-core';
import { exportSvg, exportWforge, importWforge, projectToJson } from '@world-forge/exporters';
import { cleanGameMapTheme, renderWorldToCanvas } from '@world-forge/renderer';
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
  moonCount: 'Moons'
};

const resolutionOptions = [
  { label: 'Fast 256 x 128', width: 256, height: 128 },
  { label: 'Default 512 x 256', width: 512, height: 256 },
  { label: 'Large 1024 x 512', width: 1024, height: 512 }
];

function App() {
  const [config, setConfig] = useState<GenerationConfig>(() => createDefaultConfig('earthlike-default-001'));
  const [project, setProject] = useState<WorldProject>(() => generateProject(createDefaultConfig('earthlike-default-001')));
  const [showPlates, setShowPlates] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [showHeightmap, setShowHeightmap] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderWorldToCanvas(canvasRef.current, project, cleanGameMapTheme, { rivers: showRivers, plates: showPlates, heightmap: showHeightmap });
  }, [project, showHeightmap, showPlates, showRivers]);

  const invalidRanges = useMemo(() => {
    return Object.entries(config.parameterRanges)
      .filter(([, range]) => range.min > range.max)
      .map(([key]) => rangeLabels[key as RangeKey]);
  }, [config.parameterRanges]);

  const generate = (nextConfig = config) => {
    if (invalidRanges.length > 0) return;
    setProject(generateProject(nextConfig));
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

  const randomizeSeed = () => {
    const seed = `world-${Math.random().toString(36).slice(2, 10)}`;
    const next = { ...config, seed };
    setConfig(next);
    generate(next);
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    <main className="app-shell">
      <section className="toolbar" aria-label="World generation controls">
        <div className="brand">
          <strong>World Forge</strong>
          <span>Seeded map generator</span>
        </div>
        <div className="seed-row">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            value={config.seed}
            onChange={(event) => setConfig({ ...config, seed: event.target.value })}
          />
          <button type="button" title="Randomize seed" onClick={randomizeSeed}>
            <Shuffle size={16} />
          </button>
          <button type="button" title="Generate world" disabled={invalidRanges.length > 0} onClick={() => generate()}>
            <RefreshCw size={16} />
            Generate
          </button>
        </div>
        <div className="resolution-row">
          <label htmlFor="resolution">Resolution</label>
          <select
            id="resolution"
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
        {invalidRanges.length > 0 && <div className="validation">Invalid ranges: {invalidRanges.join(', ')}</div>}
        <div className="range-grid">
          {(Object.keys(config.parameterRanges) as RangeKey[]).map((key) => (
            <RangeControl
              key={key}
              label={rangeLabels[key]}
              range={config.parameterRanges[key]}
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
            <label><input type="checkbox" checked={showHeightmap} onChange={(event) => setShowHeightmap(event.target.checked)} /> Heightmap</label>
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
        <Metric label="Land" value={`${project.metrics.landPercentage}%`} />
        <Metric label="Ice" value={`${project.metrics.icePercentage}%`} />
        <Metric label="Rivers" value={String(project.metrics.riverCount)} status={project.metrics.validation.riverPathsValid ? 'ok' : 'warn'} />
        <Metric label="Lake cells" value={String(project.metrics.lakeCellCount)} />
        <Metric label="Map scale" value={`${project.primaryWorld.mapModel.resolution.width} x ${project.primaryWorld.mapModel.resolution.height}`} />
        <Metric label="Planet size" value={`${project.primaryWorld.sizeClass} Earth radii`} />
        <Metric label="Tide influence" value={String(project.primaryWorld.tideInfluence)} />
        <Metric label="Axial tilt" value={`${project.primaryWorld.axialTiltDeg} deg`} />
        <Metric label="Eccentricity" value={String(project.primaryWorld.orbitalEccentricity)} />
        <div className="system">
          <h3>System</h3>
          <p>{project.solarSystem.star.type}, {project.solarSystem.ageGy} Gy</p>
          <p>{project.solarSystem.bodies.length} major bodies, {project.primaryWorld.tideInfluence > 0 ? 'moon-influenced tides' : 'no major moon tide'}</p>
        </div>
        <div className="biomes">
          <h3>Biomes</h3>
          {Object.entries(project.metrics.biomeCounts).map(([biome, count]) => (
            <span key={biome}>{biome.replace('_', ' ')}: {count}</span>
          ))}
        </div>
      </aside>
    </main>
  );
}

function RangeControl({
  label,
  range,
  onMin,
  onMax
}: {
  label: string;
  range: NumericRange;
  onMin: (value: number) => void;
  onMax: (value: number) => void;
}) {
  return (
    <div className="range-control">
      <span>{label}</span>
      <input aria-label={`${label} minimum`} type="number" value={range.min} step="0.01" onChange={(event) => onMin(Number(event.target.value))} />
      <input aria-label={`${label} maximum`} type="number" value={range.max} step="0.01" onChange={(event) => onMax(Number(event.target.value))} />
      <small>{range.unit ?? ''}</small>
    </div>
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

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename.replace(/[^a-z0-9._-]+/gi, '-');
  link.click();
  URL.revokeObjectURL(href);
}

createRoot(document.getElementById('root')!).render(<App />);
