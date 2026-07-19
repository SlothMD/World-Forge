import { generateHexTileMap } from '@world-forge/exporters';
import { HexTileExportConfig, SurfaceElevationBand, SurfaceReliefCharacter, SurfaceStructureClassification, WorldProject, biomeNames, buildCubedSphereTopology, buildSurfaceStructureClassification, codeToBiome } from '@world-forge/shared';
import { MapTheme, analyzeBiomeRenderParity, cleanGameMapTheme } from '@world-forge/renderer';
import { APP_VERSION } from '../appVersion';

export type DiagnosticSeverity = 'ok' | 'warn' | 'info';

export type DiagnosticFinding = {
  id: string;
  severity: DiagnosticSeverity;
  scope: 'world' | 'export' | 'performance' | 'renderer' | 'project';
  title: string;
  detail: string;
};

export type DiagnosticChartDatum = {
  label: string;
  value: number;
  color: string;
};

export type WorldDiagnosticsSummary = {
  generation: {
    appVersion: string;
    currentAppVersion: string;
    generatedAt: string;
    seed: string;
    starSeed: string;
    worldSeed: string;
    worldPreset: string;
    outputResolution: string;
    topologyResolution: number;
    selectedValues: Array<{ label: string; value: string }>;
  };
  health: {
    score: number;
    label: string;
  };
  hydrology: {
    namedRivers: number;
    topologyRiverCells: number;
    sourceCandidateCount?: number;
    terrainHeadwaterCandidateShare?: number;
    topologyRiverCellShare?: number;
    namedRiverPathCellShare?: number;
    shortRiverShare?: number;
    namedRiverCapacityUse?: number;
    riverDistributionEvenness?: number;
    riverTermini: Record<string, number>;
    riverBearingHexes: number;
    minorRiverEdges: number;
    navigableRiverEdges: number;
    navigableRiverHexes: number;
  };
  features: {
    volcanoTiles: number;
    ridgeEdges: number;
    mountainHexes: number;
    lakeHexes: number;
  };
  geography: {
    surfaceStructureModelVersion: string;
    reliefCharacter: SurfaceReliefCharacter;
    highestElevation: number;
    highestElevationBand: SurfaceElevationBand;
    highestPointLatitude: number;
    highestPointLongitude: number;
    highestPointMapX: number;
    highestPointMapY: number;
    elevatedLandShare: number;
    ruggedOrMountainousShare: number;
    mountainousLandShare: number;
    elevationDrivenTreelineShare: number;
    elevationDrivenSnowlineShare: number;
    permanentIceLandShare: number;
    collapsedBiomeComponents: number;
    collapsedBiomeCells: number;
    transitionAnomalyCount: number;
    transitionAnomalyShare: number;
    projectedBiomeFingerprint: string;
    topologyBiomeFingerprint: string;
    naturalLandAlbedoFingerprint: string;
    actualIceLandShare: number;
    paleNonIceLandShare: number;
    meanNonIceColorDistanceFromIce: number;
  };
  export: {
    hexDimensions: string;
    riverTilePercentage: number;
    hexTileCount: number;
  };
  climate?: {
    pipelineVersion: string;
    fidelity: string;
    seasonalFrameCount: number;
    landSeasonalSwingC: number;
    oceanSeasonalSwingC: number;
    seasonalTemperatureSwingC: number;
    meanIceAlbedoCoolingC: number;
    itczLatitudeDeg?: number;
    windTopographicDeflectionIndex?: number;
    meanOrographicLiftIndex?: number;
    meanCurrentSpeed?: number;
    coastalCurrentDeflectionIndex?: number;
    meanCandidateWetness?: number;
    meanCurrentWetness?: number;
    meanWetnessDelta?: number;
    wetnessCorrelation?: number;
    riverSourceSupportIndex?: number;
  };
  charts: {
    biomes: DiagnosticChartDatum[];
    elevation: DiagnosticChartDatum[];
    terrain: DiagnosticChartDatum[];
    water: DiagnosticChartDatum[];
    waterDepth: DiagnosticChartDatum[];
  };
  findings: DiagnosticFinding[];
};

