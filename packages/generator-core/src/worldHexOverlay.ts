import { Projection, WorldHexOverlay, WorldHexOverlayCoverage, WorldHexOverlayLevelId } from '@world-forge/shared';

const earthRadiusMiles = 3959;
const hexLevels: Array<{
  id: WorldHexOverlayLevelId;
  label: string;
  miles: number;
  parent?: WorldHexOverlayLevelId;
  child?: WorldHexOverlayLevelId;
}> = [
  { id: 'world-500mi', label: 'Overview hexes', miles: 500, child: 'world-60mi' },
  { id: 'world-60mi', label: 'World hexes', miles: 60, parent: 'world-500mi', child: 'regional-24mi' },
  { id: 'regional-24mi', label: 'Regional hexes', miles: 24, parent: 'world-60mi', child: 'local-6mi' },
  { id: 'local-6mi', label: 'Local hexes', miles: 6, parent: 'regional-24mi', child: 'local-1mi' },
  { id: 'local-1mi', label: 'Detail hexes', miles: 1, parent: 'local-6mi' }
];

export function buildFlatWorldHexOverlay(sizeClass: number, projection: Projection = 'equirectangular'): WorldHexOverlay {
  const circumference = planetCircumferenceMiles(sizeClass);
  return {
    modelVersion: 'flat-equirectangular-hex-overlay-v1',
    scheme: 'flat-equirectangular-pointy-odd-r',
    projection,
    planetCircumferenceMiles: round(circumference, 2),
    levels: hexLevels.map((level) => {
      const dimensions = flatHexDimensions(circumference, level.miles);
      return {
        id: level.id,
        label: level.label,
        nominalHexWidthMiles: level.miles,
        orientation: 'pointy-top-odd-r',
        parentLevelId: level.parent,
        childLevelId: level.child,
        dimensions,
        idFormat: `${level.id}:q{q}:r{r}`
      };
    })
  };
}

export function hexCoverageForLatLonBounds(
  overlay: WorldHexOverlay,
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number },
  levelId: WorldHexOverlayLevelId = 'world-60mi'
): WorldHexOverlayCoverage {
  const level = overlay.levels.find((entry) => entry.id === levelId) ?? overlay.levels[0];
  const { columns, rows } = level.dimensions;
  const minLon = normalizeLongitude(bounds.minLongitude);
  const maxLon = normalizeLongitude(bounds.maxLongitude);
  const wrapsLongitude = minLon > maxLon;
  const qMin = longitudeToColumn(minLon, columns);
  const qMax = longitudeToColumn(maxLon, columns);
  const rMin = latitudeToRow(bounds.maxLatitude, rows);
  const rMax = latitudeToRow(bounds.minLatitude, rows);
  return {
    levelId: level.id,
    qMin,
    qMax,
    rMin: Math.min(rMin, rMax),
    rMax: Math.max(rMin, rMax),
    wrapsLongitude
  };
}

function flatHexDimensions(circumferenceMiles: number, hexWidthMiles: number): { columns: number; rows: number } {
  const columns = Math.max(1, Math.round(circumferenceMiles / hexWidthMiles));
  const verticalSpacingMiles = hexWidthMiles * Math.sqrt(3) / 2;
  const rows = Math.max(1, Math.round((circumferenceMiles / 2) / verticalSpacingMiles));
  return { columns, rows };
}

function planetCircumferenceMiles(sizeClass: number): number {
  return Math.PI * 2 * earthRadiusMiles * Math.max(0.1, sizeClass);
}

function longitudeToColumn(longitude: number, columns: number): number {
  return Math.max(0, Math.min(columns - 1, Math.floor(((longitude + 180) / 360) * columns)));
}

function latitudeToRow(latitude: number, rows: number): number {
  return Math.max(0, Math.min(rows - 1, Math.floor(((90 - Math.max(-90, Math.min(90, latitude))) / 180) * rows)));
}

function normalizeLongitude(longitude: number): number {
  let value = longitude;
  while (value < -180) value += 360;
  while (value > 180) value -= 360;
  return value;
}

function round(value: number, places = 2): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
