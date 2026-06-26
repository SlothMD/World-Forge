import JSZip from 'jszip';
import {
  Biome,
  HexTile,
  HexTileBiome,
  HexTileExportConfig,
  HexTileFeature,
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

export function projectToJson(project: WorldProject): string {
  return JSON.stringify(serializeProject(project), null, 2);
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
  const polygons = tileMap.tiles.map((tile) => {
    const cx = originX + tile.q * hexWidth + (tile.r % 2) * (hexWidth / 2);
    const cy = originY + tile.r * radius * 1.5;
    const points = hexPoints(cx, cy, radius).map(([x, y]) => `${roundSvg(x)},${roundSvg(y)}`).join(' ');
    const color = colors[tile.morphology] ?? colors[tile.biome] ?? '#7f8d77';
    const featureClass = tile.features.length ? ` data-features="${escapeXml(tile.features.join(' '))}"` : '';
    return `<polygon points="${points}" fill="${color}" stroke="#1c292b" stroke-width="${roundSvg(Math.max(0.4, radius * 0.035))}" opacity="0.9" data-q="${tile.q}" data-r="${tile.r}" data-terrain="${escapeXml(tile.terrainType)}"${featureClass} />`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${roundSvg(width)} ${roundSvg(height)}" role="img" aria-label="${escapeXml(project.projectName)} hex tile export">`,
    `<title>${escapeXml(project.projectName)} Hex Tile Grid</title>`,
    `<desc>Seed ${escapeXml(project.seed)}. Derived ${tileMap.dimensions.width} by ${tileMap.dimensions.height} pointy-top hex grid using ${escapeXml(tileMap.profile.label)}.</desc>`,
    ...polygons,
    '</svg>'
  ].join('');
}

export function exportHexTileMapJson(project: WorldProject, config: Partial<HexTileExportConfig> = {}): string {
  return JSON.stringify(generateHexTileMap(project, config), null, 2);
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

export async function exportWforge(project: WorldProject): Promise<Blob> {
  const zip = new JSZip();
  const serialized = serializeProject(project);
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
  zip.file('project.json', JSON.stringify(serialized, null, 2));
  for (const layer of serialized.primaryWorld.layers) {
    zip.file(`layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  for (const layer of serialized.primaryWorld.topologyLayers ?? []) {
    zip.file(`topology-layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importWforge(file: File): Promise<WorldProject> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wforge package: missing project.json');
  return deserializeProject(JSON.parse(await projectFile.async('string')));
}

export function serializeProject(project: WorldProject) {
  const { diagnostics, ...serializableProject } = project;
  return {
    ...serializableProject,
    primaryWorld: {
      ...project.primaryWorld,
      layers: serializeLayers(project.primaryWorld.layers, project.primaryWorld.mapModel.resolution, project.primaryWorld.mapModel.projection),
      topologyLayers: serializeTopologyLayers(project.primaryWorld.topologyLayers, project.primaryWorld.topology),
      biomeLegend: biomeNames
    }
  };
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
  const ice = world.topologyLayers.ice[cell] === 1;
  const biome = classifyHexBiome(codeToBiome(world.topologyLayers.biomes[cell]), water, temperatureC, wetness, ice);
  const morphology = classifyHexMorphology(project, topology, cell, biome, elevation, water, river, lake);
  const features = filterFeatures(classifyHexFeatures(biome, morphology, water, river, lake, ice, wetness, temperatureC, elevation, world.seaLevel), config, profile);
  const normalizedBiome = normalizeAllowed(biome, config.enabledBiomes ?? profile.biomes, profile.biomes);
  const normalizedMorphology = normalizeAllowed(morphology, config.enabledMorphologies ?? profile.morphologies, profile.morphologies);
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
    elevation: roundData(elevation),
    temperatureC: roundData(temperatureC),
    wetness: roundData(wetness),
    water
  };
}

function classifyHexBiome(biome: Biome, water: boolean, temperatureC: number, wetness: number, ice: boolean): HexTileBiome {
  if (water) return 'marine';
  if (ice || biome === 'ice_cap' || biome === 'tundra' || temperatureC < 1) return 'tundra';
  if (biome === 'desert' || wetness < 0.24) return 'desert';
  if (biome === 'rainforest' || (temperatureC > 21 && wetness > 0.52)) return 'tropical';
  if (biome === 'grassland' || biome === 'forest' || biome === 'wetland') return wetness > 0.46 ? 'grassland' : 'plains';
  return 'plains';
}

function classifyHexMorphology(project: WorldProject, topology: ReturnType<typeof buildCubedSphereTopology>, cell: number, biome: HexTileBiome, elevation: number, water: boolean, river: number, lake: boolean): HexTileMorphology {
  if (water || biome === 'marine') {
    if (lake) return 'lake';
    return elevation < project.primaryWorld.seaLevel - 0.16 ? 'ocean' : 'coastal';
  }
  if (river > 0.62) return 'navigable-river';
  const slope = topologySlope(project.primaryWorld.topologyLayers.elevation, topology, cell);
  if (elevation > project.primaryWorld.seaLevel + 0.56 || slope > 0.22) return 'mountainous';
  if (elevation > project.primaryWorld.seaLevel + 0.24 || slope > 0.075) return 'rough';
  return 'flat';
}

function classifyHexFeatures(biome: HexTileBiome, morphology: HexTileMorphology, water: boolean, river: number, lake: boolean, ice: boolean, wetness: number, temperatureC: number, elevation: number, seaLevel: number): HexTileFeature[] {
  const features = new Set<HexTileFeature>();
  if (water) {
    if (morphology === 'coastal' || lake || wetness > 0.55) features.add('aquatic');
    if (ice || temperatureC < -5) features.add('ice');
    return [...features];
  }
  if (river > 0.12) features.add('river');
  if (river > 0.32 && wetness > 0.55 && elevation < seaLevel + 0.18) features.add('floodplain');
  if (wetness > 0.66 || lake) features.add('wet');
  if ((biome === 'grassland' && wetness > 0.52) || biome === 'tropical' || (biome === 'tundra' && wetness > 0.42)) features.add('vegetated');
  if (ice || temperatureC < -6) features.add('snow');
  return [...features];
}

function filterFeatures(features: HexTileFeature[], config: HexTileExportConfig, profile: HexTileProfile): HexTileFeature[] {
  const allowed = new Set(config.enabledFeatures ?? profile.features);
  return features.filter((feature) => allowed.has(feature));
}

function normalizeAllowed<T extends string>(value: T, allowed: T[], fallback: T[]): T {
  if (allowed.includes(value)) return value;
  return allowed[0] ?? fallback[0] ?? value;
}

function terrainTypeName(biome: HexTileBiome, morphology: HexTileMorphology): string {
  if (biome === 'marine') return capitalize(morphology);
  return `${capitalize(morphology)} ${capitalize(biome)}`;
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
    tundra: '#b6c7ad',
    grassland: '#9bbf6a',
    plains: '#d6bf72',
    desert: '#e1c76f',
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

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}