export function buildWorldDiagnostics(project: WorldProject, tileConfig: Partial<HexTileExportConfig>, theme: MapTheme): WorldDiagnosticsSummary {
  const topologyRiverCells = countLayerAbove(project.primaryWorld.topologyLayers.river, 0.05);
  const deepTimeHydrology = (project.primaryWorld as WorldProject['primaryWorld'] & {
    deepTime?: { hydrology?: {
      sourceCandidateCount?: number;
      terrainHeadwaterCandidateShare?: number;
      topologyRiverCellShare?: number;
      namedRiverPathCellShare?: number;
      shortRiverShare?: number;
      namedRiverCapacityUse?: number;
      riverDistributionEvenness?: number;
    } };
  }).deepTime?.hydrology;
  const volcanismCells = countLayerAbove(project.primaryWorld.topologyLayers.volcanism ?? new Float32Array(0), 0.68);
  const riverTermini = project.primaryWorld.rivers.reduce<Record<string, number>>((counts, river) => {
    counts[river.terminus] = (counts[river.terminus] ?? 0) + 1;
    return counts;
  }, { ocean: 0, lake: 0, wetland: 0, basin: 0 });
  const tileMap = generateHexTileMap(project, tileConfig);
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  const surfaceStructure = buildSurfaceStructureClassification({
    seaLevel: project.primaryWorld.seaLevel,
    topology,
    elevation: project.primaryWorld.topologyLayers.elevation,
    water: project.primaryWorld.topologyLayers.water,
    temperature: project.primaryWorld.topologyLayers.temperature,
    ice: project.primaryWorld.topologyLayers.ice
  });
  let riverBearingHexes = 0;
  let minorRiverEdges = 0;
  let navigableRiverEdges = 0;
  let navigableRiverHexes = 0;
  let volcanoTiles = 0;
  let ridgeEdges = 0;
  let mountainHexes = 0;
  let lakeHexes = 0;
  const waterCounts = new Map<string, number>([
    ['Marine', 0],
    ['Fresh water', 0],
    ['No fresh water', 0]
  ]);
  const waterDepthCounts = worldWaterDepthCounts(project);
  const renderParity = analyzeBiomeRenderParity(project, theme);
  const geography = {
    ...worldGeographyDiagnostics(project, surfaceStructure),
    projectedBiomeFingerprint: renderParity.projectedBiomeFingerprint,
    topologyBiomeFingerprint: renderParity.topologyBiomeFingerprint,
    naturalLandAlbedoFingerprint: renderParity.naturalLandAlbedoFingerprint,
    actualIceLandShare: renderParity.actualIceLandShare,
    paleNonIceLandShare: renderParity.paleNonIceLandShare,
    meanNonIceColorDistanceFromIce: renderParity.meanNonIceColorDistanceFromIce
  };
  for (const tile of tileMap.tiles) {
    minorRiverEdges += tile.minorRiverEdges.length;
    navigableRiverEdges += tile.navigableRiverEdges.length;
    ridgeEdges += tile.ridgeEdges.length;
    if (tile.minorRiverEdges.length || tile.navigableRiverEdges.length || tile.navigableRiverCenter) riverBearingHexes += 1;
    if (tile.navigableRiverCenter || tile.navigableRiverEdges.length) navigableRiverHexes += 1;
    if (tile.featureDetails.includes('volcano')) volcanoTiles += 1;
    if (tile.morphology === 'mountainous') mountainHexes += 1;
    if (tile.morphology === 'lake') lakeHexes += 1;
    if (tile.water && tile.morphology !== 'lake') waterCounts.set('Marine', (waterCounts.get('Marine') ?? 0) + 1);
    else if (tile.morphology === 'lake' || tile.minorRiverEdges.length || tile.navigableRiverEdges.length || tile.navigableRiverCenter) waterCounts.set('Fresh water', (waterCounts.get('Fresh water') ?? 0) + 1);
    else waterCounts.set('No fresh water', (waterCounts.get('No fresh water') ?? 0) + 1);
  }
  const findings: DiagnosticFinding[] = [];
  const generation = generationDiagnostics(project);
  if (generation.appVersion !== generation.currentAppVersion) {
    findings.push({
      id: 'project-build-version-differs',
      severity: 'warn',
      scope: 'project',
      title: 'Loaded project came from a different build',
      detail: `This project was generated with ${generation.appVersion}, while the current app is ${generation.currentAppVersion}. Regenerate before comparing terrain diagnostics against current code.`
    });
  }
  if (project.metrics.validation.oceanWithinTolerance) {
    findings.push({ id: 'ocean-ok', severity: 'ok', scope: 'world', title: 'Ocean target met', detail: `Generated ocean coverage is ${project.metrics.oceanPercentage}% against a ${project.selectedValues.oceanPercentage}% target.` });
  } else {
    findings.push({ id: 'ocean-warn', severity: 'warn', scope: 'world', title: 'Ocean target outside tolerance', detail: `Generated ocean coverage is ${project.metrics.oceanPercentage}% against a ${project.selectedValues.oceanPercentage}% target and ${project.selectedValues.oceanTolerancePercentagePoints} point tolerance.` });
  }
  if (project.metrics.validation.riverPathsValid) {
    findings.push({ id: 'rivers-valid', severity: 'ok', scope: 'world', title: 'River topology validates', detail: 'Named river paths terminate in recognized ocean, lake, or wetland destinations and topology river signal is present.' });
  } else {
    findings.push({ id: 'rivers-invalid', severity: 'warn', scope: 'world', title: 'River topology needs inspection', detail: 'At least one generated river path failed validation or river signal is absent.' });
  }
  const riverTilePercentage = roundForDisplay((riverBearingHexes / Math.max(1, tileMap.tiles.length)) * 100);
  if (riverBearingHexes === 0) {
    findings.push({ id: 'hex-rivers-missing', severity: 'warn', scope: 'export', title: 'Hex export has no visible rivers', detail: 'Topology may contain river signal, but current tile translation produced no river-bearing hexes.' });
  } else {
    findings.push({ id: 'hex-rivers-present', severity: 'ok', scope: 'export', title: 'Hex river semantics present', detail: `${riverBearingHexes} hexes carry river semantics, including ${minorRiverEdges} minor edges and ${navigableRiverEdges} navigable edges.` });
  }
  if (deepTimeHydrology) {
    if ((deepTimeHydrology.terrainHeadwaterCandidateShare ?? 0) < 0.08) {
      findings.push({ id: 'hydrology-headwater-low', severity: 'warn', scope: 'world', title: 'Headwater support is sparse', detail: `${roundForDisplay((deepTimeHydrology.terrainHeadwaterCandidateShare ?? 0) * 100)}% of land cells qualify as wet elevated headwater candidates. Sparse rivers may be caused by climate/terrain input rather than export.` });
    } else if ((deepTimeHydrology.topologyRiverCellShare ?? 0) < 0.04) {
      findings.push({ id: 'hydrology-topology-sparse', severity: 'warn', scope: 'world', title: 'Topology river signal is sparse', detail: `${roundForDisplay((deepTimeHydrology.topologyRiverCellShare ?? 0) * 100)}% of land cells have topology river signal despite available headwater support. Inspect hydrology thresholds.` });
    } else {
      findings.push({ id: 'hydrology-support-ok', severity: 'ok', scope: 'world', title: 'Hydrology input support present', detail: `${roundForDisplay((deepTimeHydrology.terrainHeadwaterCandidateShare ?? 0) * 100)}% headwater support and ${roundForDisplay((deepTimeHydrology.topologyRiverCellShare ?? 0) * 100)}% topology river-cell share.` });
    }
    if ((deepTimeHydrology.shortRiverShare ?? 0) > 0.55) {
      findings.push({ id: 'hydrology-short-rivers', severity: 'warn', scope: 'world', title: 'Named rivers are short', detail: `${roundForDisplay((deepTimeHydrology.shortRiverShare ?? 0) * 100)}% of named rivers are short at topology scale. This can make river networks visually sparse after projection or hex downsampling.` });
    }
  }
  if (volcanoTiles === 0) {
    findings.push({ id: 'volcano-missing', severity: 'warn', scope: 'export', title: 'No volcano features exported', detail: `${volcanismCells} topology cells exceed the volcanism threshold, but current tile translation produced no visible volcano feature tiles.` });
  } else {
    findings.push({ id: 'volcano-present', severity: 'ok', scope: 'export', title: 'Volcano features present', detail: `${volcanoTiles} hexes carry volcano feature detail from ${volcanismCells} high-volcanism topology cells.` });
  }
  if (!project.diagnostics?.phases.length) {
    findings.push({ id: 'phase-missing', severity: 'info', scope: 'performance', title: 'Generation phase timings unavailable', detail: 'Imported or older projects may not include phase timing data.' });
  } else {
    const slowest = [...project.diagnostics.phases].sort((a, b) => b.ms - a.ms)[0];
    findings.push({ id: 'slowest-phase', severity: 'info', scope: 'performance', title: 'Slowest generation phase', detail: `${slowest.name} took ${Math.round(slowest.ms)} ms.` });
  }
  const marineDepthTotal = [...waterDepthCounts.values()].reduce((sum, value) => sum + value, 0);
  const shallowShare = ((waterDepthCounts.get('Shelf') ?? 0) / Math.max(1, marineDepthTotal)) * 100;
  if (marineDepthTotal > 0 && shallowShare > 28) {
    findings.push({ id: 'shelf-heavy', severity: 'warn', scope: 'world', title: 'Broad shallow shelf coverage', detail: `${roundForDisplay(shallowShare)}% of marine cells are in the immediate shelf band. This may indicate true broad shelves rather than only a preview color artifact.` });
  } else if (marineDepthTotal > 0) {
    findings.push({ id: 'ocean-depth-ok', severity: 'ok', scope: 'world', title: 'Ocean depth mix looks plausible', detail: `${roundForDisplay(shallowShare)}% of marine cells are in the immediate shelf band; deeper ocean dominates the water area.` });
  }
  const moistureSummary = project.primaryWorld.climate?.moisture;
  if (moistureSummary) {
    if (moistureSummary.wetnessCorrelation < 0.25) {
      findings.push({ id: 'climate-moisture-divergent', severity: 'warn', scope: 'world', title: 'Climate moisture diverges from current wetness', detail: `Candidate/current wetness correlation is ${moistureSummary.wetnessCorrelation}. Review Climate moisture and Debug: Wetness delta before cutting biome generation over.` });
    } else {
      findings.push({ id: 'climate-moisture-correlated', severity: 'ok', scope: 'world', title: 'Climate moisture candidate is comparable', detail: `Candidate/current wetness correlation is ${moistureSummary.wetnessCorrelation}, with mean delta ${moistureSummary.meanWetnessDelta}.` });
    }
  }
  if (geography.transitionAnomalyCount > 0 && geography.transitionAnomalyShare > 0.005 && geography.transitionAnomalyCount >= 256) {
    findings.push({ id: 'biome-transition-anomalies', severity: 'warn', scope: 'world', title: 'Abrupt biome transitions remain', detail: `${geography.transitionAnomalyCount} high-contrast biome edges (${roundForDisplay(geography.transitionAnomalyShare * 100)}% of checked land biome adjacencies) lack an intermediate biome.` });
  } else if (geography.transitionAnomalyCount > 0) {
    findings.push({ id: 'biome-transitions-within-tolerance', severity: 'ok', scope: 'world', title: 'Biome transitions within tolerance', detail: `${geography.transitionAnomalyCount} high-contrast biome edges (${roundForDisplay(geography.transitionAnomalyShare * 100)}% of checked land biome adjacencies) remain, below the world-level warning threshold.` });
  } else {
    findings.push({ id: 'biome-transitions-ok', severity: 'ok', scope: 'world', title: 'Biome transitions pass basic checks', detail: 'No high-contrast rainforest, desert, tundra, or ice adjacency anomalies were found.' });
  }
  if (geography.collapsedBiomeComponents > 0) {
    findings.push({ id: 'biome-components-collapsed', severity: 'info', scope: 'world', title: 'Micro-biomes retained as local detail', detail: `${geography.collapsedBiomeComponents} unsupported components covering ${geography.collapsedBiomeCells} cells were merged at world scale and retained in deep-time metadata.` });
  }
  if (geography.elevationDrivenSnowlineShare > geography.elevationDrivenTreelineShare + 0.000001) {
    findings.push({ id: 'surface-line-invariant', severity: 'warn', scope: 'world', title: 'Surface climate-line invariant failed', detail: 'Elevation-driven snowline terrain must be a subset of elevation-driven treeline terrain.' });
  }
  if (geography.paleNonIceLandShare > 0.18) {
    findings.push({ id: 'biome-render-false-pale', severity: 'warn', scope: 'renderer', title: 'Natural biome rendering is overly pale', detail: `${roundForDisplay(geography.paleNonIceLandShare * 100)}% of non-ice land renders with low-saturation pale albedo. Compare projected biome ${geography.projectedBiomeFingerprint} and natural albedo ${geography.naturalLandAlbedoFingerprint}.` });
  } else {
    findings.push({ id: 'biome-render-parity-ok', severity: 'ok', scope: 'renderer', title: 'Natural biome colors remain distinguishable', detail: `${roundForDisplay(geography.paleNonIceLandShare * 100)}% of non-ice land is pale, with mean color distance ${roundForDisplay(geography.meanNonIceColorDistanceFromIce)} from the ice palette.` });
  }
  const warnCount = findings.filter((finding) => finding.severity === 'warn' && finding.scope === 'world').length;
  const score = Math.max(0, 100 - warnCount * 18 - (project.metrics.validation.oceanWithinTolerance ? 0 : 8));
  return {
    generation,
    health: {
      score,
      label: score >= 85 ? 'Good' : score >= 65 ? 'Watch' : 'Needs work'
    },
    hydrology: {
      namedRivers: project.primaryWorld.rivers.length,
      topologyRiverCells,
      sourceCandidateCount: deepTimeHydrology?.sourceCandidateCount,
      terrainHeadwaterCandidateShare: deepTimeHydrology?.terrainHeadwaterCandidateShare,
      topologyRiverCellShare: deepTimeHydrology?.topologyRiverCellShare,
      namedRiverPathCellShare: deepTimeHydrology?.namedRiverPathCellShare,
      shortRiverShare: deepTimeHydrology?.shortRiverShare,
      namedRiverCapacityUse: deepTimeHydrology?.namedRiverCapacityUse,
      riverDistributionEvenness: deepTimeHydrology?.riverDistributionEvenness,
      riverTermini,
      riverBearingHexes,
      minorRiverEdges,
      navigableRiverEdges,
      navigableRiverHexes
    },
    features: {
      volcanoTiles,
      ridgeEdges,
      mountainHexes,
      lakeHexes
    },
    geography,
    export: {
      hexDimensions: `${tileMap.dimensions.width} x ${tileMap.dimensions.height}`,
      riverTilePercentage,
      hexTileCount: tileMap.tiles.length
    },
    climate: project.primaryWorld.climate
      ? {
          pipelineVersion: project.primaryWorld.climate.pipelineVersion,
          fidelity: project.primaryWorld.climate.fidelity,
          seasonalFrameCount: project.primaryWorld.climate.seasonalFrames.length,
          landSeasonalSwingC: project.primaryWorld.climate.diagnostics.landSeasonalSwingC,
          oceanSeasonalSwingC: project.primaryWorld.climate.diagnostics.oceanSeasonalSwingC,
          seasonalTemperatureSwingC: project.primaryWorld.climate.diagnostics.seasonalTemperatureSwingC,
          meanIceAlbedoCoolingC: project.primaryWorld.climate.diagnostics.meanIceAlbedoCoolingC,
          itczLatitudeDeg: project.primaryWorld.climate.circulation?.itczLatitudeDeg,
          windTopographicDeflectionIndex: project.primaryWorld.climate.circulation?.windTopographicDeflectionIndex,
          meanOrographicLiftIndex: project.primaryWorld.climate.circulation?.meanOrographicLiftIndex,
          meanCurrentSpeed: project.primaryWorld.climate.circulation?.oceanCurrents.meanCurrentSpeed,
          coastalCurrentDeflectionIndex: project.primaryWorld.climate.circulation?.oceanCurrents.coastalDeflectionIndex,
          meanCandidateWetness: project.primaryWorld.climate.moisture?.meanCandidateWetness,
          meanCurrentWetness: project.primaryWorld.climate.moisture?.meanCurrentWetness,
          meanWetnessDelta: project.primaryWorld.climate.moisture?.meanWetnessDelta,
          wetnessCorrelation: project.primaryWorld.climate.moisture?.wetnessCorrelation,
          riverSourceSupportIndex: project.primaryWorld.climate.moisture?.riverSourceSupportIndex
        }
      : undefined,
    charts: {
      biomes: biomeChartData(project, theme),
      elevation: surfaceElevationChartData(surfaceStructure),
      terrain: surfaceMorphologyChartData(surfaceStructure),
      water: waterChartData(waterCounts),
      waterDepth: waterDepthChartData(waterDepthCounts)
    },
    findings
  };
}

