import { Biome, CubedSphereTopology, TopologyLayers, WorldHexOverlay, WorldRegion, WorldRegionSet, codeToBiome } from '@world-forge/shared';
import { hexCoverageForLatLonBounds } from './worldHexOverlay';

type RegionAccumulator = {
  id: string;
  row: number;
  column: number;
  cellCount: number;
  area: number;
  landArea: number;
  waterArea: number;
  biomeArea: Record<Biome, number>;
  highestCell: number;
  highestElevation: number;
  largestRiverCell: number;
  largestRiverSignal: number;
};

const defaultRegionRows = 4;
const defaultRegionColumns = 8;
const radiansToDegrees = 180 / Math.PI;

export function buildWorldRegions(topology: CubedSphereTopology, layers: TopologyLayers, rows = defaultRegionRows, columns = defaultRegionColumns, hexOverlay?: WorldHexOverlay): WorldRegionSet {
  const cleanRows = Math.max(1, Math.round(rows));
  const cleanColumns = Math.max(1, Math.round(columns));
  const regions = createAccumulators(cleanRows, cleanColumns);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const latitude = topology.latitudes[cell] * radiansToDegrees;
    const longitude = topology.longitudes[cell] * radiansToDegrees;
    const row = Math.max(0, Math.min(cleanRows - 1, Math.floor(((90 - latitude) / 180) * cleanRows)));
    const column = Math.max(0, Math.min(cleanColumns - 1, Math.floor(((longitude + 180) / 360) * cleanColumns)));
    const region = regions[row * cleanColumns + column];
    const area = topology.areaWeights[cell] || 1;
    const water = layers.water[cell] === 1;
    const elevation = layers.elevation[cell] ?? 0;
    const riverSignal = layers.river[cell] ?? 0;
    const biome = codeToBiome(layers.biomes[cell]);

    region.cellCount += 1;
    region.area += area;
    if (water) {
      region.waterArea += area;
    } else {
      region.landArea += area;
      if (elevation > region.highestElevation) {
        region.highestElevation = elevation;
        region.highestCell = cell;
      }
    }
    region.biomeArea[biome] = (region.biomeArea[biome] ?? 0) + area;
    if (riverSignal > region.largestRiverSignal) {
      region.largestRiverSignal = riverSignal;
      region.largestRiverCell = cell;
    }
  }

  return {
    modelVersion: 'world-regions-v1',
    scheme: 'lat-lon-grid',
    regionLevel: 'region',
    sourceTopologyKind: topology.kind,
    sourceTopologyResolution: topology.resolution,
    rows: cleanRows,
    columns: cleanColumns,
    regions: regions.map((region) => finalizeRegion(region, topology, cleanRows, cleanColumns, hexOverlay)),
    crossRegionEntities: []
  };
}

function createAccumulators(rows: number, columns: number): RegionAccumulator[] {
  const regions: RegionAccumulator[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      regions.push({
        id: regionId(row, column),
        row,
        column,
        cellCount: 0,
        area: 0,
        landArea: 0,
        waterArea: 0,
        biomeArea: {} as Record<Biome, number>,
        highestCell: -1,
        highestElevation: -Infinity,
        largestRiverCell: -1,
        largestRiverSignal: 0
      });
    }
  }
  return regions;
}

function finalizeRegion(region: RegionAccumulator, topology: CubedSphereTopology, rows: number, columns: number, hexOverlay?: WorldHexOverlay): WorldRegion {
  const latStep = 180 / rows;
  const lonStep = 360 / columns;
  const maxLatitude = 90 - region.row * latStep;
  const minLatitude = maxLatitude - latStep;
  const minLongitude = -180 + region.column * lonStep;
  const maxLongitude = minLongitude + lonStep;
  const area = Math.max(0.000001, region.area);
  const dominantBiomes = Object.entries(region.biomeArea)
    .map(([biome, biomeArea]) => ({ biome: biome as Biome, share: round(biomeArea / area, 4) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4);
  const bounds = {
    minLatitude: round(minLatitude, 4),
    maxLatitude: round(maxLatitude, 4),
    minLongitude: round(minLongitude, 4),
    maxLongitude: round(maxLongitude, 4)
  };
  return {
    id: region.id,
    level: 'region',
    parentId: 'primary-world',
    label: `Region ${region.row + 1}-${region.column + 1}`,
    bounds,
    center: {
      latitude: round((minLatitude + maxLatitude) / 2, 4),
      longitude: round((minLongitude + maxLongitude) / 2, 4)
    },
    topologyCellCount: region.cellCount,
    areaWeight: round(region.area, 4),
    landAreaShare: round(region.landArea / area, 4),
    waterAreaShare: round(region.waterArea / area, 4),
    dominantBiomes,
    highestPoint: region.highestCell >= 0
      ? {
          topologyCellId: region.highestCell,
          latitude: round(topology.latitudes[region.highestCell] * radiansToDegrees, 4),
          longitude: round(topology.longitudes[region.highestCell] * radiansToDegrees, 4),
          elevation: round(region.highestElevation, 6)
        }
      : null,
    largestRiver: region.largestRiverCell >= 0 && region.largestRiverSignal > 0
      ? {
          topologyCellId: region.largestRiverCell,
          latitude: round(topology.latitudes[region.largestRiverCell] * radiansToDegrees, 4),
          longitude: round(topology.longitudes[region.largestRiverCell] * radiansToDegrees, 4),
          signal: round(region.largestRiverSignal, 6)
      }
      : null,
    hexCoverage: hexOverlay ? [hexCoverageForLatLonBounds(hexOverlay, bounds, 'world-60mi')] : undefined,
    neighborRegionIds: neighborRegionIds(region.row, region.column, rows, columns),
    subdivision: {
      scheme: 'lat-lon-grid',
      childLevel: 'subregion',
      recommendedRows: 4,
      recommendedColumns: 4
    }
  };
}

function neighborRegionIds(row: number, column: number, rows: number, columns: number): string[] {
  const ids = new Set<string>();
  if (row > 0) ids.add(regionId(row - 1, column));
  if (row < rows - 1) ids.add(regionId(row + 1, column));
  ids.add(regionId(row, (column + columns - 1) % columns));
  ids.add(regionId(row, (column + 1) % columns));
  return [...ids];
}

function regionId(row: number, column: number): string {
  return `region-r${String(row + 1).padStart(2, '0')}-c${String(column + 1).padStart(2, '0')}`;
}

function round(value: number, places = 2): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
