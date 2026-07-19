import {
  buildCubedSphereTopology,
  clamp,
  codeToBiome,
  type Biome,
  type WorldProject
} from '@world-forge/shared';

export type ClimateRegime = 'maritime' | 'continental' | 'monsoonal' | 'arid_seasonal' | 'stable_tropical';

export type BiomeDiagnostics = {
  modelVersion: 'biome-diagnostics-v3';
  landCellCount: number;
  marineCellCount: number;
  biomeSharesOfLand: Partial<Record<Biome, number>>;
  transitionDensity: number;
  isolatedBiomeCellShare: number;
  tinyPatchCellShare: number;
  annualSeasonalTemperatureSwingC: number;
  landSeasonalTemperatureSwingC: number;
  meanTemperatureVarianceProxyC: number;
  p90TemperatureVarianceProxyC: number;
  lowVarianceLandShare: number;
  highVarianceLandShare: number;
  biomeMeanTemperatureVarianceProxyC: Partial<Record<Biome, number>>;
  climateRegimeByCell: ClimateRegime[];
  climateRegimeSharesOfLand: Record<ClimateRegime, number>;
  climateRegimeMeanTemperatureVarianceProxyC: Record<ClimateRegime, number>;
  desertHighWetnessShare: number;
  rainforestLowWetnessShare: number;
  forestExtremeColdShare: number;
  wetlandUnsupportedShare: number;
  warmIceShare: number;
  legacyMountainBiomeShare: number;
  mountainousTerrainShareOfLand: number;
  mountainousTerrainBiomeShares: Partial<Record<Biome, number>>;
  findings: string[];
  notes: string[];
};

type BiomeDeepTime = {
  biomeDiagnostics?: BiomeDiagnostics;
  notes?: string[];
};

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)));
  return sorted[index];
}

function localRelief(cell: number, elevation: Float32Array, neighbors: Int32Array): number {
  let min = elevation[cell];
  let max = elevation[cell];
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    min = Math.min(min, elevation[neighbor]);
    max = Math.max(max, elevation[neighbor]);
  }
  return max - min;
}

function waterNeighborCount(cell: number, water: Uint8Array, neighbors: Int32Array): number {
  let count = 0;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor >= 0 && water[neighbor]) count += 1;
  }
  return count;
}

function temperatureVarianceProxy(
  cell: number,
  project: WorldProject,
  latitude: number,
  waterNeighbors: number,
  annualSwingC: number,
  landSwingC: number
): number {
  const world = project.primaryWorld;
  const water = world.topologyLayers.water[cell] === 1;
  const elevationAboveSea = Math.max(0, world.topologyLayers.elevation[cell] - world.seaLevel);
  const latitudeFactor = 0.38 + Math.abs(Math.sin(latitude)) * 0.92;
  const surfaceResponse = water ? 0.34 : 1;
  const coastalDamping = water ? 1 : 1 - Math.min(0.42, waterNeighbors * 0.105);
  const eccentricityFactor = 1 + clamp(world.orbitalEccentricity, 0, 0.65) * 0.75;
  const elevationFactor = 1 + Math.min(0.22, elevationAboveSea * 0.18);
  const baseline = water ? Math.max(1, annualSwingC * 0.55) : Math.max(1, landSwingC || annualSwingC);
  return Math.max(0, baseline * latitudeFactor * surfaceResponse * coastalDamping * eccentricityFactor * elevationFactor);
}

function climateRegimeForCell(
  project: WorldProject,
  cell: number,
  variance: number,
  waterNeighbors: number,
  lowVarianceCutoff: number,
  highVarianceCutoff: number
): ClimateRegime {
  const layers = project.primaryWorld.topologyLayers;
  const temperature = layers.temperature[cell];
  const wetness = layers.wetness[cell];
  const precipitation = layers.climatePrecipitation[cell];
  const coastalInfluence = waterNeighbors / 4;

  if (temperature >= 18 && wetness >= 0.58 && variance <= lowVarianceCutoff) return 'stable_tropical';
  if (precipitation >= 0.58 && wetness >= 0.5 && variance > lowVarianceCutoff && variance < highVarianceCutoff) return 'monsoonal';
  if ((wetness <= 0.34 || precipitation <= 0.3) && variance >= lowVarianceCutoff) return 'arid_seasonal';
  if (coastalInfluence >= 0.25 && variance <= highVarianceCutoff) return 'maritime';
  return 'continental';
}

