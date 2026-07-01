import JSZip from 'jszip';
import {
  Biome,
  HexTile,
  HexTileBiome,
  HexTileEdge,
  HexTileExportConfig,
  HexTileFeature,
  HexTileFeatureDetail,
  HexTileMap,
  HexTileMorphology,
  HexTileProfile,
  MapLayers,
  SerializableLayer,
  SerializableTopologyLayer,
  TopologyLayers,
  WorldProject,
  biomeNames,
  buildCubedSphereTopology,
  civ7StyleHexTileProfile,
  codeToBiome,
  cubedSphereCellForLonLat
} from '@world-forge/shared';
import { worldToSvg } from '@world-forge/renderer';

export type VttGridKind = 'none' | 'hex-pointy';

export type VttExportConfig = {
  width: number;
  height: number;
  grid: {
    kind: VttGridKind;
    hexSizeMiles: number;
    hexSizePx?: number;
  };
};

export function projectToJson(project: WorldProject, pretty = true): string {
  return JSON.stringify(serializeProject(project), null, pretty ? 2 : undefined);
}

export function exportSvg(project: WorldProject): string {
  return worldToSvg(project);
}

export function exportHexGridSvg(project: WorldProject, config: Partial<HexTileExportConfig> = {}): string {
  const tileMap = generateHexTileMap(project, config);
  const { width, height } = project.primaryWorld.mapModel.resolution;
  const hexWidthRatio = Math.sqrt(3);
  const fitRadiusX = width / (hexWidthRatio * (tileMap.dimensions.width + 0.5));
  const fitRadiusY = height / (1.5 * Math.max(0, tileMap.dimensions.height - 1) + 2);
  const radius = Math.min(fitRadiusX, fitRadiusY);
  const hexWidth = hexWidthRatio * radius;
  const gridWidth = hexWidth * (tileMap.dimensions.width + 0.5);
  const gridHeight = radius * (1.5 * Math.max(0, tileMap.dimensions.height - 1) + 2);
  const originX = (width - gridWidth) / 2 + hexWidth / 2;
  const originY = (height - gridHeight) / 2 + radius;
  const colors = tileMapColorRamp(tileMap.profile);
  const tileById = new Map(tileMap.tiles.map((tile) => [tile.id, tile]));
  const tileGroups = tileMap.tiles.map((tile) => {
    const cx = originX + tile.q * hexWidth + (tile.r % 2) * (hexWidth / 2);
    const cy = originY + tile.r * radius * 1.5;
    const vertices = hexPoints(cx, cy, radius);
    const points = vertices.map(([x, y]) => `${roundSvg(x)},${roundSvg(y)}`).join(' ');
    const color = hexTileFillColor(tile, colors);
    const featureClass = tile.features.length ? ` data-features="${escapeXml(tile.features.join(' '))}"` : '';
    return [
      `<g data-q="${tile.q}" data-r="${tile.r}" data-terrain="${escapeXml(tile.terrainType)}"${featureClass}>`,
      `<title>${escapeXml(hexTileHoverText(tile))}</title>`,
      `<polygon points="${points}" fill="${color}" stroke="#1c292b" stroke-width="${roundSvg(Math.max(0.4, radius * 0.035))}" opacity="0.9" />`,
      ...ridgeEdgeMarks(tile, vertices, cx, cy, radius),
      ...cliffEdgeLines(tile, tileById, vertices, radius, tileMap.dimensions.width, tileMap.dimensions.height),
      ...minorRiverEdgeLines(tile, vertices, radius),
      navigableRiverCenterLine(tile, vertices, cx, cy, radius),
      terrainIcon(tile, cx, cy, radius),
      featureIcon(tile, cx, cy, radius),
      '</g>'
    ].filter(Boolean).join('');
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${roundSvg(width)} ${roundSvg(height)}" role="img" aria-label="${escapeXml(project.projectName)} hex tile export">`,
    `<title>${escapeXml(project.projectName)} Hex Tile Grid</title>`,
    `<desc>Seed ${escapeXml(project.seed)}. Derived ${tileMap.dimensions.width} by ${tileMap.dimensions.height} pointy-top hex grid using ${escapeXml(tileMap.profile.label)}.</desc>`,
    ...tileGroups,
    '</svg>'
  ].join('');
}

export function exportHexTileMapJson(project: WorldProject, config: Partial<HexTileExportConfig> = {}): string {
  return JSON.stringify(generateHexTileMap(project, config), null, 2);
}

export function exportVttMetadata(project: WorldProject, config: Partial<VttExportConfig> = {}): string {
  return JSON.stringify(generateVttMetadata(project, config), null, 2);
}

export function exportVttGridSvg(project: WorldProject, config: Partial<VttExportConfig> = {}): string {
  const resolved = resolveVttConfig(project, config);
  if (resolved.grid.kind === 'none') {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.width}" height="${resolved.height}" viewBox="0 0 ${resolved.width} ${resolved.height}" role="img" aria-label="${escapeXml(project.projectName)} VTT grid">`,
      `<title>${escapeXml(project.projectName)} VTT Grid</title>`,
      '</svg>'
    ].join('');
  }
  const hexWidth = resolved.grid.hexSizePx ?? 0;
  const radius = hexWidth / Math.sqrt(3);
  const rowStep = radius * 1.5;
  const strokeWidth = Math.max(1, Math.round(hexWidth * 0.018 * 100) / 100);
  const polygons: string[] = [];
  let row = 0;
  for (let cy = radius; cy <= resolved.height + radius; cy += rowStep) {
    const rowOffset = row % 2 === 1 ? hexWidth / 2 : 0;
    for (let cx = rowOffset; cx <= resolved.width + hexWidth; cx += hexWidth) {
      const points = hexPoints(cx, cy, radius).map(([x, y]) => `${roundSvg(x)},${roundSvg(y)}`).join(' ');
      polygons.push(`<polygon points="${points}" fill="none" stroke="#101b1f" stroke-width="${strokeWidth}" opacity="0.55" />`);
    }
    row += 1;
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.width}" height="${resolved.height}" viewBox="0 0 ${resolved.width} ${resolved.height}" role="img" aria-label="${escapeXml(project.projectName)} VTT grid">`,
    `<title>${escapeXml(project.projectName)} VTT Hex Grid</title>`,
    `<desc>Pointy-top hex overlay. Hex width ${hexWidth}px, representing ${resolved.grid.hexSizeMiles} miles.</desc>`,
    ...polygons,
    '</svg>'
  ].join('');
}