function generationDiagnostics(project: WorldProject): WorldDiagnosticsSummary['generation'] {
  const config = project.config as WorldProject['config'] & { seeds?: { star?: string; world?: string }; worldPresetId?: string };
  const selectedValueLabels: Array<[keyof WorldProject['selectedValues'], string, string?]> = [
    ['systemAgeGy', 'Age', ' Gy'],
    ['oceanPercentage', 'Ocean target', '%'],
    ['averageTemperatureC', 'Temperature', ' C'],
    ['aridity', 'Aridity'],
    ['plateCount', 'Plates'],
    ['continentCount', 'Continents'],
    ['riverDensity', 'River density']
  ];
  return {
    appVersion: project.appVersion,
    currentAppVersion: APP_VERSION,
    generatedAt: project.updatedAt || project.createdAt,
    seed: project.seed,
    starSeed: config.seeds?.star ?? project.seed,
    worldSeed: config.seeds?.world ?? project.seed,
    worldPreset: config.worldPresetId ?? 'Unknown',
    outputResolution: `${project.primaryWorld.mapModel.resolution.width} x ${project.primaryWorld.mapModel.resolution.height}`,
    topologyResolution: project.primaryWorld.topology.resolution,
    selectedValues: selectedValueLabels.map(([key, label, suffix]) => ({
      label,
      value: `${formatSelectedValue(project.selectedValues[key])}${suffix ?? ''}`
    }))
  };
}

