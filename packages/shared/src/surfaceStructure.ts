export const surfaceElevationBands = ['lowland', 'upland', 'highland', 'alpine'] as const;
export type SurfaceElevationBand = typeof surfaceElevationBands[number];

export const surfaceMorphologies = ['flat', 'rolling', 'rugged', 'mountainous'] as const;
export type SurfaceMorphology = typeof surfaceMorphologies[number];

export type SurfaceReliefCharacter =
  | 'Very flat'
  | 'Mostly lowland'
  | 'Rolling'
  | 'Varied'
  | 'Rugged'
  | 'Extreme relief';

export type SurfaceStructureCellInput = {
  water: boolean;
  permanentIce: boolean;
  elevationAboveSeaLevel: number;
  temperatureC: number;
  slope: number;
  localRelief: number;
};

export type SurfaceStructureCell = {
  elevationBand: SurfaceElevationBand;
  morphology: SurfaceMorphology;
  permanentIce: boolean;
  elevationDrivenTreeline: boolean;
  elevationDrivenSnowline: boolean;
};

export type SurfaceStructureInput = {
  seaLevel: number;
  topology: {
    cellCount: number;
    areaWeights: Float32Array;
    neighbors: Int32Array;
  };
  elevation: Float32Array;
  water: Uint8Array;
  temperature: Float32Array;
  ice: Uint8Array;
};

export type SurfaceStructureSummary = {
  modelVersion: 'surface-structure-v1';
  landArea: number;
  elevationBandArea: Record<SurfaceElevationBand, number>;
  morphologyArea: Record<SurfaceMorphology, number>;
  permanentIceLandArea: number;
  elevationDrivenTreelineArea: number;
  elevationDrivenSnowlineArea: number;
  highestCell: number;
  highestElevationAboveSeaLevel: number;
  highestElevationBand: SurfaceElevationBand;
  reliefCharacter: SurfaceReliefCharacter;
};

export type SurfaceStructureClassification = {
  modelVersion: 'surface-structure-v1';
  elevationBandByCell: Uint8Array;
  morphologyByCell: Uint8Array;
  permanentIceByCell: Uint8Array;
  elevationDrivenTreelineByCell: Uint8Array;
  elevationDrivenSnowlineByCell: Uint8Array;
  slopeByCell: Float32Array;
  localReliefByCell: Float32Array;
  summary: SurfaceStructureSummary;
};

const WATER_CLASS_CODE = 255;
const SEMANTIC_LAPSE_RATE_C_PER_RELATIVE_UNIT = 22;

export function surfaceElevationBandToCode(value: SurfaceElevationBand): number {
  return surfaceElevationBands.indexOf(value);
}

export function surfaceElevationBandFromCode(value: number): SurfaceElevationBand {
  return surfaceElevationBands[Math.max(0, Math.min(surfaceElevationBands.length - 1, value))];
}

export function surfaceMorphologyToCode(value: SurfaceMorphology): number {
  return surfaceMorphologies.indexOf(value);
}

export function surfaceMorphologyFromCode(value: number): SurfaceMorphology {
  return surfaceMorphologies[Math.max(0, Math.min(surfaceMorphologies.length - 1, value))];
}