export function generateVttMetadata(project: WorldProject, config: Partial<VttExportConfig> = {}) {
  const resolved = resolveVttConfig(project, config);
  const hexWidth = resolved.grid.hexSizePx ?? 0;
  const radius = resolved.grid.kind === 'hex-pointy' ? hexWidth / Math.sqrt(3) : 0;
  const columns = resolved.grid.kind === 'hex-pointy' ? Math.ceil(resolved.width / Math.max(1, hexWidth)) : 0;
  const rows = resolved.grid.kind === 'hex-pointy' ? Math.ceil(resolved.height / Math.max(1, radius * 1.5)) : 0;
  return {
    format: 'world-forge-vtt-export',
    formatVersion: 1,
    sourceProjectId: project.projectId,
    sourceWorldId: project.primaryWorld.id,
    projectName: project.projectName,
    seed: project.seed,
    generatedAt: project.updatedAt,
    image: {
      file: `${safeFileName(project.projectName)}-vtt-map.png`,
      gridFile: resolved.grid.kind === 'none' ? null : `${safeFileName(project.projectName)}-vtt-map-grid.png`,
      width: resolved.width,
      height: resolved.height,
      projection: project.primaryWorld.mapModel.projection,
      wrapMode: project.primaryWorld.mapModel.wrapMode
    },
    grid: {
      file: resolved.grid.kind === 'none' ? null : `${safeFileName(project.projectName)}-vtt-grid.svg`,
      kind: resolved.grid.kind,
      hexSizePx: resolved.grid.kind === 'hex-pointy' ? resolved.grid.hexSizePx : null,
      hexSizeMiles: resolved.grid.kind === 'hex-pointy' ? resolved.grid.hexSizeMiles : null,
      orientation: resolved.grid.kind === 'hex-pointy' ? 'pointy-top-odd-r' : null,
      columns,
      rows
    },
    notes: [
      'VTT-agnostic package. Import the PNG as the map image, then use the metadata and optional SVG overlay to match grid settings in the target VTT.',
      'World Forge does not assume Foundry, Roll20, Owlbear Rodeo, or another platform-specific scene format in this export.'
    ]
  };
}

export function generateHexTileMap(project: WorldProject, config: Partial<HexTileExportConfig> = {}): HexTileMap {
  const profile = resolveTileProfile(config.profileId);
  const width = Math.max(1, Math.round(config.width ?? 68));
  const height = Math.max(1, Math.round(config.height ?? 44));
  const exportConfig: HexTileExportConfig = {
    width,
    height,
    profileId: profile.id,
    enabledBiomes: config.enabledBiomes?.length ? config.enabledBiomes : profile.biomes,
    enabledMorphologies: config.enabledMorphologies?.length ? config.enabledMorphologies : profile.morphologies,
    enabledFeatures: config.enabledFeatures ?? profile.features
  };
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  const tiles: HexTile[] = [];
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const longitude = ((((q + 0.5 + (r % 2) * 0.5) / width) % 1) * Math.PI * 2) - Math.PI;
      const latitude = Math.PI / 2 - ((r + 0.5) / height) * Math.PI;
      const topologyCell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const tile = classifyHexTile(project, topology, topologyCell, q, r, longitude, latitude, exportConfig, profile);
      tiles.push(tile);
    }
  }
  assignHexRiverEdges(project, tiles, width, height);
  assignHexRidgeEdges(tiles, width, height);
  return {
    format: 'world-forge-hex-tile-map',
    formatVersion: 1,
    sourceProjectId: project.projectId,
    sourceWorldId: project.primaryWorld.id,
    seed: project.seed,
    generatedAt: project.updatedAt,
    config: exportConfig,
    profile,
    dimensions: {
      width,
      height,
      orientation: 'pointy-top-odd-r',
      wrapMode: project.primaryWorld.mapModel.wrapMode
    },
    source: {
      topologyKind: project.primaryWorld.topology.kind,
      topologyResolution: project.primaryWorld.topology.resolution,
      projection: project.primaryWorld.mapModel.projection,
      mapResolution: project.primaryWorld.mapModel.resolution
    },
    legend: {
      biomes: exportConfig.enabledBiomes ?? profile.biomes,
      morphologies: exportConfig.enabledMorphologies ?? profile.morphologies,
      features: exportConfig.enabledFeatures ?? profile.features
    },
    tiles
  };
}

export async function exportWforge(project: WorldProject, options: { compressionLevel?: number; onProgress?: (percent: number) => void } = {}): Promise<Blob> {
  const zip = new JSZip();
  const layers = serializeLayers(project.primaryWorld.layers, project.primaryWorld.mapModel.resolution, project.primaryWorld.mapModel.projection);
  const topologyLayers = serializeTopologyLayers(project.primaryWorld.topologyLayers, project.primaryWorld.topology);
  const packageProject = serializeProject(project, { includeLayerData: false });
  zip.file('manifest.json', JSON.stringify({
    format: 'world-forge-project',
    formatVersion: 1,
    projectId: project.projectId,
    projectName: project.projectName,
    seed: project.seed,
    appVersion: project.appVersion,
    generatorVersion: project.generatorVersion,
    schemaVersion: 1,
    layerFiles: Object.keys(project.primaryWorld.layers).map((name) => `layers/${name}.json`),
    topologyLayerFiles: Object.keys(project.primaryWorld.topologyLayers ?? {}).map((name) => `topology-layers/${name}.json`)
  }, null, 2));
  zip.file('project.json', JSON.stringify(packageProject));
  for (const layer of layers) {
    zip.file(`layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  for (const layer of topologyLayers) {
    zip.file(`topology-layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: options.compressionLevel ?? 1 }
  }, (metadata) => {
    options.onProgress?.(metadata.percent / 100);
  });
}