function worldGeographyDiagnostics(project: WorldProject, surfaceStructure: SurfaceStructureClassification): Omit<WorldDiagnosticsSummary['geography'], 'projectedBiomeFingerprint' | 'topologyBiomeFingerprint' | 'naturalLandAlbedoFingerprint' | 'actualIceLandShare' | 'paleNonIceLandShare' | 'meanNonIceColorDistanceFromIce'> {
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  let highestIndex = 0;
  let highestElevation = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < world.layers.elevation.length; index += 1) {
    const elevation = world.layers.elevation[index];
    if (elevation > highestElevation) {
      highestElevation = elevation;
      highestIndex = index;
    }
  }
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const layers = world.topologyLayers;
  let transitionAnomalyCount = 0;
  let checkedLandBiomeEdges = 0;
  for (let cell = 0; cell < layers.biomes.length; cell += 1) {
    if (layers.water[cell]) continue;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || neighbor <= cell || layers.water[neighbor]) continue;
      checkedLandBiomeEdges += 1;
      const a = codeToBiome(layers.biomes[cell]);
      const b = codeToBiome(layers.biomes[neighbor]);
      const pair = new Set([a, b]);
      const implausible = (pair.has('rainforest') && (pair.has('desert') || pair.has('tundra') || pair.has('ice_cap'))) || (pair.has('desert') && pair.has('ice_cap'));
      if (implausible) transitionAnomalyCount += 1;
    }
  }
  const deepTime = (world as typeof world & {
    deepTime?: { biomeConsolidation?: { collapsedComponents?: unknown[]; collapsedCellCount?: number } };
  }).deepTime;
  const highestX = highestIndex % width;
  const highestY = Math.floor(highestIndex / width);
  const summary = surfaceStructure.summary;
  const landArea = Math.max(0.000001, summary.landArea);
  return {
    surfaceStructureModelVersion: summary.modelVersion,
    reliefCharacter: summary.reliefCharacter,
    highestElevation: roundForDisplay(highestElevation - world.seaLevel),
    highestElevationBand: summary.highestElevationBand,
    highestPointLatitude: roundForDisplay(90 - ((highestY + 0.5) / height) * 180),
    highestPointLongitude: roundForDisplay(((highestX + 0.5) / width) * 360 - 180),
    highestPointMapX: highestX,
    highestPointMapY: highestY,
    elevatedLandShare: (summary.elevationBandArea.highland + summary.elevationBandArea.alpine) / landArea,
    ruggedOrMountainousShare: (summary.morphologyArea.rugged + summary.morphologyArea.mountainous) / landArea,
    mountainousLandShare: summary.morphologyArea.mountainous / landArea,
    elevationDrivenTreelineShare: summary.elevationDrivenTreelineArea / landArea,
    elevationDrivenSnowlineShare: summary.elevationDrivenSnowlineArea / landArea,
    permanentIceLandShare: summary.permanentIceLandArea / landArea,
    collapsedBiomeComponents: deepTime?.biomeConsolidation?.collapsedComponents?.length ?? 0,
    collapsedBiomeCells: deepTime?.biomeConsolidation?.collapsedCellCount ?? 0,
    transitionAnomalyCount,
    transitionAnomalyShare: transitionAnomalyCount / Math.max(1, checkedLandBiomeEdges)
  };
}