export function classifySurfaceStructureCell(input: SurfaceStructureCellInput): SurfaceStructureCell {
  const elevation = Math.max(0, input.elevationAboveSeaLevel);
  const elevationBand: SurfaceElevationBand = elevation >= 0.48
    ? 'alpine'
    : elevation >= 0.28
      ? 'highland'
      : elevation >= 0.12
        ? 'upland'
        : 'lowland';
  const mountainRoughness = input.slope >= 0.105 || input.localRelief >= 0.28;
  const extremeLowReliefRoughness = input.slope >= 0.2 || input.localRelief >= 0.54;
  const ruggedRoughness = input.slope >= 0.115 || input.localRelief >= 0.31;
  const rollingRoughness = input.slope >= 0.064 || input.localRelief >= 0.2;
  const morphology: SurfaceMorphology = mountainRoughness && (elevation >= 0.12 || extremeLowReliefRoughness)
    ? 'mountainous'
    : ruggedRoughness
      ? 'rugged'
      : rollingRoughness
        ? 'rolling'
        : 'flat';
  const estimatedSeaLevelTemperatureC = input.temperatureC + elevation * SEMANTIC_LAPSE_RATE_C_PER_RELATIVE_UNIT;
  const elevationDrivenTreeline = !input.water
    && elevation >= 0.14
    && input.temperatureC <= 8
    && estimatedSeaLevelTemperatureC > 4;
  const elevationDrivenSnowline = elevationDrivenTreeline
    && elevation >= 0.24
    && input.temperatureC <= 1.5
    && estimatedSeaLevelTemperatureC > 4;
  return {
    elevationBand,
    morphology,
    permanentIce: !input.water && input.permanentIce,
    elevationDrivenTreeline,
    elevationDrivenSnowline
  };
}

export function buildSurfaceStructureClassification(input: SurfaceStructureInput): SurfaceStructureClassification {
  const cellCount = input.topology.cellCount;
  const topologyResolution = Math.max(1, Math.sqrt(cellCount / 6));
  const morphologyScale = Math.sqrt(Math.max(1, topologyResolution / 128));
  const elevationBandByCell = new Uint8Array(cellCount);
  const morphologyByCell = new Uint8Array(cellCount);
  elevationBandByCell.fill(WATER_CLASS_CODE);
  morphologyByCell.fill(WATER_CLASS_CODE);
  const permanentIceByCell = new Uint8Array(cellCount);
  const elevationDrivenTreelineByCell = new Uint8Array(cellCount);
  const elevationDrivenSnowlineByCell = new Uint8Array(cellCount);
  const slopeByCell = new Float32Array(cellCount);
  const localReliefByCell = new Float32Array(cellCount);
  const elevationBandArea = emptyElevationBandRecord();
  const morphologyArea = emptyMorphologyRecord();
  let landArea = 0;
  let permanentIceLandArea = 0;
  let elevationDrivenTreelineArea = 0;
  let elevationDrivenSnowlineArea = 0;
  let highestCell = -1;
  let highestElevationAboveSeaLevel = Number.NEGATIVE_INFINITY;
  let highestElevationBand: SurfaceElevationBand = 'lowland';

  for (let cell = 0; cell < cellCount; cell += 1) {
    if (input.water[cell] === 1) continue;
    const currentElevation = input.elevation[cell];
    const elevationAboveSeaLevel = currentElevation - input.seaLevel;
    let slopeTotal = 0;
    let neighborCount = 0;
    let minimumElevation = currentElevation;
    let maximumElevation = currentElevation;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = input.topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || input.water[neighbor] === 1) continue;
      const neighborElevation = input.elevation[neighbor];
      slopeTotal += Math.abs(currentElevation - neighborElevation);
      minimumElevation = Math.min(minimumElevation, neighborElevation);
      maximumElevation = Math.max(maximumElevation, neighborElevation);
      neighborCount += 1;
      for (let nextDirection = 0; nextDirection < 4; nextDirection += 1) {
        const next = input.topology.neighbors[neighbor * 4 + nextDirection];
        if (next < 0 || next === cell || input.water[next] === 1) continue;
        const nextElevation = input.elevation[next];
        minimumElevation = Math.min(minimumElevation, nextElevation);
        maximumElevation = Math.max(maximumElevation, nextElevation);
      }
    }
    const slope = (neighborCount > 0 ? slopeTotal / neighborCount : 0) * morphologyScale;
    const localRelief = (maximumElevation - minimumElevation) * morphologyScale;
    const classified = classifySurfaceStructureCell({
      water: false,
      permanentIce: input.ice[cell] === 1,
      elevationAboveSeaLevel,
      temperatureC: input.temperature[cell],
      slope,
      localRelief
    });
    const area = input.topology.areaWeights[cell] || 1;
    elevationBandByCell[cell] = surfaceElevationBandToCode(classified.elevationBand);
    morphologyByCell[cell] = surfaceMorphologyToCode(classified.morphology);
    permanentIceByCell[cell] = classified.permanentIce ? 1 : 0;
    elevationDrivenTreelineByCell[cell] = classified.elevationDrivenTreeline ? 1 : 0;
    elevationDrivenSnowlineByCell[cell] = classified.elevationDrivenSnowline ? 1 : 0;
    slopeByCell[cell] = slope;
    localReliefByCell[cell] = localRelief;
    landArea += area;
    elevationBandArea[classified.elevationBand] += area;
    morphologyArea[classified.morphology] += area;
    if (classified.permanentIce) permanentIceLandArea += area;
    if (classified.elevationDrivenTreeline) elevationDrivenTreelineArea += area;
    if (classified.elevationDrivenSnowline) elevationDrivenSnowlineArea += area;
    if (elevationAboveSeaLevel > highestElevationAboveSeaLevel) {
      highestCell = cell;
      highestElevationAboveSeaLevel = elevationAboveSeaLevel;
      highestElevationBand = classified.elevationBand;
    }
  }

  return {
    modelVersion: 'surface-structure-v1',
    elevationBandByCell,
    morphologyByCell,
    permanentIceByCell,
    elevationDrivenTreelineByCell,
    elevationDrivenSnowlineByCell,
    slopeByCell,
    localReliefByCell,
    summary: {
      modelVersion: 'surface-structure-v1',
      landArea,
      elevationBandArea,
      morphologyArea,
      permanentIceLandArea,
      elevationDrivenTreelineArea,
      elevationDrivenSnowlineArea,
      highestCell,
      highestElevationAboveSeaLevel: Number.isFinite(highestElevationAboveSeaLevel) ? highestElevationAboveSeaLevel : 0,
      highestElevationBand,
      reliefCharacter: classifyReliefCharacter(landArea, elevationBandArea, morphologyArea)
    }
  };
}