export async function importWforge(file: File): Promise<WorldProject> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wforge package: missing project.json');
  const serialized = JSON.parse(await projectFile.async('string'));
  if (!Array.isArray(serialized.primaryWorld?.layers) || serialized.primaryWorld.layers.length === 0) {
    serialized.primaryWorld.layers = await readPackageLayers<SerializableLayer>(zip, 'layers');
  }
  if (!Array.isArray(serialized.primaryWorld?.topologyLayers) || serialized.primaryWorld.topologyLayers.length === 0) {
    serialized.primaryWorld.topologyLayers = await readPackageLayers<SerializableTopologyLayer>(zip, 'topology-layers');
  }
  return deserializeProject(serialized);
}

export function serializeProject(project: WorldProject, options: { includeLayerData?: boolean } = {}) {
  const { diagnostics, ...serializableProject } = project;
  const includeLayerData = options.includeLayerData ?? true;
  return {
    ...serializableProject,
    primaryWorld: {
      ...project.primaryWorld,
      layers: includeLayerData ? serializeLayers(project.primaryWorld.layers, project.primaryWorld.mapModel.resolution, project.primaryWorld.mapModel.projection) : [],
      topologyLayers: includeLayerData ? serializeTopologyLayers(project.primaryWorld.topologyLayers, project.primaryWorld.topology) : [],
      biomeLegend: biomeNames
    }
  };
}