function countLayerAbove(layer: Float32Array, threshold: number): number {
  let count = 0;
  for (const value of layer) if (value > threshold) count += 1;
  return count;
}

function worldWaterDepthCounts(project: WorldProject): Map<string, number> {
  const counts = new Map<string, number>([
    ['Shelf', 0],
    ['Shallow sea', 0],
    ['Ocean', 0],
    ['Deep ocean', 0]
  ]);
  const world = project.primaryWorld;
  for (let index = 0; index < world.layers.water.length; index += 1) {
    if (world.layers.water[index] !== 1) continue;
    const depth = world.seaLevel - world.layers.elevation[index];
    if (depth <= 0.055) counts.set('Shelf', (counts.get('Shelf') ?? 0) + 1);
    else if (depth <= 0.12) counts.set('Shallow sea', (counts.get('Shallow sea') ?? 0) + 1);
    else if (depth <= 0.24) counts.set('Ocean', (counts.get('Ocean') ?? 0) + 1);
    else counts.set('Deep ocean', (counts.get('Deep ocean') ?? 0) + 1);
  }
  return counts;
}

function biomeChartData(project: WorldProject, theme: MapTheme): DiagnosticChartDatum[] {
  return Object.entries(project.metrics.biomeCounts)
    .filter(([biome, value]) => biome !== 'ocean' && value > 0)
    .map(([biome, value]) => ({
      label: biome.replace('_', ' '),
      value,
      color: biomeLegendColor(theme, biome)
    }))
    .sort((a, b) => b.value - a.value);
}

