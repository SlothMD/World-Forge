import React from 'react';
import { Copy, X } from 'lucide-react';
import type { PointInspectionRecord } from '@world-forge/renderer';
import type { GenerationConfig, WorldProject } from '@world-forge/shared';
import type { DiagnosticChartDatum, WorldDiagnosticsSummary } from './buildWorldDiagnostics';

function roundForDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}

function diagnosticHealthClass(score: number): string {
  if (score >= 85) return 'good';
  if (score >= 65) return 'watch';
  return 'needs-work';
}

function titleCaseClimateRegime(value?: string): string {
  if (!value) return 'Marine / not applicable';
  return value.split('_').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ');
}

function donutGradient(data: DiagnosticChartDatum[]): string {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return 'conic-gradient(#d1c7b5 0deg 360deg)';
  let cursor = 0;
  const segments = data.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 360;
    return `${item.color} ${roundForDisplay(start)}deg ${roundForDisplay(cursor)}deg`;
  });
  return `conic-gradient(${segments.join(', ')})`;
}

export function DiagnosticsPanel({
  project,
  diagnostics,
  generatorConfig,
  highestPointTargetActive = false,
  onToggleHighestPoint
}: {
  project: WorldProject | null;
  diagnostics: WorldDiagnosticsSummary | null;
  generatorConfig?: GenerationConfig;
  highestPointTargetActive?: boolean;
  onToggleHighestPoint?: () => void;
}) {
  if (!project || !diagnostics) {
    return (
      <div className="empty-panel" role="tabpanel" aria-label="Diagnostics">
        <h2>Diagnostics</h2>
        <p>No generated world is loaded.</p>
      </div>
    );
  }
  const generatorMismatch = generatorConfig ? projectGeneratorMismatch(project, generatorConfig) : null;
  return (
    <div className="diagnostics-panel" role="tabpanel" aria-label="Diagnostics">
      {generatorMismatch && (
        <div className="diagnostic-project-warning">
          <strong>Project does not match generator controls</strong>
          <span>{generatorMismatch}</span>
        </div>
      )}
      <div className={`diagnostic-health ${diagnosticHealthClass(diagnostics.health.score)}`}>
        <span>World health</span>
        <strong>{diagnostics.health.label}</strong>
        <output>{diagnostics.health.score}/100</output>
      </div>
      <div className="diagnostic-chart-grid" aria-label="Diagnostic percentage charts">
        <DiagnosticDonutChart title="Biomes" data={diagnostics.charts.biomes} />
        <DiagnosticDonutChart title="Land Elevation" data={diagnostics.charts.elevation} />
        <DiagnosticDonutChart title="Surface Form" data={diagnostics.charts.terrain} />
        <DiagnosticDonutChart title="Water" data={diagnostics.charts.water} />
        <DiagnosticDonutChart title="Water Depth" data={diagnostics.charts.waterDepth} />
      </div>
      <section className="diagnostic-section">
        <h3>Generation State</h3>
        <Metric label="Seed pair" value={`${diagnostics.generation.starSeed} : ${diagnostics.generation.worldSeed}`} />
        <Metric label="Build" value={diagnostics.generation.appVersion} status={diagnostics.generation.appVersion === diagnostics.generation.currentAppVersion ? 'ok' : 'warn'} />
        <Metric label="Generated size" value={diagnostics.generation.outputResolution} />
        <Metric label="Source topology" value={String(diagnostics.generation.topologyResolution)} />
        <Metric label="World preset" value={diagnostics.generation.worldPreset} />
        {diagnostics.generation.selectedValues.map((item) => <Metric key={item.label} label={item.label} value={item.value} />)}
      </section>
      <section className="diagnostic-section">
        <h3>Hydrology</h3>
        <Metric label="Named rivers" value={String(diagnostics.hydrology.namedRivers)} status={project.metrics.validation.riverPathsValid ? 'ok' : 'warn'} />
        <Metric label="Topology river cells" value={diagnostics.hydrology.topologyRiverCells.toLocaleString()} />
        {diagnostics.hydrology.sourceCandidateCount !== undefined && <Metric label="Source candidates" value={diagnostics.hydrology.sourceCandidateCount.toLocaleString()} />}
        {diagnostics.hydrology.terrainHeadwaterCandidateShare !== undefined && <Metric label="Headwater support" value={`${roundForDisplay(diagnostics.hydrology.terrainHeadwaterCandidateShare * 100)}%`} status={diagnostics.hydrology.terrainHeadwaterCandidateShare > 0.08 ? 'ok' : 'warn'} />}
        {diagnostics.hydrology.topologyRiverCellShare !== undefined && <Metric label="River-cell share" value={`${roundForDisplay(diagnostics.hydrology.topologyRiverCellShare * 100)}%`} status={diagnostics.hydrology.topologyRiverCellShare > 0.04 ? 'ok' : 'warn'} />}
        {diagnostics.hydrology.namedRiverPathCellShare !== undefined && <Metric label="Named path share" value={`${roundForDisplay(diagnostics.hydrology.namedRiverPathCellShare * 100)}%`} />}
        {diagnostics.hydrology.shortRiverShare !== undefined && <Metric label="Short rivers" value={`${roundForDisplay(diagnostics.hydrology.shortRiverShare * 100)}%`} status={diagnostics.hydrology.shortRiverShare < 0.55 ? 'ok' : 'warn'} />}
        {diagnostics.hydrology.namedRiverCapacityUse !== undefined && <Metric label="Named river capacity" value={`${roundForDisplay(diagnostics.hydrology.namedRiverCapacityUse * 100)}%`} />}
        {diagnostics.hydrology.riverDistributionEvenness !== undefined && <Metric label="Distribution" value={`${roundForDisplay(diagnostics.hydrology.riverDistributionEvenness * 100)}%`} />}
        <Metric label="Hex river tiles" value={String(diagnostics.hydrology.riverBearingHexes)} status={diagnostics.hydrology.riverBearingHexes > 0 ? 'ok' : 'warn'} />
        <Metric label="Minor river edges" value={String(diagnostics.hydrology.minorRiverEdges)} />
        <Metric label="Navigable edges" value={String(diagnostics.hydrology.navigableRiverEdges)} />
        <div className="diagnostic-small">
          Termini: ocean {diagnostics.hydrology.riverTermini.ocean ?? 0}, lake {diagnostics.hydrology.riverTermini.lake ?? 0}, wetland {diagnostics.hydrology.riverTermini.wetland ?? 0}, basin {diagnostics.hydrology.riverTermini.basin ?? 0}
        </div>
      </section>
      <section className="diagnostic-section">
        <h3>Terrain & Elevation</h3>
        <Metric label="Relief character" value={diagnostics.geography.reliefCharacter} />
        <Metric label="Highest point band" value={diagnostics.geography.highestElevationBand} />
        <Metric label="Highest point" value={`${diagnostics.geography.highestPointLatitude}, ${diagnostics.geography.highestPointLongitude}`} />
        <button
          type="button"
          className={`subtle-button ${highestPointTargetActive ? 'active' : ''}`}
          onClick={onToggleHighestPoint}
          disabled={!onToggleHighestPoint}
        >
          {highestPointTargetActive ? 'Clear highest point' : 'Center on highest point'}
        </button>
        <Metric label="Elevated land" value={`${roundForDisplay(diagnostics.geography.elevatedLandShare * 100)}%`} />
        <Metric label="Rugged or mountainous" value={`${roundForDisplay(diagnostics.geography.ruggedOrMountainousShare * 100)}%`} />
        <Metric label="Mountainous terrain" value={`${roundForDisplay(diagnostics.geography.mountainousLandShare * 100)}%`} />
        <Metric label="Above local tree line" value={`${roundForDisplay(diagnostics.geography.elevationDrivenTreelineShare * 100)}%`} />
        <Metric label="Above local snow line" value={`${roundForDisplay(diagnostics.geography.elevationDrivenSnowlineShare * 100)}%`} />
        <Metric label="Permanent ice-covered land" value={`${roundForDisplay(diagnostics.geography.permanentIceLandShare * 100)}%`} />
      </section>
      <section className="diagnostic-section">
        <h3>Biome Structure</h3>
        <Metric label="Collapsed biome components" value={String(diagnostics.geography.collapsedBiomeComponents)} />
        <Metric label="Collapsed biome cells" value={diagnostics.geography.collapsedBiomeCells.toLocaleString()} />
        <Metric label="Transition anomalies" value={String(diagnostics.geography.transitionAnomalyCount)} status={diagnostics.geography.transitionAnomalyCount === 0 ? 'ok' : 'warn'} />
      </section>
      <section className="diagnostic-section">
        <h3>Features & Export</h3>
        <Metric label="Volcano tiles" value={String(diagnostics.features.volcanoTiles)} status={diagnostics.features.volcanoTiles > 0 ? 'ok' : 'warn'} />
        <Metric label="Mountain hexes" value={String(diagnostics.features.mountainHexes)} />
        <Metric label="Ridge edges" value={String(diagnostics.features.ridgeEdges)} />
        <Metric label="Lake hexes" value={String(diagnostics.features.lakeHexes)} status={diagnostics.features.lakeHexes > 0 ? 'ok' : undefined} />
        <Metric label="Hex export" value={diagnostics.export.hexDimensions} />
        <Metric label="River tile share" value={`${diagnostics.export.riverTilePercentage}%`} />
      </section>
      {diagnostics.climate && (
        <section className="diagnostic-section">
          <h3>Climate Pipeline</h3>
          <Metric label="Pipeline" value={diagnostics.climate.pipelineVersion} />
          <Metric label="Fidelity" value={diagnostics.climate.fidelity} />
          <Metric label="Seasonal frames" value={String(diagnostics.climate.seasonalFrameCount)} />
          <Metric label="Land seasonal swing" value={`${diagnostics.climate.landSeasonalSwingC} C`} />
          <Metric label="Ocean seasonal swing" value={`${diagnostics.climate.oceanSeasonalSwingC} C`} />
          <Metric label="Ice albedo cooling" value={`${diagnostics.climate.meanIceAlbedoCoolingC} C`} />
          {diagnostics.climate.itczLatitudeDeg !== undefined && <Metric label="ITCZ latitude" value={`${diagnostics.climate.itczLatitudeDeg} deg`} />}
          {diagnostics.climate.windTopographicDeflectionIndex !== undefined && <Metric label="Wind terrain deflection" value={String(diagnostics.climate.windTopographicDeflectionIndex)} />}
          {diagnostics.climate.meanOrographicLiftIndex !== undefined && <Metric label="Orographic lift" value={String(diagnostics.climate.meanOrographicLiftIndex)} />}
          {diagnostics.climate.meanCurrentSpeed !== undefined && <Metric label="Mean ocean current" value={String(diagnostics.climate.meanCurrentSpeed)} />}
          {diagnostics.climate.coastalCurrentDeflectionIndex !== undefined && <Metric label="Coastal current steering" value={String(diagnostics.climate.coastalCurrentDeflectionIndex)} />}
          {diagnostics.climate.meanCandidateWetness !== undefined && <Metric label="Candidate wetness" value={String(diagnostics.climate.meanCandidateWetness)} />}
          {diagnostics.climate.meanCurrentWetness !== undefined && <Metric label="Current wetness" value={String(diagnostics.climate.meanCurrentWetness)} />}
          {diagnostics.climate.meanWetnessDelta !== undefined && <Metric label="Mean wetness delta" value={String(diagnostics.climate.meanWetnessDelta)} />}
          {diagnostics.climate.wetnessCorrelation !== undefined && <Metric label="Wetness correlation" value={String(diagnostics.climate.wetnessCorrelation)} status={diagnostics.climate.wetnessCorrelation > 0.25 ? 'ok' : 'warn'} />}
          {diagnostics.climate.riverSourceSupportIndex !== undefined && <Metric label="River source support" value={String(diagnostics.climate.riverSourceSupportIndex)} />}
        </section>
      )}
      <section className="diagnostic-section">
        <h3>Findings</h3>
        <div className="diagnostic-findings">
          {diagnostics.findings.map((finding) => (
            <article key={finding.id} className={`diagnostic-finding ${finding.severity}`}>
              <strong>{finding.title}</strong>
              <span className="diagnostic-finding-scope">{finding.scope}</span>
              <p>{finding.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Metric({ label, value, status }: { label: string; value: string; status?: 'ok' | 'warn' }) {
  return (
    <div className={`metric ${status ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PointInspectorPanel({ record, copyStatus, onCopy, onClear }: { record: PointInspectionRecord; copyStatus: string; onCopy: () => void; onClear: () => void }) {
  return (
    <section className="point-inspector" aria-label="Point inspector">
      <header>
        <div>
          <span>Point Inspector</span>
          <strong>{record.source}</strong>
        </div>
        <div className="point-inspector-actions">
          <button type="button" title="Copy inspector JSON" onClick={onCopy}>
            <Copy size={14} />
            JSON
          </button>
          <button type="button" className="subtle-button" title="Clear inspected point" onClick={onClear}>
            <X size={14} />
          </button>
        </div>
      </header>
      {copyStatus && <div className="point-inspector-status">{copyStatus}</div>}
      <div className="point-inspector-grid">
        <Metric label="Seed pair" value={`${record.generation.starSeed ?? record.generation.configSeed} : ${record.generation.worldSeed}`} />
        <Metric label="Generated size" value={`${record.generation.outputResolution.width} x ${record.generation.outputResolution.height}`} />
        {record.generation.topologyResolution !== undefined && <Metric label="Source topology" value={String(record.generation.topologyResolution)} />}
        <Metric label="Lat / Lon" value={`${record.geo.latitude}, ${record.geo.longitude}`} />
        <Metric label="Map x/y" value={`${record.equirectangular.x}, ${record.equirectangular.y}`} />
        <Metric label="Topology" value={`F${record.topology.face} ${record.topology.x},${record.topology.y}`} />
        <Metric label="Topology cell" value={String(record.topology.index)} />
        <Metric label="Biome" value={record.worldData.biome} />
        <Metric label="Topo biome" value={record.worldData.topologyBiome} />
        <Metric label="Climate regime" value={titleCaseClimateRegime(record.worldData.climateRegime)} />
        <Metric label="Terrain" value={record.worldData.terrainClass} />
        <Metric label="Elevation band" value={record.worldData.elevationBand} />
        <Metric label="Treeline / snowline" value={`${record.worldData.elevationDrivenTreeline ? 'above tree line' : 'below tree line'} / ${record.worldData.elevationDrivenSnowline ? 'above snow line' : 'below snow line'}`} />
        <Metric label="Water / lake / ice" value={`${record.worldData.isWater ? 'water' : 'land'} / ${record.worldData.isLake ? 'lake' : 'no lake'} / ${record.worldData.permanentIce ? 'permanent ice' : record.worldData.isIce ? 'projected ice' : 'no ice'}`} />
        <Metric label="Sea delta" value={String(record.worldData.elevationRelativeToSeaLevel)} />
        <Metric label="Topo sea delta" value={String(record.worldData.topologyElevationRelativeToSeaLevel)} />
        <Metric label="Wetness / temp" value={`${record.worldData.wetness} / ${record.worldData.temperatureC}`} />
        <Metric label="Slope / shade" value={`${record.worldData.slope} / ${record.worldData.hillshade}`} />
        <Metric label="River / plate" value={`${record.worldData.river} / ${record.worldData.plateId}`} />
        <Metric label="Mode" value={`${record.renderData.mode} / ${record.renderData.mapMode}`} />
        <Metric label="Source match" value={record.renderData.sourceMatchesTopology ? 'projected = topology' : 'projected differs'} status={record.renderData.sourceMatchesTopology ? 'ok' : 'warn'} />
        <Metric label="Base color" value={record.renderData.baseBiomeColor} />
        <Metric label="Depth color" value={record.renderData.depthColor} />
        <Metric label="Coast / seabed" value={`${record.renderData.coastalBlend} / ${record.renderData.seabedTint}`} />
        <Metric label="Rock / snow tint" value={`${record.renderData.rockBlend} / ${record.renderData.snowTint}`} />
        <Metric label="Light / elevation" value={`${record.renderData.reliefLight} / ${record.renderData.elevationTint}`} />
        <Metric label="Grain / color delta" value={`${record.renderData.grainNoise} / ${record.renderData.sourceToFinalColorDistance}`} status={record.renderData.sourceToFinalColorDistance > 70 ? 'warn' : undefined} />
        <Metric label="Final albedo" value={record.renderData.finalAlbedo} />
        <Metric label="Ocean shell" value={`${record.renderData.oceanShellEnabled ? 'on' : 'off'} / ${record.renderData.oceanShellOpacity}`} />
      </div>
      <p className="point-inspector-note">{record.renderData.interpretation}</p>
    </section>
  );
}

export function projectGeneratorMismatch(project: WorldProject, config: GenerationConfig): string | null {
  const projectConfig = project.config as GenerationConfig & { seeds?: { star?: string; world?: string } };
  const generator = config as GenerationConfig & { seeds?: { star?: string; world?: string } };
  const projectStar = normalizeSeedForComparison(projectConfig.seeds?.star ?? project.config.seed, project.config.seed);
  const projectWorld = normalizeSeedForComparison(projectConfig.seeds?.world ?? project.seed, project.config.seed);
  const generatorStar = normalizeSeedForComparison(generator.seeds?.star ?? config.seed, config.seed);
  const generatorWorld = normalizeSeedForComparison(generator.seeds?.world ?? config.seed, config.seed);
  if (projectStar !== generatorStar || projectWorld !== generatorWorld) {
    return `Diagnostics are for ${projectStar}:${projectWorld}, but the generator controls show ${generatorStar}:${generatorWorld}. Generate again before comparing terrain percentages.`;
  }
  const projectResolution = project.primaryWorld.mapModel.resolution;
  const generatorResolution = config.outputResolution;
  if (projectResolution.width !== generatorResolution.width || projectResolution.height !== generatorResolution.height) {
    return `Diagnostics are for ${projectResolution.width}x${projectResolution.height}, but the generator controls show ${generatorResolution.width}x${generatorResolution.height}.`;
  }
  const projectTopology = project.primaryWorld.topology.resolution;
  if (config.topologyResolution !== undefined && projectTopology !== config.topologyResolution) {
    return `Diagnostics are for topology ${projectTopology}, but the generator controls show topology ${config.topologyResolution}.`;
  }
  return null;
}

function normalizeSeedForComparison(seed: string | undefined, fallback: string): string {
  const value = String(seed || fallback || '').trim();
  if (!value) return String(fallback || '');
  const labeled = value.match(/^(?:star|world):(.+)$/i);
  return labeled ? labeled[1] : value;
}

function DiagnosticDonutChart({ title, data }: { title: string; data: DiagnosticChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const gradient = donutGradient(data);
  const dominant = data.reduce<DiagnosticChartDatum | null>((best, item) => (!best || item.value > best.value ? item : best), null);
  return (
    <figure className="diagnostic-chart">
      <div className="diagnostic-donut" style={{ background: gradient }} aria-label={`${title} chart`}>
        <span>{total > 0 && dominant ? `${Math.round((dominant.value / total) * 100)}%` : '0%'}</span>
      </div>
      <figcaption>
        <strong>{title}</strong>
        {data.slice(0, 4).map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}: {total > 0 ? Math.round((item.value / total) * 100) : 0}%
          </span>
        ))}
        {data.length > 4 && (
          <details className="diagnostic-chart-details">
            <summary>Full breakdown</summary>
            {data.map((item) => (
              <span key={`full-${item.label}`}>
                <i style={{ background: item.color }} />
                {item.label}: {total > 0 ? roundForDisplay((item.value / total) * 100) : 0}%{Number.isInteger(item.value) ? ` (${item.value.toLocaleString()})` : ''}
              </span>
            ))}
          </details>
        )}
      </figcaption>
    </figure>
  );
}