async function readPackageLayers<T extends { layerType: string }>(zip: JSZip, folder: string): Promise<T[]> {
  const files = Object.values(zip.files)
    .filter((file) => !file.dir && file.name.startsWith(`${folder}/`) && file.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(files.map(async (file) => JSON.parse(await file.async('string')) as T));
}

export function deserializeProject(serialized: any): WorldProject {
  const layerEntries = serialized.primaryWorld.layers as SerializableLayer[];
  const layers = {} as MapLayers;
  for (const layer of layerEntries) {
    if (layer.dataEncoding === 'float32-array') {
      layers[layer.layerType] = new Float32Array(layer.data) as never;
    } else if (layer.dataEncoding === 'uint16-array') {
      layers[layer.layerType] = new Uint16Array(layer.data) as never;
    } else {
      layers[layer.layerType] = new Uint8Array(layer.data) as never;
    }
  }
  const topologyLayerEntries = (serialized.primaryWorld.topologyLayers ?? []) as SerializableTopologyLayer[];
  const topologyLayers = {} as TopologyLayers;
  for (const layer of topologyLayerEntries) {
    if (layer.dataEncoding === 'float32-array') {
      topologyLayers[layer.layerType] = new Float32Array(layer.data) as never;
    } else {
      topologyLayers[layer.layerType] = layer.dataEncoding === 'uint16-array' ? new Uint16Array(layer.data) as never : new Uint8Array(layer.data) as never;
    }
  }
  return {
    ...serialized,
    primaryWorld: {
      ...serialized.primaryWorld,
      layers,
      topologyLayers
    }
  } as WorldProject;
}

function serializeLayers(layers: MapLayers, resolution: WorldProject['primaryWorld']['mapModel']['resolution'], projection: WorldProject['primaryWorld']['mapModel']['projection']): SerializableLayer[] {
  return Object.entries(layers).map(([layerType, data]) => {
    const values = Array.from(data as Float32Array | Uint8Array | Uint16Array);
    const [minValue, maxValue] = minMax(values);
    return {
      layerId: `primary-${layerType}`,
      layerType: layerType as keyof MapLayers,
      resolution,
      projection,
      dataEncoding: data instanceof Float32Array ? 'float32-array' : data instanceof Uint16Array ? 'uint16-array' : 'uint8-array',
      minValue,
      maxValue,
      units: unitsForLayer(layerType),
      data: values
    };
  });
}

function serializeTopologyLayers(layers: TopologyLayers, topology: WorldProject['primaryWorld']['topology']): SerializableTopologyLayer[] {
  if (!layers) return [];
  return Object.entries(layers).map(([layerType, data]) => {
    const values = Array.from(data as Float32Array | Uint16Array);
    const [minValue, maxValue] = minMax(values);
    return {
      layerId: `primary-topology-${layerType}`,
      layerType: layerType as keyof TopologyLayers,
      topologyKind: topology.kind,
      topologyResolution: topology.resolution,
      dataEncoding: data instanceof Float32Array ? 'float32-array' : data instanceof Uint16Array ? 'uint16-array' : 'uint8-array',
      minValue,
      maxValue,
      units: unitsForLayer(layerType),
      data: values
    };
  });
}

function minMax(values: number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function unitsForLayer(layerType: string): string | undefined {
  if (layerType === 'temperature') return 'C';
  if (layerType === 'wetness') return '0-1';
  if (layerType === 'windX' || layerType === 'windY' || layerType === 'currentX' || layerType === 'currentY') return '-1..1 vector component';
  return undefined;
}

function resolveTileProfile(profileId?: string): HexTileProfile {
  if (!profileId || profileId === civ7StyleHexTileProfile.id) return civ7StyleHexTileProfile;
  return civ7StyleHexTileProfile;
}

function classifyHexTile(
  project: WorldProject,
  topology: ReturnType<typeof buildCubedSphereTopology>,
  cell: number,
  q: number,
  r: number,
  longitude: number,
  latitude: number,
  config: HexTileExportConfig,
  profile: HexTileProfile
): HexTile {
  const world = project.primaryWorld;
  const elevation = world.topologyLayers.elevation[cell];
  const temperatureC = world.topologyLayers.temperature[cell];
  const wetness = world.topologyLayers.wetness[cell];
  const water = world.topologyLayers.water[cell] === 1;
  const river = world.topologyLayers.river[cell];
  const lake = world.topologyLayers.lakes[cell] === 1;
  const surfaceWater = water || lake;
  const ice = world.topologyLayers.ice[cell] === 1;
  const biome = classifyHexBiome(codeToBiome(world.topologyLayers.biomes[cell]), surfaceWater, lake, temperatureC, wetness, ice);
  const morphology = classifyHexMorphology(project, topology, cell, biome, elevation, surfaceWater, lake);
  const features = filterFeatures(classifyHexFeatures(biome, morphology, surfaceWater, river, lake, ice, wetness, temperatureC, elevation, world.seaLevel), config, profile);
  const featureDetails = classifyHexFeatureDetails(biome, morphology, surfaceWater, river, lake, ice, wetness, temperatureC, elevation, world.seaLevel);
  const normalizedBiome = normalizeAllowed(biome, config.enabledBiomes ?? profile.biomes, profile.biomes);
  const normalizedMorphology = normalizeAllowed(morphology, config.enabledMorphologies ?? profile.morphologies, profile.morphologies);
  const navigableRiverCenter = false;
  return {
    id: `${q},${r}`,
    q,
    r,
    longitude: roundData(longitude),
    latitude: roundData(latitude),
    topologyCell: cell,
    biome: normalizedBiome,
    morphology: normalizedMorphology,
    terrainType: terrainTypeName(normalizedBiome, normalizedMorphology),
    features,
    featureDetails,
    minorRiverEdges: [],
    navigableRiverEdges: [],
    ridgeEdges: [],
    navigableRiverCenter,
    riverStrength: roundData(river),
    elevation: roundData(elevation),
    temperatureC: roundData(temperatureC),
    wetness: roundData(wetness),
    water: surfaceWater
  };
}

function classifyHexBiome(biome: Biome, water: boolean, lake: boolean, temperatureC: number, wetness: number, ice: boolean): HexTileBiome {
  if (water || lake) return 'marine';
  if (ice || biome === 'ice_cap' || biome === 'tundra' || temperatureC < 1) return 'tundra';
  if (biome === 'desert' || wetness < 0.24) return 'desert';
  if (biome === 'rainforest' || (temperatureC > 21 && wetness > 0.52)) return 'tropical';
  if (biome === 'grassland' || biome === 'forest' || biome === 'wetland') return wetness > 0.46 ? 'grassland' : 'plains';
  return 'plains';
}

function classifyHexMorphology(project: WorldProject, topology: ReturnType<typeof buildCubedSphereTopology>, cell: number, biome: HexTileBiome, elevation: number, water: boolean, lake: boolean): HexTileMorphology {
  if (water || biome === 'marine') {
    if (lake) return 'lake';
    return elevation < project.primaryWorld.seaLevel - 0.16 ? 'ocean' : 'coastal';
  }
  const slope = topologySlope(project.primaryWorld.topologyLayers.elevation, topology, cell);
  const heightAboveSea = elevation - project.primaryWorld.seaLevel;
  if (heightAboveSea > 0.38 || slope > 0.13) return 'mountainous';
  if (heightAboveSea > 0.14 || slope > 0.045) return 'rough';
  return 'flat';
}

function classifyHexFeatures(biome: HexTileBiome, morphology: HexTileMorphology, water: boolean, river: number, lake: boolean, ice: boolean, wetness: number, temperatureC: number, elevation: number, seaLevel: number): HexTileFeature[] {
  const features = new Set<HexTileFeature>();
  if (water) {
    if (morphology === 'coastal' || lake || wetness > 0.55) features.add('aquatic');
    if (ice || temperatureC < -5) features.add('ice');
    return [...features];
  }
  if (river > 0.12 && river <= 0.62) features.add('minor-river');
  if (river > 0.62) features.add('navigable-river');
  if (river > 0.32 && wetness > 0.55 && elevation < seaLevel + 0.18) features.add('floodplain');
  if (wetness > 0.66 || lake) features.add('wet');
  if ((biome === 'grassland' && wetness > 0.52) || biome === 'tropical' || (biome === 'tundra' && wetness > 0.42)) features.add('vegetated');
  if (ice || temperatureC < -6) features.add('snow');
  return [...features];
}

function classifyHexFeatureDetails(biome: HexTileBiome, morphology: HexTileMorphology, water: boolean, river: number, lake: boolean, ice: boolean, wetness: number, temperatureC: number, elevation: number, seaLevel: number): HexTileFeatureDetail[] {
  const details = new Set<HexTileFeatureDetail>();
  if (water || biome === 'marine') {
    details.add('aquatic');
    if (ice || temperatureC < -5) details.add('ice');
    return [...details];
  }
  if (river > 0.12 || morphology === 'navigable-river') details.add('river');
  if (river > 0.32 && wetness > 0.55 && elevation < seaLevel + 0.18) details.add('floodplain');
  if (ice || temperatureC < -6) details.add('snow');
  if (biome === 'tundra' && wetness > 0.42) details.add('taiga');
  if (biome === 'tropical' && wetness > 0.68) details.add('rainforest');
  if (biome === 'tropical' && wetness > 0.5 && wetness <= 0.68) details.add('savanna-woodland');
  if (biome === 'grassland' && wetness > 0.55) details.add('forest');
  if (biome === 'plains' && wetness < 0.34) details.add('sagebrush-steppe');
  if (wetness > 0.74) details.add(temperatureC > 16 ? 'marsh' : 'bog');
  if (biome === 'desert' && river > 0.16) details.add('oasis');
  if (biome === 'desert' && wetness > 0.36) details.add('watering-hole');
  if ((morphology === 'coastal' || lake) && wetness > 0.58 && temperatureC > 18) details.add('mangrove');
  return [...details];
}

function filterFeatures(features: HexTileFeature[], config: HexTileExportConfig, profile: HexTileProfile): HexTileFeature[] {
  const allowed = new Set(config.enabledFeatures ?? profile.features);
  return features.filter((feature) => allowed.has(feature));
}

const oddRDirections: Array<{ edge: HexTileEdge; dqEven: number; drEven: number; dqOdd: number; drOdd: number; opposite: HexTileEdge }> = [
  { edge: 'e', dqEven: 1, drEven: 0, dqOdd: 1, drOdd: 0, opposite: 'w' },
  { edge: 'se', dqEven: 0, drEven: 1, dqOdd: 1, drOdd: 1, opposite: 'nw' },
  { edge: 'sw', dqEven: -1, drEven: 1, dqOdd: 0, drOdd: 1, opposite: 'ne' },
  { edge: 'w', dqEven: -1, drEven: 0, dqOdd: -1, drOdd: 0, opposite: 'e' },
  { edge: 'nw', dqEven: -1, drEven: -1, dqOdd: 0, drOdd: -1, opposite: 'se' },
  { edge: 'ne', dqEven: 0, drEven: -1, dqOdd: 1, drOdd: -1, opposite: 'sw' }
];

function assignHexRiverEdges(project: WorldProject, tiles: HexTile[], width: number, height: number): void {
  assignNamedRiverPaths(project, tiles, width, height);
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  for (const tile of tiles) {
    if (tile.water || tile.riverStrength <= 0.12) continue;
    const hasNamedRiver = tile.minorRiverEdges.length > 0 || tile.navigableRiverEdges.length > 0 || tile.navigableRiverCenter;
    const directions = oddRDirections
      .map((direction) => {
        const odd = tile.r % 2 === 1;
        const q = (tile.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
        const r = tile.r + (odd ? direction.drOdd : direction.drEven);
        const neighbor = r < 0 || r >= height ? undefined : byId.get(`${q},${r}`);
        const downhillBias = neighbor && !neighbor.water ? Math.max(0, tile.elevation - neighbor.elevation) * 0.18 : 0;
        const waterDestination = neighbor?.water ? 1 : 0;
        const score = (neighbor ? neighbor.riverStrength : 0) + downhillBias + waterDestination + (direction.edge === 'se' || direction.edge === 'sw' ? 0.015 : 0);
        return { ...direction, neighbor, score };
      })
      .filter((direction) => {
        if (!direction.neighbor) return false;
        if (direction.neighbor.water) return hasNamedRiver || tile.riverStrength > 0.24;
        const neighborHasNamedRiver = direction.neighbor.minorRiverEdges.length > 0 || direction.neighbor.navigableRiverEdges.length > 0 || direction.neighbor.navigableRiverCenter;
        const supplementalMinorDrainage = tile.riverStrength > 0.18 && direction.neighbor.riverStrength > 0.14;
        const strongOutlet = tile.riverStrength > 0.28 && direction.neighbor.riverStrength > 0.08 && tile.elevation > direction.neighbor.elevation;
        return neighborHasNamedRiver || (hasNamedRiver && direction.neighbor.riverStrength > 0.08) || supplementalMinorDrainage || strongOutlet;
      })
      .sort((a, b) => b.score - a.score);
    const connectionCount = tile.navigableRiverCenter || tile.riverStrength > 0.48 ? 2 : 1;
    for (const direction of directions.slice(0, connectionCount)) {
      if (!direction.neighbor) continue;
      const supplementalNavigable = tile.navigableRiverCenter && direction.neighbor.navigableRiverCenter;
      addRiverEdge(tile, direction.edge, supplementalNavigable);
      if (!direction.neighbor.water) addRiverEdge(direction.neighbor, direction.opposite, supplementalNavigable);
    }
  }
  pruneImplausibleRiverEndpoints(tiles, width, height);
}

function assignNamedRiverPaths(project: WorldProject, tiles: HexTile[], width: number, height: number): void {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const topology = buildCubedSphereTopology(project.primaryWorld.topology.resolution);
  for (const river of project.primaryWorld.rivers) {
    const sampledTilePath = (river.topologyPath?.length ? river.topologyPath : river.path)
      .map((index) => river.topologyPath?.length ? tileForTopologyCell(topology, index, width, height) : tileForProjectedIndex(project, index, width, height))
      .filter((tileId, index, path) => tileId !== path[index - 1]);
    const tilePath = routeHexTilePath(sampledTilePath, width, height);
    if (tilePath.length < 2) continue;
    const navigableStart = tilePath.length >= 10 ? Math.max(2, Math.floor(tilePath.length * 0.48)) : Number.POSITIVE_INFINITY;
    for (let i = 0; i < tilePath.length - 1; i += 1) {
      const from = byId.get(tilePath[i]);
      const to = byId.get(tilePath[i + 1]);
      if (!from || !to || from.id === to.id) continue;
      if (i === tilePath.length - 2) forceRiverTerminusWaterTile(to, river.terminus);
      const direction = directionBetweenTiles(from, to, width);
      if (!direction) continue;
      if (from.water && to.water) continue;
      const navigable = i >= navigableStart;
      if (!from.water) addRiverEdge(from, direction.edge, navigable);
      if (!to.water) addRiverEdge(to, direction.opposite, navigable);
      if (navigable) {
        if (!from.water) from.navigableRiverCenter = true;
        if (!to.water) to.navigableRiverCenter = true;
      }
    }
  }
}

function forceRiverTerminusWaterTile(tile: HexTile, terminus: WorldProject['primaryWorld']['rivers'][number]['terminus']): void {
  if (tile.water || (terminus !== 'ocean' && terminus !== 'lake')) return;
  tile.water = true;
  tile.biome = 'marine';
  tile.morphology = terminus === 'lake' ? 'lake' : 'coastal';
  tile.terrainType = terrainTypeName(tile.biome, tile.morphology);
  tile.features = tile.features.filter((feature) => feature !== 'minor-river' && feature !== 'navigable-river');
  tile.featureDetails = [...new Set<HexTileFeatureDetail>([...tile.featureDetails.filter((feature) => feature !== 'river'), 'aquatic'])];
  tile.minorRiverEdges = [];
  tile.navigableRiverEdges = [];
  tile.navigableRiverCenter = false;
}

function routeHexTilePath(path: string[], width: number, height: number): string[] {
  if (path.length < 2) return path;
  const expanded: string[] = [path[0]];
  for (let i = 0; i < path.length - 1; i += 1) {
    const target = parseTileId(path[i + 1]);
    let current = parseTileId(expanded[expanded.length - 1]);
    for (let step = 0; step < width + height; step += 1) {
      if (current.q === target.q && current.r === target.r) break;
      current = nextHexStepToward(current, target, width, height);
      const id = `${current.q},${current.r}`;
      if (expanded[expanded.length - 1] !== id) expanded.push(id);
    }
  }
  return expanded;
}

function nextHexStepToward(from: { q: number; r: number }, target: { q: number; r: number }, width: number, height: number): { q: number; r: number } {
  const odd = from.r % 2 === 1;
  let best = from;
  let bestDistance = hexTileDistance(from, target, width);
  for (const direction of oddRDirections) {
    const q = (from.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
    const r = from.r + (odd ? direction.drOdd : direction.drEven);
    if (r < 0 || r >= height) continue;
    const candidate = { q, r };
    const distance = hexTileDistance(candidate, target, width);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function hexTileDistance(a: { q: number; r: number }, b: { q: number; r: number }, width: number): number {
  let dq = Math.abs(a.q - b.q);
  dq = Math.min(dq, width - dq);
  const dr = Math.abs(a.r - b.r);
  return dq + dr + Math.max(dq, dr) * 0.25;
}

function parseTileId(id: string): { q: number; r: number } {
  const [q, r] = id.split(',').map(Number);
  return { q, r };
}

function tileForTopologyCell(topology: ReturnType<typeof buildCubedSphereTopology>, cell: number, width: number, height: number): string {
  const longitude = topology.longitudes[cell];
  const latitude = topology.latitudes[cell];
  const r = Math.max(0, Math.min(height - 1, Math.floor((0.5 - latitude / Math.PI) * height)));
  const q = Math.round((((longitude + Math.PI) / (Math.PI * 2)) * width) - 0.5 - (r % 2) * 0.5);
  return `${(q + width) % width},${r}`;
}

function tileForProjectedIndex(project: WorldProject, index: number, width: number, height: number): string {
  const mapWidth = project.primaryWorld.mapModel.resolution.width;
  const mapHeight = project.primaryWorld.mapModel.resolution.height;
  const x = index % mapWidth;
  const y = Math.floor(index / mapWidth);
  const r = Math.max(0, Math.min(height - 1, Math.floor((y / Math.max(1, mapHeight)) * height)));
  const q = Math.round((x / Math.max(1, mapWidth)) * width - 0.5 - (r % 2) * 0.5);
  return `${(q + width) % width},${r}`;
}

function directionBetweenTiles(from: HexTile, to: HexTile, width: number): { edge: HexTileEdge; opposite: HexTileEdge } | undefined {
  const odd = from.r % 2 === 1;
  for (const direction of oddRDirections) {
    const q = (from.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
    const r = from.r + (odd ? direction.drOdd : direction.drEven);
    if (q === to.q && r === to.r) return direction;
  }
  return undefined;
}

function addRiverEdge(tile: HexTile, edge: HexTileEdge, navigable: boolean): void {
  if (navigable) {
    if (!tile.navigableRiverEdges.includes(edge)) tile.navigableRiverEdges.push(edge);
    tile.navigableRiverCenter = true;
    tile.morphology = 'navigable-river';
    tile.terrainType = terrainTypeName(tile.biome, tile.morphology);
    return;
  }
  if (!tile.minorRiverEdges.includes(edge)) tile.minorRiverEdges.push(edge);
}

function pruneImplausibleRiverEndpoints(tiles: HexTile[], width: number, height: number): void {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const tile of tiles) {
      if (tile.water) continue;
      const edges = uniqueRiverEdges(tile);
      if (edges.length === 0) {
        if (tile.navigableRiverCenter) {
          tile.navigableRiverCenter = false;
          changed = true;
        }
        continue;
      }
      if (edges.length > 1) continue;
      const edge = edges[0];
      const neighbor = neighborTile(tile, edge, byId, width, height);
      if (neighbor?.water || isPlausibleRiverSource(tile)) continue;
      removeRiverEdge(tile, edge);
      if (neighbor) removeRiverEdge(neighbor, oppositeEdge(edge));
      changed = true;
    }
    if (!changed) break;
  }
}

function uniqueRiverEdges(tile: HexTile): HexTileEdge[] {
  return [...new Set([...tile.minorRiverEdges, ...tile.navigableRiverEdges])];
}

function isPlausibleRiverSource(tile: HexTile): boolean {
  return tile.morphology === 'rough' || tile.morphology === 'mountainous' || tile.elevation > 0.42;
}

function removeRiverEdge(tile: HexTile, edge: HexTileEdge): void {
  tile.minorRiverEdges = tile.minorRiverEdges.filter((candidate) => candidate !== edge);
  tile.navigableRiverEdges = tile.navigableRiverEdges.filter((candidate) => candidate !== edge);
  if (tile.navigableRiverEdges.length === 0 && tile.minorRiverEdges.length === 0) tile.navigableRiverCenter = false;
}

function neighborTile(tile: HexTile, edge: HexTileEdge, tiles: Map<string, HexTile>, width: number, height: number): HexTile | undefined {
  const direction = oddRDirections.find((candidate) => candidate.edge === edge);
  if (!direction) return undefined;
  const odd = tile.r % 2 === 1;
  const q = (tile.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
  const r = tile.r + (odd ? direction.drOdd : direction.drEven);
  return r < 0 || r >= height ? undefined : tiles.get(`${q},${r}`);
}

function oppositeEdge(edge: HexTileEdge): HexTileEdge {
  return oddRDirections.find((direction) => direction.edge === edge)?.opposite ?? edge;
}

function assignHexRidgeEdges(tiles: HexTile[], width: number, height: number): void {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  for (const tile of tiles) {
    if (tile.water) continue;
    for (const direction of oddRDirections) {
      const odd = tile.r % 2 === 1;
      const q = (tile.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
      const r = tile.r + (odd ? direction.drOdd : direction.drEven);
      const neighbor = r < 0 || r >= height ? undefined : byId.get(`${q},${r}`);
      if (!neighbor || neighbor.water) continue;
      const elevationDelta = Math.abs(tile.elevation - neighbor.elevation);
      const highRelief = tile.morphology === 'mountainous' || neighbor.morphology === 'mountainous';
      if (elevationDelta < (highRelief ? 0.05 : 0.085)) continue;
      if (!tile.ridgeEdges.includes(direction.edge)) tile.ridgeEdges.push(direction.edge);
      if (!neighbor.ridgeEdges.includes(direction.opposite)) neighbor.ridgeEdges.push(direction.opposite);
    }
  }
}

function normalizeAllowed<T extends string>(value: T, allowed: T[], fallback: T[]): T {
  if (allowed.includes(value)) return value;
  return allowed[0] ?? fallback[0] ?? value;
}

function terrainTypeName(biome: HexTileBiome, morphology: HexTileMorphology): string {
  if (biome === 'marine') return capitalize(morphology);
  return `${capitalize(morphology)} ${capitalize(biome)}`;
}

const drawableEdgeDirections = new Set<HexTileEdge>(['e', 'se', 'sw']);

function hexTileHoverText(tile: HexTile): string {
  const features = tile.features.length ? tile.features.join(', ') : 'none';
  const featureDetails = tile.featureDetails.length ? tile.featureDetails.join(', ') : 'none';
  const minorRivers = tile.minorRiverEdges.length ? tile.minorRiverEdges.join(', ') : 'none';
  const navigableRivers = tile.navigableRiverEdges.length ? tile.navigableRiverEdges.join(', ') : 'none';
  const ridges = tile.ridgeEdges.length ? tile.ridgeEdges.join(', ') : 'none';
  return [
    `${tile.id} - ${tile.terrainType}`,
    `Biome: ${tile.biome}`,
    `Morphology: ${tile.morphology}`,
    `Features: ${features}`,
    `Feature details: ${featureDetails}`,
    `Elevation: ${tile.elevation}`,
    `Wetness: ${tile.wetness}`,
    `Temperature: ${tile.temperatureC} C`,
    `Minor river edges: ${minorRivers}`,
    `Navigable river edges: ${navigableRivers}`,
    `Ridges: ${ridges}`,
    `Navigable river center: ${tile.navigableRiverCenter ? 'yes' : 'no'}`
  ].join('\n');
}

function terrainIcon(tile: HexTile, cx: number, cy: number, radius: number): string {
  if (tile.water) return '';
  if (tile.morphology === 'mountainous') {
    const size = radius * 0.34;
    const points = [
      [cx, cy - size * 0.78],
      [cx + size * 0.82, cy + size * 0.66],
      [cx - size * 0.82, cy + size * 0.66]
    ].map(([x, y]) => `${roundSvg(x)},${roundSvg(y)}`).join(' ');
    return `<polygon points="${points}" fill="#f1efe2" stroke="#3f3a32" stroke-width="${roundSvg(Math.max(0.5, radius * 0.035))}" opacity="0.88" />`;
  }
  if (tile.morphology === 'rough') {
    return `<circle cx="${roundSvg(cx)}" cy="${roundSvg(cy)}" r="${roundSvg(radius * 0.18)}" fill="none" stroke="#514b40" stroke-width="${roundSvg(Math.max(0.5, radius * 0.04))}" opacity="0.82" />`;
  }
  return '';
}

function featureIcon(tile: HexTile, cx: number, cy: number, radius: number): string {
  if (!tile.features.includes('ice') && !tile.features.includes('snow')) return '';
  const size = radius * 0.28;
  const stroke = Math.max(0.6, radius * 0.035);
  const arms = [
    [cx - size, cy, cx + size, cy],
    [cx, cy - size, cx, cy + size],
    [cx - size * 0.72, cy - size * 0.72, cx + size * 0.72, cy + size * 0.72],
    [cx - size * 0.72, cy + size * 0.72, cx + size * 0.72, cy - size * 0.72]
  ];
  return arms.map(([x1, y1, x2, y2]) => `<line x1="${roundSvg(x1)}" y1="${roundSvg(y1)}" x2="${roundSvg(x2)}" y2="${roundSvg(y2)}" stroke="#f5fbff" stroke-width="${roundSvg(stroke)}" stroke-linecap="round" opacity="0.9" />`).join('');
}

function navigableRiverCenterLine(tile: HexTile, vertices: Array<[number, number]>, cx: number, cy: number, radius: number): string {
  if (!tile.navigableRiverCenter) return '';
  const width = Math.max(1.75, radius * 0.3);
  const edges = tile.navigableRiverEdges.length ? tile.navigableRiverEdges : ['nw', 'se'] as HexTileEdge[];
  return edges.map((edge) => {
    const [[x1, y1], [x2, y2]] = edgeSegment(vertices, edge);
    const ex = (x1 + x2) / 2;
    const ey = (y1 + y2) / 2;
    const path = `M ${roundSvg(ex)} ${roundSvg(ey)} Q ${roundSvg((ex + cx) / 2 + (cy - ey) * 0.06)} ${roundSvg((ey + cy) / 2 + (ex - cx) * 0.06)}, ${roundSvg(cx)} ${roundSvg(cy)}`;
    return `<path d="${path}" fill="none" stroke="#d5f4f8" stroke-width="${roundSvg(width * 2.4)}" stroke-linecap="round" opacity="0.75" /><path d="${path}" fill="none" stroke="#2f7f9c" stroke-width="${roundSvg(width * 1.15)}" stroke-linecap="round" opacity="0.95" />`;
  }).join('');
}

function minorRiverEdgeLines(tile: HexTile, vertices: Array<[number, number]>, radius: number): string[] {
  return tile.minorRiverEdges.map((edge) => {
    const [[x1, y1], [x2, y2]] = edgeSegment(vertices, edge);
    const width = Math.max(1.05, radius * 0.065);
    return `<line x1="${roundSvg(x1)}" y1="${roundSvg(y1)}" x2="${roundSvg(x2)}" y2="${roundSvg(y2)}" stroke="#e1fbff" stroke-width="${roundSvg(width * 2.15)}" stroke-linecap="round" opacity="0.88" /><line x1="${roundSvg(x1)}" y1="${roundSvg(y1)}" x2="${roundSvg(x2)}" y2="${roundSvg(y2)}" stroke="#2c7e98" stroke-width="${roundSvg(width)}" stroke-linecap="round" opacity="0.98" />`;
  });
}

function cliffEdgeLines(tile: HexTile, tiles: Map<string, HexTile>, vertices: Array<[number, number]>, radius: number, width: number, height: number): string[] {
  if (tile.water) return [];
  const lines: string[] = [];
  for (const direction of oddRDirections) {
    if (!drawableEdgeDirections.has(direction.edge)) continue;
    const odd = tile.r % 2 === 1;
    const q = (tile.q + (odd ? direction.dqOdd : direction.dqEven) + width) % width;
    const r = tile.r + (odd ? direction.drOdd : direction.drEven);
    const neighbor = r < 0 || r >= height ? undefined : tiles.get(`${q},${r}`);
    if (!neighbor || neighbor.water) continue;
    const elevationDelta = Math.abs(tile.elevation - neighbor.elevation);
    if (elevationDelta < 0.075) continue;
    const [[x1, y1], [x2, y2]] = edgeSegment(vertices, direction.edge);
    lines.push(`<line x1="${roundSvg(x1)}" y1="${roundSvg(y1)}" x2="${roundSvg(x2)}" y2="${roundSvg(y2)}" stroke="#2c241d" stroke-width="${roundSvg(Math.max(1, radius * 0.085))}" stroke-dasharray="${roundSvg(Math.max(1.2, radius * 0.08))} ${roundSvg(Math.max(1.4, radius * 0.06))}" stroke-linecap="butt" opacity="0.9" />`);
  }
  return lines;
}

function ridgeEdgeMarks(tile: HexTile, vertices: Array<[number, number]>, cx: number, cy: number, radius: number): string[] {
  return tile.ridgeEdges
    .filter((edge) => drawableEdgeDirections.has(edge))
    .map((edge) => {
      const [[x1, y1], [x2, y2]] = edgeSegment(vertices, edge);
      const marks: string[] = [];
      for (let i = 1; i <= 4; i += 1) {
        const t = i / 5;
        const ax = lerpNumber(x1, x2, t - 0.045);
        const ay = lerpNumber(y1, y2, t - 0.045);
        const bx = lerpNumber(x1, x2, t + 0.045);
        const by = lerpNumber(y1, y2, t + 0.045);
        const mx = lerpNumber((ax + bx) / 2, cx, 0.28);
        const my = lerpNumber((ay + by) / 2, cy, 0.28);
        marks.push(`<path d="M ${roundSvg(ax)} ${roundSvg(ay)} Q ${roundSvg(mx)} ${roundSvg(my)}, ${roundSvg(bx)} ${roundSvg(by)}" fill="none" stroke="#3d3127" stroke-width="${roundSvg(Math.max(0.75, radius * 0.04))}" stroke-linecap="round" opacity="0.92" />`);
      }
      return marks.join('');
    });
}

function hexTileFillColor(tile: HexTile, colors: Record<string, string>): string {
  if (tile.water || tile.biome === 'marine') return colors[tile.morphology] ?? colors.marine ?? '#2f7fa6';
  return colors[tile.biome] ?? colors[tile.morphology] ?? '#7f8d77';
}

function edgeSegment(vertices: Array<[number, number]>, edge: HexTileEdge): [[number, number], [number, number]] {
  const edgeIndices: Record<HexTileEdge, [number, number]> = {
    ne: [0, 1],
    e: [1, 2],
    se: [2, 3],
    sw: [3, 4],
    w: [4, 5],
    nw: [5, 0]
  };
  const [a, b] = edgeIndices[edge];
  return [vertices[a], vertices[b]];
}

function topologySlope(elevation: Float32Array, topology: ReturnType<typeof buildCubedSphereTopology>, cell: number): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < 4; i += 1) {
    const neighbor = topology.neighbors[cell * 4 + i];
    if (neighbor < 0) continue;
    total += Math.abs(elevation[cell] - elevation[neighbor]);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

function tileMapColorRamp(profile: HexTileProfile): Record<string, string> {
  void profile;
  return {
    marine: '#2f7fa6',
    tundra: '#c8d6c7',
    grassland: '#9bbf6a',
    plains: '#c8b873',
    desert: '#e3c76b',
    tropical: '#3c8b5f',
    flat: '#9bbf6a',
    rough: '#a99a72',
    mountainous: '#7f7a70',
    'navigable-river': '#8fc9d4',
    coastal: '#4f9fba',
    ocean: '#1e4f73',
    lake: '#6fb2be'
  };
}

function resolveVttConfig(project: WorldProject, config: Partial<VttExportConfig>): VttExportConfig {
  const resolution = project.primaryWorld.mapModel.resolution;
  const width = Math.max(64, Math.round(config.width ?? resolution.width));
  const height = Math.max(64, Math.round(config.height ?? resolution.height));
  const kind = config.grid?.kind ?? 'hex-pointy';
  const hexSizeMiles = Math.max(50, Math.round(config.grid?.hexSizeMiles ?? 1200));
  const earthRadiusMiles = 3959;
  const circumferenceMiles = Math.PI * 2 * earthRadiusMiles * Math.max(0.1, project.primaryWorld.sizeClass);
  const milesPerPixel = circumferenceMiles / width;
  const requestedHexPx = Math.round(hexSizeMiles / Math.max(0.0001, milesPerPixel));
  return {
    width,
    height,
    grid: {
      kind,
      hexSizeMiles: kind === 'none' ? 0 : hexSizeMiles,
      hexSizePx: kind === 'none' ? 0 : Math.max(8, requestedHexPx)
    }
  };
}

function hexPoints(cx: number, cy: number, radius: number): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

function capitalize(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function roundData(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function roundSvg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function lerpNumber(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-');
}