function surfaceElevationChartData(surface: SurfaceStructureClassification): DiagnosticChartDatum[] {
  const total = Math.max(0.000001, surface.summary.landArea);
  const colors: Record<SurfaceElevationBand, string> = {
    lowland: '#7fa65a',
    upland: '#aaa66f',
    highland: '#9a8468',
    alpine: '#d8d8cf'
  };
  return (Object.entries(surface.summary.elevationBandArea) as Array<[SurfaceElevationBand, number]>)
    .map(([label, area]) => ({ label, value: area / total, color: colors[label] }));
}

function surfaceMorphologyChartData(surface: SurfaceStructureClassification): DiagnosticChartDatum[] {
  const total = Math.max(0.000001, surface.summary.landArea);
  const colors: Record<string, string> = {
    flat: '#9bbf6a',
    rolling: '#b4aa72',
    rugged: '#a38d72',
    mountainous: '#7f7a70'
  };
  return Object.entries(surface.summary.morphologyArea)
    .map(([label, area]) => ({ label, value: area / total, color: colors[label] ?? '#8d9387' }));
}

function waterChartData(counts: Map<string, number>): DiagnosticChartDatum[] {
  const colors: Record<string, string> = {
    Marine: '#2f7fa6',
    'Fresh water': '#b0dfe2',
    'No fresh water': '#c8c0ad'
  };
  return [...counts.entries()].map(([label, value]) => ({ label, value, color: colors[label] ?? '#8d9387' }));
}

function waterDepthChartData(counts: Map<string, number>): DiagnosticChartDatum[] {
  const colors: Record<string, string> = {
    Shelf: '#4f9fba',
    'Shallow sea': '#3e8fb0',
    Ocean: '#2f7fa6',
    'Deep ocean': '#1e4f73'
  };
  return [...counts.entries()].map(([label, value]) => ({ label, value, color: colors[label] ?? '#8d9387' }));
}

function biomeLegendColor(theme: MapTheme, biome: string): string {
  if (biome === 'ice_cap') return theme.colors.ice ?? cleanGameMapTheme.colors.ice;
  return theme.colors[biome] ?? theme.colors.grassland ?? cleanGameMapTheme.colors.grassland;
}

function roundForDisplay(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatSelectedValue(value: number | undefined): string {
  if (!Number.isFinite(value)) return 'n/a';
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : String(roundForDisplay(numeric));
}
