import React from 'react';
import { Download, FileChartColumn, FileJson, Globe2, Hexagon, Image, Layers, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { HexTileFeature, WorldProject, civ7StyleHexTileProfile, hexTileMapPresets } from '@world-forge/shared';
import { ShellStatusControls } from '../shell/ShellStatusControls';

type RightPanelTab = 'world' | 'hex' | 'diagnostics';

type ResolutionOption = { label: string; width: number; height: number };
type ExportTaskState = { status: 'idle' | 'running' | 'complete' | 'error'; progress: number; message: string };

type RightPanelProps = {
  collapsed: boolean;
  activeTab: RightPanelTab;
  feedbackStatus: string;
  inspectorContent: React.ReactNode;
  diagnosticsContent: React.ReactNode;
  project: WorldProject | null;
  exportResolution: ResolutionOption;
  tilePresetId: string;
  tileWidth: number;
  tileHeight: number;
  tileFeatures: HexTileFeature[];
  tileFeatureLabels: Record<HexTileFeature, string>;
  tileHexScaleMiles: number | null;
  vttResolution: ResolutionOption;
  resolutionOptions: ResolutionOption[];
  vttGridEnabled: boolean;
  vttHexSizeMilesInput: string;
  vttHexMetrics: { columns: number; rows: number } | null;
  hexSvgTask: ExportTaskState;
  tileJsonTask: ExportTaskState;
  vttTask: ExportTaskState;
  onCollapsedChange: (collapsed: boolean) => void;
  onTabChange: (tab: RightPanelTab) => void;
  onFeedback: () => void;
  onTilePresetChange: (presetId: string) => void;
  onTileWidthChange: (width: number) => void;
  onTileHeightChange: (height: number) => void;
  onTileFeatureChange: (feature: HexTileFeature, enabled: boolean) => void;
  onVttResolutionChange: (resolution: ResolutionOption) => void;
  onVttGridEnabledChange: (enabled: boolean) => void;
  onVttHexSizeInputChange: (value: string) => void;
  onCommitVttHexSize: () => void;
  renderExportButton: (props: { icon: React.ReactNode; label: string; task: ExportTaskState; disabled: boolean; title: string; onClick: () => void }) => React.ReactNode;
  onDownloadHexGridSvg: () => void;
  onDownloadHexTileJson: () => void;
  onDownloadVttPackage: () => void;
};

function Metric({ label, value, status }: { label: string; value: string; status?: 'ok' | 'warn' }) {
  return <div className={`metric ${status ?? ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function formatElapsedMinutesSeconds(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RightPanel(props: RightPanelProps) {
  const {
    collapsed, activeTab, feedbackStatus, inspectorContent, diagnosticsContent, project, exportResolution,
    tilePresetId, tileWidth, tileHeight, tileFeatures, tileFeatureLabels, tileHexScaleMiles, vttResolution,
    resolutionOptions, vttGridEnabled, vttHexSizeMilesInput, vttHexMetrics, hexSvgTask, tileJsonTask, vttTask,
    onCollapsedChange, onTabChange, onFeedback, onTilePresetChange, onTileWidthChange, onTileHeightChange,
    onTileFeatureChange, onVttResolutionChange, onVttGridEnabledChange, onVttHexSizeInputChange,
    onCommitVttHexSize, renderExportButton, onDownloadHexGridSvg, onDownloadHexTileJson, onDownloadVttPackage
  } = props;

  return (
    <>
      <ShellStatusControls onFeedback={onFeedback} />
      <aside className={`summary ${collapsed ? 'panel-collapsed' : ''}`} aria-label="World details and exports">
        <button type="button" title={collapsed ? 'Expand details panel' : 'Collapse details panel'} aria-label={collapsed ? 'Expand details panel' : 'Collapse details panel'} className="icon-button panel-toggle right-panel-boundary-toggle" onClick={() => onCollapsedChange(!collapsed)}>
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>

        {feedbackStatus && !collapsed && <div className="feedback-status" role="status">{feedbackStatus}</div>}
        {!collapsed && inspectorContent}

        {collapsed ? <div className="collapsed-panel-label">Details</div> : <>
          <div className="summary-tabs" role="tablist" aria-label="Right panel">
            <button type="button" role="tab" title="World summary" aria-label="World summary" aria-selected={activeTab === 'world'} className={activeTab === 'world' ? 'active' : ''} onClick={() => onTabChange('world')}><Globe2 size={16} /></button>
            <button type="button" role="tab" title="Hex tile and VTT exports" aria-label="Hex tile and VTT exports" aria-selected={activeTab === 'hex'} className={activeTab === 'hex' ? 'active' : ''} onClick={() => onTabChange('hex')}><Hexagon size={16} /></button>
            <button type="button" role="tab" title="Diagnostics report" aria-label="Diagnostics report" aria-selected={activeTab === 'diagnostics'} className={activeTab === 'diagnostics' ? 'active' : ''} onClick={() => onTabChange('diagnostics')}><FileChartColumn size={16} /></button>
          </div>

          {activeTab === 'world' ? <div role="tabpanel" aria-label="World">
            {!project ? <div className="empty-panel"><h2>World</h2><p>No generated world is loaded.</p></div> : <>
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
              <div className="system"><h3>System</h3><p>{project.solarSystem.star.type}, {project.solarSystem.ageGy} Gy</p><p>{project.solarSystem.bodies.length} major bodies, {project.primaryWorld.tideInfluence > 0 ? 'moon-influenced tides' : 'no major moon tide'}</p></div>
              <div className="system"><h3>Moons</h3>{project.solarSystem.bodies.find((body) => body.isPrimaryWorld)?.moons.length ? project.solarSystem.bodies.find((body) => body.isPrimaryWorld)?.moons.map((moon) => <p key={moon.id}>{moon.name}: size {moon.sizeClass}, orbit {moon.orbitalDistanceClass}, tide {moon.tideInfluence}</p>) : <p>No major moons</p>}</div>
              <div className="biomes"><h3>Biomes</h3>{Object.entries(project.metrics.biomeCounts).filter(([biome]) => biome !== 'mountain').map(([biome, count]) => <span key={biome}>{biome.replace('_', ' ')}: {count}</span>)}</div>
              {project.diagnostics && <div className="biomes"><h3>Slow Phases ({formatElapsedMinutesSeconds(project.diagnostics.totalMs)})</h3>{project.diagnostics.phases.filter((phase) => !phase.name.includes('primary-world')).sort((a, b) => b.ms - a.ms).slice(0, 5).map((phase) => <span key={phase.name}>{phase.name}: {Math.round(phase.ms)} ms</span>)}</div>}
            </>}
          </div> : activeTab === 'hex' ? <div className="tile-export-panel" role="tabpanel" aria-label="Hex tile export">
            <div className="tile-export-title"><Hexagon size={16} /><strong>Hex tile export</strong></div>
            <label htmlFor="tile-size-preset">Tile size<select id="tile-size-preset" value={tilePresetId} onChange={(event) => onTilePresetChange(event.target.value)}>{hexTileMapPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}<option value="custom">Custom</option></select></label>
            <div className="tile-dimensions"><label htmlFor="tile-width">Width<input id="tile-width" min="8" max="240" type="number" value={tileWidth} onChange={(event) => onTileWidthChange(Math.max(1, Number(event.target.value)))} /></label><label htmlFor="tile-height">Height<input id="tile-height" min="6" max="160" type="number" value={tileHeight} onChange={(event) => onTileHeightChange(Math.max(1, Number(event.target.value)))} /></label></div>
            <div className="tile-feature-row" aria-label="Tile feature classes">{civ7StyleHexTileProfile.features.map((feature) => <label key={feature}><input type="checkbox" checked={tileFeatures.includes(feature)} onChange={(event) => onTileFeatureChange(feature, event.target.checked)} />{tileFeatureLabels[feature]}</label>)}</div>
            <div className="tile-export-actions">{renderExportButton({ icon: <Layers size={16} />, label: 'Hex SVG', task: hexSvgTask, disabled: !project, title: 'Export hex grid SVG', onClick: onDownloadHexGridSvg })}{renderExportButton({ icon: <FileJson size={16} />, label: 'Tile JSON', task: tileJsonTask, disabled: !project, title: 'Export terrain tile JSON', onClick: onDownloadHexTileJson })}</div>
            <div className="vtt-export-block"><div className="tile-export-title"><Image size={16} /><strong>VTT package</strong></div><label htmlFor="vtt-resolution">Image size<select id="vtt-resolution" value={vttResolution.label} onChange={(event) => onVttResolutionChange(resolutionOptions.find((option) => option.label === event.target.value) ?? resolutionOptions[2])}>{resolutionOptions.map((option) => <option key={option.label} value={option.label}>{option.label.replace('Fast ', '').replace('Default ', '').replace('Large ', '').replace('High ', '').replace('Ultra ', '')}</option>)}</select></label><label className="sync-toggle"><input type="checkbox" checked={vttGridEnabled} onChange={(event) => onVttGridEnabledChange(event.target.checked)} />Include hex grid overlay</label><label htmlFor="vtt-hex-size">Hex size miles<input id="vtt-hex-size" min="50" max="5000" step="50" type="number" value={vttHexSizeMilesInput} disabled={!vttGridEnabled} onBlur={onCommitVttHexSize} onChange={(event) => onVttHexSizeInputChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCommitVttHexSize(); }} /></label><div className="export-readout"><span>Grid hexes</span><strong>{vttHexMetrics ? `${vttHexMetrics.columns} x ${vttHexMetrics.rows}` : 'No grid'}</strong></div><div className="tile-export-actions">{renderExportButton({ icon: <Download size={16} />, label: 'VTT ZIP', task: vttTask, disabled: !project, title: 'Export VTT-ready ZIP', onClick: onDownloadVttPackage })}</div></div>
            <div className="system"><h3>Profile</h3><p>{civ7StyleHexTileProfile.label}</p><div className="export-readout"><span>Hex scale</span><strong>{tileHexScaleMiles ? `${tileHexScaleMiles.toLocaleString()} miles` : 'Generate world'}</strong></div><p>{project ? `${tileWidth} x ${tileHeight} pointy-top odd-row hexes sampled from generated topology facts. VTT export is a neutral map package with optional hex overlay and metadata.` : 'Generate or open a world before exporting tiles or VTT packages.'}</p></div>
          </div> : diagnosticsContent}
        </>}
      </aside>
    </>
  );
}