function classifyReliefCharacter(
  landArea: number,
  elevation: Record<SurfaceElevationBand, number>,
  morphology: Record<SurfaceMorphology, number>
): SurfaceReliefCharacter {
  const total = Math.max(0.000001, landArea);
  const lowlandShare = elevation.lowland / total;
  const highlandShare = (elevation.highland + elevation.alpine) / total;
  const alpineShare = elevation.alpine / total;
  const flatShare = morphology.flat / total;
  const rollingOrRougherShare = (morphology.rolling + morphology.rugged + morphology.mountainous) / total;
  const ruggedOrMountainousShare = (morphology.rugged + morphology.mountainous) / total;
  const mountainousShare = morphology.mountainous / total;
  if (mountainousShare >= 0.2 || ruggedOrMountainousShare >= 0.58 || alpineShare >= 0.16) return 'Extreme relief';
  if (mountainousShare >= 0.1 || ruggedOrMountainousShare >= 0.42) return 'Rugged';
  if (highlandShare >= 0.28 || ruggedOrMountainousShare >= 0.26) return 'Varied';
  if (lowlandShare >= 0.72 && flatShare >= 0.58) return 'Very flat';
  if (lowlandShare >= 0.62 && rollingOrRougherShare < 0.42) return 'Mostly lowland';
  return 'Rolling';
}

function emptyElevationBandRecord(): Record<SurfaceElevationBand, number> {
  return { lowland: 0, upland: 0, highland: 0, alpine: 0 };
}

function emptyMorphologyRecord(): Record<SurfaceMorphology, number> {
  return { flat: 0, rolling: 0, rugged: 0, mountainous: 0 };
}