export function attachBiomeDiagnostics(project: WorldProject): BiomeDiagnostics {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const layers = world.topologyLayers;
  const climateDiagnostics = world.climate?.diagnostics;
  const annualSwingC = climateDiagnostics?.seasonalTemperatureSwingC ?? 0;
  const landSwingC = climateDiagnostics?.landSeasonalSwingC ?? annualSwingC;
  const landBiomeCounts = new Map<Biome, number>();
  const biomeVarianceTotals = new Map<Biome, number>();
  const biomeVarianceCounts = new Map<Biome, number>();
  const varianceByCell = new Float32Array(topology.cellCount);
  const varianceValues: number[] = [];
  let landCells = 0;
  let marineCells = 0;
  let transitions = 0;
  let comparableEdges = 0;
  let isolatedCells = 0;
  let tinyPatchCells = 0;
  let desertCells = 0;
  let desertHighWetness = 0;
  let rainforestCells = 0;
  let rainforestLowWetness = 0;
  let forestCells = 0;
  let forestExtremeCold = 0;
  let wetlandCells = 0;
  let wetlandUnsupported = 0;
  let iceCells = 0;
  let warmIce = 0;
  let legacyMountainBiomeCells = 0;
  let mountainousTerrainCells = 0;
  const mountainousTerrainBiomeCounts = new Map<Biome, number>();

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const marine = layers.water[cell] === 1;
    const biome = codeToBiome(layers.biomes[cell]) ?? 'ocean';
    if (marine) {
      marineCells += 1;
      continue;
    }

    landCells += 1;
    landBiomeCounts.set(biome, (landBiomeCounts.get(biome) ?? 0) + 1);
    const waterNeighbors = waterNeighborCount(cell, layers.water, topology.neighbors);
    const variance = temperatureVarianceProxy(cell, project, topology.latitudes[cell], waterNeighbors, annualSwingC, landSwingC);
    varianceByCell[cell] = variance;
    varianceValues.push(variance);
    biomeVarianceTotals.set(biome, (biomeVarianceTotals.get(biome) ?? 0) + variance);
    biomeVarianceCounts.set(biome, (biomeVarianceCounts.get(biome) ?? 0) + 1);

    let sameBiomeNeighbors = 0;
    let landNeighbors = 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || layers.water[neighbor]) continue;
      landNeighbors += 1;
      const neighborBiome = codeToBiome(layers.biomes[neighbor]) ?? 'ocean';
      if (neighborBiome === biome) sameBiomeNeighbors += 1;
      if (neighbor > cell) {
        comparableEdges += 1;
        if (neighborBiome !== biome) transitions += 1;
      }
    }
    if (landNeighbors > 0 && sameBiomeNeighbors === 0) isolatedCells += 1;
    if (landNeighbors > 1 && sameBiomeNeighbors <= 1) tinyPatchCells += 1;

    const wetness = layers.wetness[cell];
    const temperature = layers.temperature[cell];
    const relief = localRelief(cell, layers.elevation, topology.neighbors);
    if (biome === 'desert') {
      desertCells += 1;
      if (wetness > 0.62) desertHighWetness += 1;
    } else if (biome === 'rainforest') {
      rainforestCells += 1;
      if (wetness < 0.58) rainforestLowWetness += 1;
    } else if (biome === 'forest') {
      forestCells += 1;
      if (temperature < -6) forestExtremeCold += 1;
    } else if (biome === 'wetland') {
      wetlandCells += 1;
      const supported = wetness >= 0.66 || layers.river[cell] >= 0.2 || layers.lakes[cell] === 1 || waterNeighbors > 0;
      if (!supported) wetlandUnsupported += 1;
    } else if (biome === 'ice_cap') {
      iceCells += 1;
      if (temperature > 3) warmIce += 1;
    }

    const elevationAboveSea = layers.elevation[cell] - world.seaLevel;
    const mountainousTerrain = relief >= 0.13 || elevationAboveSea >= 0.38;
    if (biome === 'mountain') legacyMountainBiomeCells += 1;
    if (mountainousTerrain) {
      mountainousTerrainCells += 1;
      mountainousTerrainBiomeCounts.set(biome, (mountainousTerrainBiomeCounts.get(biome) ?? 0) + 1);
    }
  }

  const lowVarianceCutoff = percentile(varianceValues, 0.25);
  const highVarianceCutoff = percentile(varianceValues, 0.75);
  const climateRegimeByCell = Array<ClimateRegime>(topology.cellCount).fill('maritime');
  const regimeCounts: Record<ClimateRegime, number> = { maritime: 0, continental: 0, monsoonal: 0, arid_seasonal: 0, stable_tropical: 0 };
  const regimeVarianceTotals: Record<ClimateRegime, number> = { maritime: 0, continental: 0, monsoonal: 0, arid_seasonal: 0, stable_tropical: 0 };
  let lowVarianceCells = 0;
  let highVarianceCells = 0;

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    if (layers.water[cell]) continue;
    const variance = varianceByCell[cell];
    const waterNeighbors = waterNeighborCount(cell, layers.water, topology.neighbors);
    const regime = climateRegimeForCell(project, cell, variance, waterNeighbors, lowVarianceCutoff, highVarianceCutoff);
    climateRegimeByCell[cell] = regime;
    regimeCounts[regime] += 1;
    regimeVarianceTotals[regime] += variance;
    if (variance <= lowVarianceCutoff) lowVarianceCells += 1;
    if (variance >= highVarianceCutoff) highVarianceCells += 1;
  }

  const biomeSharesOfLand: Partial<Record<Biome, number>> = {};
  const biomeMeanTemperatureVarianceProxyC: Partial<Record<Biome, number>> = {};
  for (const [biome, count] of landBiomeCounts.entries()) {
    biomeSharesOfLand[biome] = round(count / Math.max(1, landCells));
    biomeMeanTemperatureVarianceProxyC[biome] = round((biomeVarianceTotals.get(biome) ?? 0) / Math.max(1, biomeVarianceCounts.get(biome) ?? 0), 3);
  }

  const climateRegimeSharesOfLand = {} as Record<ClimateRegime, number>;
  const climateRegimeMeanTemperatureVarianceProxyC = {} as Record<ClimateRegime, number>;
  for (const regime of Object.keys(regimeCounts) as ClimateRegime[]) {
    climateRegimeSharesOfLand[regime] = round(regimeCounts[regime] / Math.max(1, landCells));
    climateRegimeMeanTemperatureVarianceProxyC[regime] = round(regimeVarianceTotals[regime] / Math.max(1, regimeCounts[regime]), 3);
  }

  const findings: string[] = [];
  const desertHighWetnessShare = desertHighWetness / Math.max(1, desertCells);
  const rainforestLowWetnessShare = rainforestLowWetness / Math.max(1, rainforestCells);
  const forestExtremeColdShare = forestExtremeCold / Math.max(1, forestCells);
  const wetlandUnsupportedShare = wetlandUnsupported / Math.max(1, wetlandCells);
  const warmIceShare = warmIce / Math.max(1, iceCells);
  const legacyMountainBiomeShare = legacyMountainBiomeCells / Math.max(1, landCells);
  const mountainousTerrainShareOfLand = mountainousTerrainCells / Math.max(1, landCells);
  const mountainousTerrainBiomeShares: Partial<Record<Biome, number>> = {};
  for (const [biome, count] of mountainousTerrainBiomeCounts.entries()) mountainousTerrainBiomeShares[biome] = round(count / Math.max(1, mountainousTerrainCells));
  const isolatedShare = isolatedCells / Math.max(1, landCells);
  const tinyPatchShare = tinyPatchCells / Math.max(1, landCells);

  if (desertCells > 0 && desertHighWetnessShare > 0.08) findings.push('A material share of desert cells are wetter than the current desert classification should normally support.');
  if (rainforestCells > 0 && rainforestLowWetnessShare > 0.08) findings.push('A material share of rainforest cells have weak wetness support.');
  if (wetlandCells > 0 && wetlandUnsupportedShare > 0.05) findings.push('Some wetland cells lack strong wetness, river, lake, or coastal support.');
  if (iceCells > 0 && warmIceShare > 0.03) findings.push('Some ice-cap cells remain warm enough to require upstream climate or classification review.');
  if (legacyMountainBiomeCells > 0) findings.push('Legacy mountain-biome cells remain after terrain and biome separation; mountains must be represented by terrain while retaining an ecological biome.');
  if (isolatedShare > 0.08 || tinyPatchShare > 0.2) findings.push('Biome assignment contains substantial cell-scale fragmentation that may indicate threshold chatter or missing ecological cohesion.');

  const diagnostics: BiomeDiagnostics = {
    modelVersion: 'biome-diagnostics-v3',
    landCellCount: landCells,
    marineCellCount: marineCells,
    biomeSharesOfLand,
    transitionDensity: round(transitions / Math.max(1, comparableEdges)),
    isolatedBiomeCellShare: round(isolatedShare),
    tinyPatchCellShare: round(tinyPatchShare),
    annualSeasonalTemperatureSwingC: round(annualSwingC, 3),
    landSeasonalTemperatureSwingC: round(landSwingC, 3),
    meanTemperatureVarianceProxyC: round(varianceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, varianceValues.length), 3),
    p90TemperatureVarianceProxyC: round(percentile(varianceValues, 0.9), 3),
    lowVarianceLandShare: round(lowVarianceCells / Math.max(1, landCells)),
    highVarianceLandShare: round(highVarianceCells / Math.max(1, landCells)),
    biomeMeanTemperatureVarianceProxyC,
    climateRegimeByCell,
    climateRegimeSharesOfLand,
    climateRegimeMeanTemperatureVarianceProxyC,
    desertHighWetnessShare: round(desertHighWetnessShare),
    rainforestLowWetnessShare: round(rainforestLowWetnessShare),
    forestExtremeColdShare: round(forestExtremeColdShare),
    wetlandUnsupportedShare: round(wetlandUnsupportedShare),
    warmIceShare: round(warmIceShare),
    legacyMountainBiomeShare: round(legacyMountainBiomeShare),
    mountainousTerrainShareOfLand: round(mountainousTerrainShareOfLand),
    mountainousTerrainBiomeShares,
    findings,
    notes: [
      'Climate regime metadata is deterministic and does not alter the base biome assignment.',
      'Mountain is terrain, not ecology; mountainous cells retain temperature-, moisture-, and hydrology-driven biomes.',
      'Regime thresholds use the generated world land-cell P25 and P75 temperature-variance distribution so normal presets do not collapse into saturated legacy bands.',
      'Regimes are broad modifiers: maritime, continental, monsoonal, arid seasonal, and stable tropical.',
      'This ledger does not smooth biome regions or mutate climate, terrain, water, hydrology, or feature layers.',
      'Ocean is excluded from land-biome and climate-regime shares so marine coverage remains owned by water diagnostics.',
      'Unsupported biome findings identify upstream or classification issues and must not be patched by inventing terrain, moisture, or temperature.'
    ]
  };

  const extendedWorld = world as typeof world & { deepTime?: BiomeDeepTime };
  const deepTime = extendedWorld.deepTime ?? {};
  deepTime.biomeDiagnostics = diagnostics;
  deepTime.notes?.push('Biome diagnostics now persist deterministic climate-regime metadata alongside unchanged base biome assignments.');
  extendedWorld.deepTime = deepTime;
  return diagnostics;
}
