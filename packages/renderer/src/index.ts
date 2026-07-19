import { PrimaryWorld, SurfaceElevationBand, SurfaceMorphology, SurfaceStructureClassification, WorldProject, buildCubedSphereTopology, buildSurfaceStructureClassification, codeToBiome, cubedSphereCellForLonLat, layerIndex, normalizeValue, surfaceElevationBandFromCode, surfaceMorphologyFromCode } from '@world-forge/shared';

export type MapTheme = {
  name: string;
  colors: Record<string, string>;
};

export type MapMode = 'biomes' | 'elevation' | 'heightmap' | 'temperature' | 'rainfall' | 'climate-moisture' | 'climate-precipitation' | 'wetness-delta' | 'wind' | 'current' | 'water-mask' | 'sea-level' | 'water-depth' | 'slope' | 'topology-face' | 'terrain-only';
export type CoastlineTreatment = 'bare' | 'toned' | 'outlined';
export type RenderMode = 'data' | 'natural';

export type InspectionSource = 'map' | 'globe';

export type PointInspectionRecord = {
  source: InspectionSource;
  seed: string;
  projectId: string;
  generation: {
    configSeed: string;
    starSeed?: string;
    worldSeed: string;
    starPresetId?: string;
    worldPresetId?: string;
    outputResolution: { width: number; height: number };
    topologyResolution?: number;
    selectedValues: Record<string, number>;
  };
  screen?: { x: number; y: number };
  map?: { x: number; y: number };
  geo: { latitude: number; longitude: number };
  equirectangular: { x: number; y: number; index: number; width: number; height: number };
  topology: { kind: string; face: number; x: number; y: number; index: number; resolution: number };
  worldData: {
    biome: string;
    topologyBiome: string;
    climateRegime?: string;
    terrainClass: 'marine' | SurfaceMorphology;
    elevationBand: 'marine' | SurfaceElevationBand;
    elevation: number;
    topologyElevation: number;
    seaLevel: number;
    elevationRelativeToSeaLevel: number;
    topologyElevationRelativeToSeaLevel: number;
    isWater: boolean;
    isLake: boolean;
    isIce: boolean;
    permanentIce: boolean;
    elevationDrivenTreeline: boolean;
    elevationDrivenSnowline: boolean;
    temperatureC: number;
    wetness: number;
    slope: number;
    hillshade: number;
    river: number;
    plateId: number;
    topologyPlateId: number;
    volcanism: number;
  };
  renderData: {
    mode: RenderMode;
    mapMode: MapMode;
    baseBiomeColor: string;
    depthColor: string;
    sourceMatchesTopology: boolean;
    sourceToFinalColorDistance: number;
    coastalBlend: number;
    seabedTint: number;
    rockBlend: number;
    snowTint: number;
    reliefLight: number;
    elevationTint: number;
    grainNoise: number;
    hillshade: number;
    finalAlbedo: string;
    interpretation: string;
    oceanShellEnabled: boolean;
    oceanShellOpacity: number;
    atmosphereEnabled: boolean;
  };
};

export type RenderOptions = {
  rivers: boolean;
  plates: boolean;
  heightmap: boolean;
  coastlineTreatment?: CoastlineTreatment;
  renderMode?: RenderMode;
  mode?: MapMode;
  targetResolution?: {
    width: number;
    height: number;
  };
};

export const cleanGameMapTheme: MapTheme = {
  name: 'Clean Game Map',
  colors: {
    oceanDeep: '#1e4f73',
    ocean: '#2f7fa6',
    shelf: '#4f9fba',
    ice: '#eef7fb',
    tundra: '#b6c7ad',
    desert: '#d6bf72',
    grassland: '#86a95c',
    forest: '#3f7a4b',
    rainforest: '#236546',
    mountain: '#7b756c',
    wetland: '#5e8f76',
    river: '#d7f7ff',
    riverShadow: '#073949',
    coastline: '#f3e6be'
  }
};

export type DerivedRenderLayers = {
  landDistanceToWater: Float32Array;
  waterDistanceToLand: Float32Array;
  slope: Float32Array;
  hillshade: Float32Array;
  landElevationLow: number;
  landElevationHigh: number;
  surfaceElevationBand: Uint8Array;
  surfaceMorphology: Uint8Array;
  surfacePermanentIce: Uint8Array;
  surfaceTreeline: Uint8Array;
  surfaceSnowline: Uint8Array;
};

export type BiomeRenderParityDiagnostics = {
  projectedBiomeFingerprint: string;
  topologyBiomeFingerprint: string;
  naturalLandAlbedoFingerprint: string;
  landCellCount: number;
  actualIceLandShare: number;
  paleNonIceLandShare: number;
  meanNonIceColorDistanceFromIce: number;
};

const derivedLayerCache = new WeakMap<PrimaryWorld, DerivedRenderLayers>();

export function createDerivedRenderLayers(world: PrimaryWorld): DerivedRenderLayers {
  const cached = derivedLayerCache.get(world);
  if (cached) return cached;
  const { width, height } = world.mapModel.resolution;
  const [landElevationLow, landElevationHigh] = landElevationPercentileRange(world.layers.elevation, world.layers.water, 0.05, 0.98);
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const surfaceStructure = buildSurfaceStructureClassification({
    seaLevel: world.seaLevel,
    topology,
    elevation: world.topologyLayers.elevation,
    water: world.topologyLayers.water,
    temperature: world.topologyLayers.temperature,
    ice: world.topologyLayers.ice
  });
  const projectedSurface = projectSurfaceStructureLayers(world, topology, surfaceStructure);
  const derived = {
    landDistanceToWater: computeCellDistance(world.layers.water, width, height, 1),
    waterDistanceToLand: computeCellDistance(world.layers.water, width, height, 0),
    slope: computeSlopeLayer(world),
    hillshade: computeHillshadeLayer(world),
    landElevationLow,
    landElevationHigh,
    ...projectedSurface
  };
  derivedLayerCache.set(world, derived);
  return derived;
}

export function renderWorldToCanvas(
  canvas: HTMLCanvasElement,
  project: WorldProject,
  theme: MapTheme = cleanGameMapTheme,
  visible: RenderOptions = { rivers: true, plates: false, heightmap: false }
): void {
  const world = project.primaryWorld;
  const worldResolution = world.mapModel.resolution;
  const width = visible.targetResolution?.width ?? worldResolution.width;
  const height = visible.targetResolution?.height ?? worldResolution.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire canvas context');
  const image = ctx.createImageData(width, height);

  const [minElevation, maxElevation] = minMax(world.layers.elevation);
  const [lowElevation, highElevation] = percentileRange(world.layers.elevation, 0.02, 0.98);
  const [minTemperature, maxTemperature] = minMax(world.layers.temperature);
  const mode = visible.mode ?? (visible.heightmap ? 'elevation' : 'biomes');
  const renderMode = visible.renderMode ?? 'data';
  const derived = mode === 'biomes' && renderMode === 'natural' ? createDerivedRenderLayers(world) : null;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = sampleIndex(x, y, width, height, worldResolution.width, worldResolution.height);
      const biome = codeToBiome(world.layers.biomes[i]);
      const elevation = normalizeValue(world.layers.elevation[i], minElevation, maxElevation);
      const color = colorForMode(world, i, x, y, width, height, biome, elevation, mode, theme, minTemperature, maxTemperature, lowElevation, highElevation, renderMode, derived, project.seed);
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const coastlineTreatment = visible.coastlineTreatment ?? 'toned';
  if (coastlineTreatment !== 'bare' && mode === 'biomes' && renderMode === 'data') {
    drawCoastlineOverlay(ctx, world, theme, width, height, coastlineTreatment);
  }
  if (visible.rivers) {
    drawRiverChannels(ctx, world, theme, width, height, renderMode);
    drawRivers(ctx, world, theme, width, height, renderMode);
  }
  if (mode === 'wind') drawVectorFieldOverlay(ctx, world, width, height, 'wind');
  if (mode === 'current') drawVectorFieldOverlay(ctx, world, width, height, 'current');
  if (visible.plates) drawPlateOverlay(ctx, world, width, height);
}

function colorForMode(
  world: PrimaryWorld,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  biome: string,
  elevation: number,
  mode: MapMode,
  theme: MapTheme,
  minTemperature: number,
  maxTemperature: number,
  lowElevation: number,
  highElevation: number,
  renderMode: RenderMode = 'data',
  derived: DerivedRenderLayers | null = null,
  seed = ''
): [number, number, number] {
  if (mode === 'elevation') return heightmapColor(world, index, elevation);
  if (mode === 'heightmap') return grayscaleHeightmapColor(world.layers.elevation[index], lowElevation, highElevation);
  if (mode === 'temperature') return temperatureColor(normalizeValue(world.layers.temperature[index], minTemperature, maxTemperature), world.layers.water[index] === 1);
  if (mode === 'rainfall') return rainfallColor(world.layers.wetness[index], world.layers.water[index] === 1);
  if (mode === 'climate-moisture') return rainfallColor(world.layers.climateMoisture?.[index] ?? world.layers.wetness[index], world.layers.water[index] === 1);
  if (mode === 'climate-precipitation') return precipitationColor(world.layers.climatePrecipitation?.[index] ?? world.layers.wetness[index], world.layers.water[index] === 1);
  if (mode === 'wetness-delta') return wetnessDeltaColor(world.layers.climateWetnessDelta?.[index] ?? 0, world.layers.water[index] === 1);
  if (mode === 'wind') return windColor(world.layers.windX[index], world.layers.windY[index], x, y, width, height, world.layers.water[index] === 1);
  if (mode === 'current') return currentColor(world.layers.currentX[index], world.layers.currentY[index], x, y, width, height, world.layers.water[index] === 1);
  if (mode === 'water-mask') return world.layers.water[index] === 1 ? [24, 104, 171] : [219, 201, 156];
  if (mode === 'sea-level') return seaLevelRelativeColor(world, index);
  if (mode === 'water-depth') return world.layers.water[index] === 1 ? waterRamp(Math.pow(waterDepth01(world, index, 0.34), 0.58)) : [62, 76, 54];
  if (mode === 'slope') {
    const slope = derived?.slope[index] ?? createDerivedRenderLayers(world).slope[index];
    const value = Math.round(clamp(slope / 0.42) * 255);
    return [value, value, value];
  }
  if (mode === 'topology-face') return topologyFaceColorForEquirect(world, index);
  if (mode === 'terrain-only') {
    if (world.layers.water[index] === 1) return [7, 23, 39];
    const dataColor = colorForCell(world, index, biome, elevation, theme);
    const slope = derived?.slope[index] ?? createDerivedRenderLayers(world).slope[index];
    return mix(dataColor, [70, 68, 62], smoothStep(0.08, 0.32, slope) * 0.55);
  }
  if (renderMode === 'natural' && derived) return naturalViewColor(world, index, x, y, biome, theme, derived, seed);
  return colorForCell(world, index, biome, elevation, theme);
}

export function inspectWorldPoint(
  project: WorldProject,
  input: { source: InspectionSource; x: number; y: number; screen?: { x: number; y: number } },
  theme: MapTheme = cleanGameMapTheme,
  renderMode: RenderMode = 'data',
  mapMode: MapMode = 'biomes'
): PointInspectionRecord {
  const world = project.primaryWorld;
  const config = project.config as typeof project.config & {
    seeds?: { star?: string; world?: string };
    starPresetId?: string;
    worldPresetId?: string;
    topologyResolution?: number;
  };
  const { width, height } = world.mapModel.resolution;
  const x = Math.max(0, Math.min(width - 1, Math.floor(input.x)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(input.y)));
  const index = layerIndex(x, y, width);
  const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
  const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const topologyCell = cubedSphereCellForLonLat(topology, longitude, latitude);
  const topologyFaceSize = topology.resolution * topology.resolution;
  const topologyFace = Math.floor(topologyCell / topologyFaceSize);
  const topologyFaceOffset = topologyCell - topologyFace * topologyFaceSize;
  const topologyX = topologyFaceOffset % topology.resolution;
  const topologyY = Math.floor(topologyFaceOffset / topology.resolution);
  const derived = createDerivedRenderLayers(world);
  const surfaceMorphology = surfaceMorphologyFromCode(derived.surfaceMorphology[index]);
  const surfaceElevationBand = surfaceElevationBandFromCode(derived.surfaceElevationBand[index]);
  const biome = codeToBiome(world.layers.biomes[index]);
  const topologyBiome = codeToBiome(world.topologyLayers.biomes[topologyCell]);
  const deepTime = world as typeof world & {
    deepTime?: {
      biomeDiagnostics?: {
        climateRegimeByCell?: string[];
      };
    };
  };
  const climateRegime = world.topologyLayers.water[topologyCell] === 1
    ? undefined
    : deepTime.deepTime?.biomeDiagnostics?.climateRegimeByCell?.[topologyCell];
  const [lowElevation, highElevation] = percentileRange(world.layers.elevation, 0.02, 0.98);
  const baseBiomeColor = parseHex(theme.colors[biome] ?? theme.colors.grassland);
  const depth = waterDepth01(world, index, 0.34);
  const depthColor = world.layers.water[index] === 1 ? waterRamp(Math.pow(depth, 0.58)) : [0, 0, 0] as [number, number, number];
  const coastalBlend = world.layers.water[index] === 1
    ? clamp(1 - derived.waterDistanceToLand[index] / 18)
    : clamp(1 - derived.landDistanceToWater[index] / 8);
  const seabedTint = world.layers.water[index] === 1 ? clamp(1 - depth / 0.42) * coastalBlend * 0.3 : 0;
  const naturalContributions = naturalViewContributions(world, index, x, y, biome, theme, derived, project.seed);
  const finalAlbedo = mapMode === 'biomes' && renderMode === 'natural'
    ? naturalContributions.finalColor
    : colorForMode(world, index, x, y, width, height, biome, normalizeValue(world.layers.elevation[index], lowElevation, highElevation), mapMode, theme, 0, 1, lowElevation, highElevation, renderMode, derived, project.seed);
  const sourceToFinalColorDistance = colorDistance(baseBiomeColor, finalAlbedo);
  const sourceMatchesTopology = biome === topologyBiome;

  return {
    source: input.source,
    seed: project.seed,
    projectId: project.projectId,
    generation: {
      configSeed: project.config.seed,
      starSeed: config.seeds?.star,
      worldSeed: config.seeds?.world ?? project.config.seed,
      starPresetId: config.starPresetId,
      worldPresetId: config.worldPresetId,
      outputResolution: project.config.outputResolution,
      topologyResolution: config.topologyResolution,
      selectedValues: Object.fromEntries(
        Object.entries(project.selectedValues)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
          .map(([key, value]) => [key, roundNumber(value, 6)])
      )
    },
    screen: input.screen,
    map: { x, y },
    geo: { latitude: roundNumber(latitude * 180 / Math.PI, 5), longitude: roundNumber(longitude * 180 / Math.PI, 5) },
    equirectangular: { x, y, index, width, height },
    topology: { kind: world.topology.kind, face: topologyFace, x: topologyX, y: topologyY, index: topologyCell, resolution: topology.resolution },
    worldData: {
      biome,
      topologyBiome,
      climateRegime,
      terrainClass: world.layers.water[index] === 1 ? 'marine' : surfaceMorphology,
      elevationBand: world.layers.water[index] === 1 ? 'marine' : surfaceElevationBand,
      elevation: roundNumber(world.layers.elevation[index], 6),
      topologyElevation: roundNumber(world.topologyLayers.elevation[topologyCell], 6),
      seaLevel: roundNumber(world.seaLevel, 6),
      elevationRelativeToSeaLevel: roundNumber(world.layers.elevation[index] - world.seaLevel, 6),
      topologyElevationRelativeToSeaLevel: roundNumber(world.topologyLayers.elevation[topologyCell] - world.seaLevel, 6),
      isWater: world.layers.water[index] === 1,
      isLake: world.layers.lakes[index] === 1,
      isIce: world.layers.ice[index] === 1,
      permanentIce: derived.surfacePermanentIce[index] === 1,
      elevationDrivenTreeline: derived.surfaceTreeline[index] === 1,
      elevationDrivenSnowline: derived.surfaceSnowline[index] === 1,
      temperatureC: roundNumber(world.layers.temperature[index], 4),
      wetness: roundNumber(world.layers.wetness[index], 4),
      slope: roundNumber(derived.slope[index], 6),
      hillshade: roundNumber(derived.hillshade[index], 6),
      river: roundNumber(world.layers.river[index], 6),
      plateId: world.layers.plates[index],
      topologyPlateId: world.topologyLayers.plates[topologyCell],
      volcanism: roundNumber(world.topologyLayers.volcanism?.[topologyCell] ?? 0, 6)
    },
    renderData: {
      mode: renderMode,
      mapMode,
      baseBiomeColor: rgbToHex(baseBiomeColor),
      depthColor: rgbToHex(depthColor),
      sourceMatchesTopology,
      sourceToFinalColorDistance: roundNumber(sourceToFinalColorDistance, 2),
      coastalBlend: roundNumber(coastalBlend, 4),
      seabedTint: roundNumber(seabedTint, 4),
      rockBlend: roundNumber(naturalContributions.rockBlend, 4),
      snowTint: roundNumber(naturalContributions.snowTint, 4),
      reliefLight: roundNumber(naturalContributions.reliefLight, 4),
      elevationTint: roundNumber(naturalContributions.elevationTint, 4),
      grainNoise: roundNumber(naturalContributions.grainNoise, 4),
      hillshade: roundNumber(derived.hillshade[index], 4),
      finalAlbedo: rgbToHex(finalAlbedo),
      interpretation: buildInspectionInterpretation({
        source: input.source,
        biome,
        topologyBiome,
        isWater: world.layers.water[index] === 1,
        isIce: world.layers.ice[index] === 1,
        finalAlbedo,
        baseBiomeColor,
        colorDistance: sourceToFinalColorDistance,
        renderMode,
        mapMode
      }),
      oceanShellEnabled: true,
      oceanShellOpacity: 0.35,
      atmosphereEnabled: true
    }
  };
}

function naturalViewColor(
  world: PrimaryWorld,
  index: number,
  x: number,
  y: number,
  biome: string,
  theme: MapTheme,
  derived: DerivedRenderLayers,
  seed: string
): [number, number, number] {
  return naturalViewContributions(world, index, x, y, biome, theme, derived, seed).finalColor;
}

function naturalViewContributions(
  world: PrimaryWorld,
  index: number,
  x: number,
  y: number,
  biome: string,
  theme: MapTheme,
  derived: DerivedRenderLayers,
  seed: string
): {
  finalColor: [number, number, number];
  rockBlend: number;
  snowTint: number;
  reliefLight: number;
  elevationTint: number;
  grainNoise: number;
} {
  const elevation = world.layers.elevation[index];
  const landElevationRange = Math.max(0.0001, derived.landElevationHigh - derived.landElevationLow);
  const landElevation01 = clamp((elevation - derived.landElevationLow) / landElevationRange);
  const slope = derived.slope[index];
  const hillshade = derived.hillshade[index];
  const grain = deterministicGrain(x, y, seed);
  const water = world.layers.water[index] === 1;

  if (water) {
    const depth = clamp((world.seaLevel - elevation) / 0.42);
    const depthT = Math.pow(depth, 0.58);
    const waterDistance = derived.waterDistanceToLand[index];
    const coastT = clamp(1 - waterDistance / 14);
    const shallowT = clamp(1 - depth / 0.36);
    const wetlandInfluence = coastT > 0 && shallowT > 0
      ? localSemanticInfluence(world, index, 8, (candidate, candidateBiome) => world.layers.water[candidate] === 0 && candidateBiome === 'wetland') * coastT * Math.pow(shallowT, 0.85)
      : 0;
    const riverInfluence = coastT > 0 && shallowT > 0
      ? localSemanticInfluence(world, index, 9, (candidate) => world.layers.water[candidate] === 0 && world.layers.river[candidate] > 0.08) * coastT * Math.pow(shallowT, 0.75)
      : 0;
    const sedimentInfluence = clamp(wetlandInfluence * 0.8 + riverInfluence * 0.55);
    let color = waterRamp(depthT);
    const seabed = slope > 0.12 ? [65, 95, 112] as [number, number, number] : [150, 161, 130] as [number, number, number];
    color = mix(color, seabed, shallowT * coastT * 0.18);
    color = mix(color, [92, 166, 184], coastT * Math.pow(shallowT, 0.9) * 0.22);
    color = mix(color, [132, 146, 102], sedimentInfluence * 0.32);
    color = mix(color, [180, 170, 126], riverInfluence * shallowT * 0.16);
    color = mix(color, [222, 241, 245], world.layers.ice[index] ? 0.4 : 0);
    const oceanNoise = 0.012 + coastT * 0.012 + sedimentInfluence * 0.012;
    const grainNoise = 0.985 + (grain - 0.5) * oceanNoise;
    return {
      finalColor: scaleRgb(color, grainNoise),
      rockBlend: 0,
      snowTint: world.layers.ice[index] ? 0.4 : 0,
      reliefLight: 1,
      elevationTint: 1,
      grainNoise
    };
  }

  let color = parseHex(theme.colors[biome] ?? theme.colors.grassland);
  const landDistance = derived.landDistanceToWater[index];
  const coastT = clamp(1 - landDistance / 8);
  const wetness = world.layers.wetness[index];
  if (biome === 'wetland') {
    const marshBase: [number, number, number] = [91, 112, 72];
    const reed: [number, number, number] = [116, 132, 78];
    const mud: [number, number, number] = [93, 82, 57];
    color = mix(marshBase, reed, clamp((wetness - 0.52) / 0.42) * 0.5);
    color = mix(color, mud, coastT * 0.16 + smoothStep(0.78, 1, wetness) * 0.12);
  }
  const permanentIce = derived.surfacePermanentIce[index] === 1;
  const coastalMaterial = coastalMaterialColor(biome, permanentIce, wetness);
  const lowCoast = clamp((world.seaLevel + 0.08 - elevation) / 0.13);
  color = mix(color, coastalMaterial, coastT * Math.max(0.2, lowCoast) * (biome === 'wetland' ? 0.28 : 0.38));

  const morphology = surfaceMorphologyFromCode(derived.surfaceMorphology[index]);
  const morphologyRock = morphology === 'mountainous' ? 0.72 : morphology === 'rugged' ? 0.42 : morphology === 'rolling' ? 0.16 : 0;
  const rock = morphologyRock * (0.72 + smoothStep(0.48, 0.84, landElevation01) * 0.28);
  color = mix(color, [114, 109, 99], rock);
  const snowTint = permanentIce
    ? 0.82
    : derived.surfaceSnowline[index] === 1
      ? naturalSnowTintStrength({
          ice: false,
          temperatureC: world.layers.temperature[index],
          landElevation01,
          altitudeAboveSeaLevel: elevation - world.seaLevel,
          slope
        }) * 0.28
      : 0;
  color = mix(color, [232, 239, 233], snowTint);

  const relief = 0.72 + hillshade * 0.44;
  const elevationTint = 0.94 + landElevation01 * 0.1 + wetness * 0.035;
  const noiseStrength = biome === 'desert' ? 0.075 : biome === 'wetland' ? 0.034 : 0.047;
  const noise = 1 + (grain - 0.5) * noiseStrength;
  return {
    finalColor: scaleRgb(color, relief * elevationTint * noise),
    rockBlend: rock,
    snowTint,
    reliefLight: relief,
    elevationTint,
    grainNoise: noise
  };
}

function buildInspectionInterpretation(input: {
  source: InspectionSource;
  biome: string;
  topologyBiome: string;
  isWater: boolean;
  isIce: boolean;
  finalAlbedo: [number, number, number];
  baseBiomeColor: [number, number, number];
  colorDistance: number;
  renderMode: RenderMode;
  mapMode: MapMode;
}): string {
  if (input.isWater) return 'Sampled source cell is water; final color includes water-depth, coast, sediment, ice, and shell effects.';
  if (input.isIce) return 'Sampled source cell is projected ice; pale rendering is expected from the authoritative ice mask.';
  const prefix = input.biome === input.topologyBiome
    ? `Sampled projected and topology biomes both report ${input.biome}.`
    : `Projected biome is ${input.biome}; topology biome is ${input.topologyBiome}.`;
  const display = input.renderMode === 'natural' && input.mapMode === 'biomes'
    ? 'Natural View can shift the source biome color with coast material, relief lighting, rock/snow tint, and grain before globe lighting or shells.'
    : 'Data rendering should stay close to the selected source layer color.';
  const distance = input.colorDistance > 70
    ? 'The final albedo is materially different from the base biome color.'
    : 'The final albedo remains close to the base biome color.';
  const globe = input.source === 'globe'
    ? ' Globe markers sit above a lit 3D surface, so the ring can visually cover adjacent texels; use Map view or copied JSON when exact cell identity matters.'
    : '';
  return `${prefix} ${distance} ${display}${globe}`;
}

function waterRamp(t: number): [number, number, number] {
  const veryShallow: [number, number, number] = [89, 169, 188];
  const shelf: [number, number, number] = [42, 126, 164];
  const medium: [number, number, number] = [25, 84, 139];
  const deep: [number, number, number] = [9, 45, 92];
  const abyss: [number, number, number] = [4, 23, 55];
  if (t < 0.18) return mix(veryShallow, shelf, t / 0.18);
  if (t < 0.52) return mix(shelf, medium, (t - 0.18) / 0.34);
  if (t < 0.82) return mix(medium, deep, (t - 0.52) / 0.3);
  return mix(deep, abyss, (t - 0.82) / 0.18);
}

function coastalMaterialColor(biome: string, ice: boolean, wetness: number): [number, number, number] {
  if (ice || biome === 'ice_cap') return [213, 229, 229];
  if (biome === 'desert') return [205, 184, 122];
  if (biome === 'tundra') return [172, 180, 160];
  if (biome === 'wetland') return [85, 105, 68];
  if (wetness > 0.78) return [105, 122, 82];
  if (biome === 'forest' || biome === 'rainforest') return [117, 126, 82];
  return [177, 169, 112];
}

function localSemanticInfluence(world: PrimaryWorld, index: number, radius: number, predicate: (index: number, biome: string) => boolean): number {
  const { width, height } = world.mapModel.resolution;
  const x = index % width;
  const y = Math.floor(index / width);
  let best = 0;
  for (let oy = -radius; oy <= radius; oy += 1) {
    const yy = y + oy;
    if (yy < 0 || yy >= height) continue;
    for (let ox = -radius; ox <= radius; ox += 1) {
      const distance = Math.sqrt(ox * ox + oy * oy);
      if (distance > radius) continue;
      const xx = (x + ox + width) % width;
      const candidate = yy * width + xx;
      const candidateBiome = codeToBiome(world.layers.biomes[candidate]);
      if (!predicate(candidate, candidateBiome)) continue;
      best = Math.max(best, 1 - distance / Math.max(1, radius));
      if (best >= 1) return 1;
    }
  }
  return best;
}

export function analyzeBiomeRenderParity(project: WorldProject, theme: MapTheme = cleanGameMapTheme): BiomeRenderParityDiagnostics {
  const world = project.primaryWorld;
  const derived = createDerivedRenderLayers(world);
  const { width } = world.mapModel.resolution;
  const iceColor = parseHex(theme.colors.ice ?? cleanGameMapTheme.colors.ice);
  let landCellCount = 0;
  let actualIceLandCells = 0;
  let nonIceLandCells = 0;
  let paleNonIceLandCells = 0;
  let colorDistanceTotal = 0;
  let albedoHash = 2166136261;

  for (let index = 0; index < world.layers.biomes.length; index += 1) {
    if (world.layers.water[index] === 1) continue;
    landCellCount += 1;
    const biome = codeToBiome(world.layers.biomes[index]);
    const color = naturalViewColor(world, index, index % width, Math.floor(index / width), biome, theme, derived, project.seed);
    albedoHash = fingerprintByte(albedoHash, color[0]);
    albedoHash = fingerprintByte(albedoHash, color[1]);
    albedoHash = fingerprintByte(albedoHash, color[2]);
    const actualIce = derived.surfacePermanentIce[index] === 1;
    if (actualIce) actualIceLandCells += 1;
    if (actualIce || biome === 'ice_cap') continue;
    nonIceLandCells += 1;
    const maximum = Math.max(color[0], color[1], color[2]);
    const minimum = Math.min(color[0], color[1], color[2]);
    const saturation = (maximum - minimum) / Math.max(1, maximum);
    const luminance = (color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722) / 255;
    if (luminance >= 0.74 && saturation <= 0.18) paleNonIceLandCells += 1;
    colorDistanceTotal += Math.hypot(color[0] - iceColor[0], color[1] - iceColor[1], color[2] - iceColor[2]) / 441.673;
  }

  return {
    projectedBiomeFingerprint: arrayFingerprint(world.layers.biomes),
    topologyBiomeFingerprint: arrayFingerprint(world.topologyLayers.biomes),
    naturalLandAlbedoFingerprint: fingerprintHex(albedoHash),
    landCellCount,
    actualIceLandShare: actualIceLandCells / Math.max(1, landCellCount),
    paleNonIceLandShare: paleNonIceLandCells / Math.max(1, nonIceLandCells),
    meanNonIceColorDistanceFromIce: colorDistanceTotal / Math.max(1, nonIceLandCells)
  };
}

export function worldToSvg(project: WorldProject, theme: MapTheme = cleanGameMapTheme): string {
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  const cells = 96;
  const cellW = width / cells;
  const cellH = height / Math.round(cells / 2);
  const rows = Math.round(cells / 2);
  const rects: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x * cellW));
      const sy = Math.min(height - 1, Math.floor(y * cellH));
      const i = sy * width + sx;
      const color = hexForBiome(world, i, theme);
      rects.push(`<rect x="${round(x * cellW)}" y="${round(y * cellH)}" width="${round(cellW + 0.5)}" height="${round(cellH + 0.5)}" fill="${color}" />`);
    }
  }
  const rivers = world.rivers
    .filter((river) => river.path.length > 12)
    .slice(0, 48)
    .map((river) => {
      const points = river.path
        .filter((_, index) => index % 3 === 0)
        .map((index) => `${index % width},${Math.floor(index / width)}`)
        .join(' ');
      return `<polyline points="${points}" fill="none" stroke="${theme.colors.river}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />`;
    });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(project.projectName)}">`,
    `<title>${escapeXml(project.projectName)}</title>`,
    `<desc>Seed ${escapeXml(project.seed)}. Simplified SVG export from World Forge.</desc>`,
    ...rects,
    ...rivers,
    '</svg>'
  ].join('');
}

function colorForCell(world: PrimaryWorld, index: number, biome: string, elevation: number, theme: MapTheme): [number, number, number] {
  const hex = hexForBiome(world, index, theme);
  const rgb = parseHex(hex);
  const shade = biome === 'ocean' ? 0.76 + elevation * 0.18 : 0.84 + elevation * 0.2;
  let color: [number, number, number] = [Math.round(rgb[0] * shade), Math.round(rgb[1] * shade), Math.round(rgb[2] * shade)];
  if (world.layers.ice[index] && world.layers.water[index] === 0) {
    color = mix(color, [238, 246, 247], 0.78);
  }
  return color;
}

function mountainRidgeSignal(world: PrimaryWorld, index: number): number {
  const { width, height } = world.mapModel.resolution;
  const x = index % width;
  const y = Math.floor(index / width);
  const current = world.layers.elevation[index];
  const left = world.layers.elevation[y * width + ((x - 1 + width) % width)];
  const right = world.layers.elevation[y * width + ((x + 1) % width)];
  const up = world.layers.elevation[Math.max(0, y - 1) * width + x];
  const down = world.layers.elevation[Math.min(height - 1, y + 1) * width + x];
  return clamp(Math.abs(current - left) + Math.abs(current - right) + Math.abs(current - up) + Math.abs(current - down));
}

function heightmapColor(world: PrimaryWorld, index: number, elevation: number): [number, number, number] {
  const shaped = clamp((elevation - 0.08) / 0.84);
  if (world.layers.water[index]) {
    const depth = waterDepth01(world, index, 0.24);
    return mix([5, 33, 72], [48, 158, 174], (1 - depth) ** 2.4);
  }
  if (world.layers.ice[index]) return [220, 236, 241];
  if (shaped < 0.28) return mix([54, 74, 55], [126, 139, 82], shaped / 0.28);
  if (shaped < 0.68) return mix([126, 139, 82], [156, 141, 118], (shaped - 0.28) / 0.4);
  return mix([156, 141, 118], [245, 245, 240], (shaped - 0.68) / 0.32);
}

function grayscaleHeightmapColor(elevation: number, lowElevation: number, highElevation: number): [number, number, number] {
  const value = Math.round(normalizeValue(elevation, lowElevation, highElevation) * 255);
  return [value, value, value];
}

function hexForBiome(world: PrimaryWorld, index: number, theme: MapTheme): string {
  const biome = codeToBiome(world.layers.biomes[index]);
  if (world.layers.ice[index]) return theme.colors.ice;
  if (world.layers.water[index]) {
    const depth = world.seaLevel - world.layers.elevation[index];
    const shallow = depth <= 0.055;
    const deep = depth >= 0.18;
    if (deep) return theme.colors.oceanDeep;
    return shallow ? theme.colors.shelf : theme.colors.ocean;
  }
  return theme.colors[biome] ?? theme.colors.grassland;
}

function waterDepth01(world: PrimaryWorld, index: number, deepScale: number): number {
  return clamp((world.seaLevel - world.layers.elevation[index]) / deepScale);
}

function seaLevelRelativeColor(world: PrimaryWorld, index: number): [number, number, number] {
  const delta = world.layers.elevation[index] - world.seaLevel;
  if (delta < -0.22) return [6, 29, 75];
  if (delta < -0.055) return mix([23, 81, 137], [6, 29, 75], clamp((-delta - 0.055) / 0.165));
  if (delta < 0) return mix([92, 184, 194], [23, 81, 137], clamp((-delta) / 0.055));
  if (delta < 0.045) return [235, 214, 143];
  if (delta < 0.32) return mix([122, 164, 94], [126, 112, 94], clamp((delta - 0.045) / 0.275));
  return mix([126, 112, 94], [236, 236, 226], clamp((delta - 0.32) / 0.68));
}

function topologyFaceColorForEquirect(world: PrimaryWorld, index: number): [number, number, number] {
  const { width, height } = world.mapModel.resolution;
  const x = index % width;
  const y = Math.floor(index / width);
  const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
  const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
  const face = cubedSphereFaceForLonLat(longitude, latitude);
  const colors: Array<[number, number, number]> = [
    [211, 74, 74],
    [74, 145, 211],
    [92, 173, 98],
    [220, 169, 73],
    [143, 98, 199],
    [66, 184, 176]
  ];
  return colors[face] ?? [128, 128, 128];
}

function cubedSphereFaceForLonLat(longitude: number, latitude: number): number {
  const cosLat = Math.cos(latitude);
  const x = cosLat * Math.cos(longitude);
  const y = Math.sin(latitude);
  const z = cosLat * Math.sin(longitude);
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  const absZ = Math.abs(z);
  if (absX >= absY && absX >= absZ) return x >= 0 ? 0 : 1;
  if (absY >= absX && absY >= absZ) return y >= 0 ? 2 : 3;
  return z >= 0 ? 4 : 5;
}

function projectSurfaceStructureLayers(world: PrimaryWorld, topology: ReturnType<typeof buildCubedSphereTopology>, surface: SurfaceStructureClassification): Pick<DerivedRenderLayers, 'surfaceElevationBand' | 'surfaceMorphology' | 'surfacePermanentIce' | 'surfaceTreeline' | 'surfaceSnowline'> {
  const { width, height } = world.mapModel.resolution;
  const surfaceElevationBand = new Uint8Array(width * height);
  const surfaceMorphology = new Uint8Array(width * height);
  const surfacePermanentIce = new Uint8Array(width * height);
  const surfaceTreeline = new Uint8Array(width * height);
  const surfaceSnowline = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const topologyCell = cubedSphereCellForLonLat(topology, longitude, latitude);
      const index = layerIndex(x, y, width);
      surfaceElevationBand[index] = surface.elevationBandByCell[topologyCell];
      surfaceMorphology[index] = surface.morphologyByCell[topologyCell];
      surfacePermanentIce[index] = surface.permanentIceByCell[topologyCell];
      surfaceTreeline[index] = surface.elevationDrivenTreelineByCell[topologyCell];
      surfaceSnowline[index] = surface.elevationDrivenSnowlineByCell[topologyCell];
    }
  }
  return { surfaceElevationBand, surfaceMorphology, surfacePermanentIce, surfaceTreeline, surfaceSnowline };
}

function computeCellDistance(water: Uint8Array, width: number, height: number, sourceValue: 0 | 1): Float32Array {
  const distance = new Float32Array(water.length);
  distance.fill(Number.POSITIVE_INFINITY);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height !== water.length) {
    return distance;
  }
  const queue: number[] = [];
  const queued = new Uint8Array(water.length);
  let head = 0;
  for (let index = 0; index < water.length; index += 1) {
    if (water[index] !== sourceValue) continue;
    distance[index] = 0;
    queued[index] = 1;
    queue.push(index);
  }
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let oy = -1; oy <= 1; oy += 1) {
      const yy = y + oy;
      if (yy < 0 || yy >= height) continue;
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        const xx = (x + ox + width) % width;
        const next = yy * width + xx;
        if (!Number.isInteger(next) || next < 0 || next >= distance.length) continue;
        if (queued[next] === 1) continue;
        const step = ox !== 0 && oy !== 0 ? 1.414 : 1;
        const candidateDistance = distance[index] + step;
        if (candidateDistance >= distance[next]) continue;
        distance[next] = candidateDistance;
        queued[next] = 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

function computeSlopeLayer(world: PrimaryWorld): Float32Array {
  const { width, height } = world.mapModel.resolution;
  const slope = new Float32Array(world.layers.elevation.length);
  for (let y = 0; y < height; y += 1) {
    const upY = Math.max(0, y - 1);
    const downY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const index = layerIndex(x, y, width);
      const left = world.layers.elevation[layerIndex((x - 1 + width) % width, y, width)];
      const right = world.layers.elevation[layerIndex((x + 1) % width, y, width)];
      const up = world.layers.elevation[layerIndex(x, upY, width)];
      const down = world.layers.elevation[layerIndex(x, downY, width)];
      slope[index] = clamp(Math.sqrt((right - left) ** 2 + (down - up) ** 2) * 4.2);
    }
  }
  return slope;
}

function computeHillshadeLayer(world: PrimaryWorld): Float32Array {
  const { width, height } = world.mapModel.resolution;
  const hillshade = new Float32Array(world.layers.elevation.length);
  const lightX = -0.55;
  const lightY = -0.72;
  const lightZ = 0.92;
  const lightLength = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  for (let y = 0; y < height; y += 1) {
    const upY = Math.max(0, y - 1);
    const downY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const left = world.layers.elevation[layerIndex((x - 1 + width) % width, y, width)];
      const right = world.layers.elevation[layerIndex((x + 1) % width, y, width)];
      const up = world.layers.elevation[layerIndex(x, upY, width)];
      const down = world.layers.elevation[layerIndex(x, downY, width)];
      const dx = (right - left) * 5.8;
      const dy = (down - up) * 5.8;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const dot = (nx * lightX + ny * lightY + nz * lightZ) / (normalLength * lightLength);
      hillshade[layerIndex(x, y, width)] = clamp(0.5 + dot * 0.5);
    }
  }
  return hillshade;
}

function temperatureColor(value: number, water: boolean): [number, number, number] {
  const cold: [number, number, number] = water ? [35, 91, 139] : [190, 224, 231];
  const mild: [number, number, number] = water ? [63, 141, 156] : [137, 172, 88];
  const hot: [number, number, number] = water ? [79, 130, 129] : [210, 166, 83];
  return value < 0.5 ? mix(cold, mild, value * 2) : mix(mild, hot, (value - 0.5) * 2);
}

function rainfallColor(value: number, water: boolean): [number, number, number] {
  if (water) return [38, 111, 146];
  const shaped = clamp((value - 0.12) / 0.76);
  if (shaped < 0.45) return mix([218, 182, 83], [179, 168, 105], shaped / 0.45);
  return mix([179, 168, 105], [22, 115, 80], (shaped - 0.45) / 0.55);
}

function precipitationColor(value: number, water: boolean): [number, number, number] {
  if (water) return mix([26, 76, 116], [67, 145, 169], clamp(value));
  const shaped = clamp(value);
  if (shaped < 0.35) return mix([202, 172, 95], [184, 166, 120], shaped / 0.35);
  if (shaped < 0.72) return mix([184, 166, 120], [87, 145, 108], (shaped - 0.35) / 0.37);
  return mix([87, 145, 108], [27, 107, 89], (shaped - 0.72) / 0.28);
}

function wetnessDeltaColor(value: number, water: boolean): [number, number, number] {
  const delta = clampValue(value, -1, 1);
  if (water) return mix([27, 71, 104], [42, 103, 132], clamp((delta + 1) / 2));
  if (delta < -0.02) return mix([129, 80, 51], [230, 194, 111], clamp((delta + 1) / 0.98));
  if (delta > 0.02) return mix([220, 211, 170], [37, 128, 113], clamp((delta - 0.02) / 0.98));
  return [214, 207, 172];
}

function windColor(vx: number, vy: number, x: number, y: number, width: number, height: number, water: boolean): [number, number, number] {
  const magnitude = clampMagnitude(vx, vy);
  const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
  const poleward = latitude >= 0 ? vy : -vy;
  const heatTransport = normalizeValue(poleward, -0.45, 0.45);
  const stream = Math.sin((x / width) * Math.PI * 26 + vy * 9 + (y / height) * Math.PI * 5);
  const eastWest = normalizeValue(vx + stream * 0.1, -1.1, 1.1);
  const northSouth = normalizeValue(vy, -1, 1);
  const calm: [number, number, number] = water ? [32, 83, 116] : [118, 132, 100];
  const westward: [number, number, number] = water ? [45, 121, 153] : [190, 177, 109];
  const eastward: [number, number, number] = water ? [109, 185, 195] : [235, 224, 159];
  const southward: [number, number, number] = water ? [72, 148, 184] : [171, 205, 138];
  const northward: [number, number, number] = water ? [63, 101, 157] : [217, 158, 110];
  const cool: [number, number, number] = water ? [33, 82, 140] : [126, 166, 159];
  const warm: [number, number, number] = water ? [158, 184, 138] : [231, 190, 96];
  const zonal = mix(westward, eastward, eastWest);
  const meridional = mix(southward, northward, northSouth);
  return mix(mix(mix(zonal, meridional, Math.min(0.55, Math.abs(vy) * 0.75)), mix(cool, warm, heatTransport), 0.44), calm, 1 - magnitude);
}

function currentColor(vx: number, vy: number, x: number, y: number, width: number, height: number, water: boolean): [number, number, number] {
  if (!water) return [110, 139, 89];
  const magnitude = clampMagnitude(vx, vy);
  const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
  const poleward = latitude >= 0 ? vy : -vy;
  const heatTransport = normalizeValue(poleward, -0.42, 0.42);
  const curlTexture = Math.sin((x / width) * Math.PI * 18 + vy * 6) * Math.cos((y / height) * Math.PI * 10 + vx * 6);
  const direction = normalizeValue(vx - vy * 0.75 + curlTexture * 0.12, -1.12, 1.12);
  const cold: [number, number, number] = [10, 49, 89];
  const fast: [number, number, number] = [94, 181, 197];
  const northSouth: [number, number, number] = vy < 0 ? [45, 92, 153] : [56, 157, 176];
  const calm: [number, number, number] = [22, 77, 116];
  const coldTransport: [number, number, number] = [26, 99, 178];
  const warmTransport: [number, number, number] = [217, 112, 66];
  return mix(mix(mix(mix(cold, fast, direction), northSouth, Math.min(0.42, Math.abs(vy) * 0.65)), mix(coldTransport, warmTransport, heatTransport), 0.5), calm, 1 - magnitude);
}

function drawVectorFieldOverlay(ctx: CanvasRenderingContext2D, world: PrimaryWorld, targetWidth: number, targetHeight: number, kind: 'wind' | 'current'): void {
  const { width, height } = world.mapModel.resolution;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  const step = Math.max(kind === 'current' ? 18 : 22, Math.round(Math.min(targetWidth, targetHeight) / (kind === 'current' ? 23 : 18)));
  const sampleDivisor = kind === 'current' ? 6 : 4;
  const sampleRadiusX = Math.max(1, Math.round(step / scaleX / sampleDivisor));
  const sampleRadiusY = Math.max(1, Math.round(step / scaleY / sampleDivisor));
  const circulation = (world.climate as typeof world.climate & { basinCirculation?: { packedGyres?: Array<{ rotationSign: number }>; gyreOwner?: Int16Array } } | undefined)?.basinCirculation;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = step * 0.65; y < targetHeight; y += step) {
    for (let x = step * 0.65; x < targetWidth; x += step) {
      const sourceX = Math.min(width - 1, Math.max(0, Math.round(x / scaleX)));
      const sourceY = Math.min(height - 1, Math.max(0, Math.round(y / scaleY)));
      const sourceIndex = layerIndex(sourceX, sourceY, width);
      if (kind === 'current' && world.layers.water[sourceIndex] === 0) continue;
      const averaged = averageVector(world, sourceX, sourceY, sampleRadiusX, sampleRadiusY, kind);
      const magnitude = clampMagnitude(averaged.x, averaged.y);
      if (magnitude < 0.065) continue;
      const displayX = averaged.x;
      const displayY = -averaged.y;
      const length = step * (0.38 + Math.min(1, magnitude) * 0.52);
      const angle = Math.atan2(displayY, displayX);
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;
      const gyreId = kind === 'current' ? circulation?.gyreOwner?.[sourceIndex] ?? -1 : -1;
      const gyreTurn = gyreId >= 0 ? circulation?.packedGyres?.[gyreId]?.rotationSign ?? 0 : 0;
      const bend = kind === 'current'
        ? gyreTurn !== 0 ? gyreTurn * step * 0.105 : Math.sin((sourceX / width) * Math.PI * 4 + averaged.y * 2) * step * 0.045
        : Math.sin((sourceY / height) * Math.PI * 6 + averaged.x * 2) * step * 0.08;
      const cx = (x + x2) / 2 - Math.sin(angle) * bend;
      const cy = (y + y2) / 2 + Math.cos(angle) * bend;
      const color = flowArrowColor(world, sourceX, sourceY, averaged.x, averaged.y, kind);
      const shadow = kind === 'wind' ? 'rgba(58, 49, 26, 0.58)' : 'rgba(1, 31, 53, 0.64)';
      drawFlowArrow(ctx, x, y, cx, cy, x2, y2, angle, step, shadow, color);
    }
  }
  ctx.restore();
}

function flowArrowColor(world: PrimaryWorld, x: number, y: number, vx: number, vy: number, kind: 'wind' | 'current'): string {
  const { width, height } = world.mapModel.resolution;
  const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
  const poleward = latitude >= 0 ? vy : -vy;
  const equatorward = -poleward;
  const speed = clampMagnitude(vx, vy);
  const heatSignal = clampValue((poleward - equatorward) * 0.65 + speed * 0.12, -0.8, 0.8);
  if (kind === 'current') {
    if (heatSignal > 0.12) return 'rgba(255, 107, 64, 0.96)';
    if (heatSignal < -0.12) return 'rgba(78, 176, 255, 0.96)';
    return 'rgba(202, 248, 255, 0.95)';
  }
  const index = layerIndex(x, y, width);
  const temperature = world.layers.temperature[index] ?? 0;
  const warmAir = normalizeValue(temperature, -8, 28) * 0.6 + normalizeValue(heatSignal, -0.8, 0.8) * 0.4;
  if (warmAir > 0.58) return 'rgba(255, 207, 105, 0.94)';
  if (warmAir < 0.38) return 'rgba(155, 218, 255, 0.94)';
  return 'rgba(255, 246, 193, 0.92)';
}

function averageVector(world: PrimaryWorld, x: number, y: number, radiusX: number, radiusY: number, kind: 'wind' | 'current'): { x: number; y: number } {
  const { width, height } = world.mapModel.resolution;
  const xLayer = kind === 'wind' ? world.layers.windX : world.layers.currentX;
  const yLayer = kind === 'wind' ? world.layers.windY : world.layers.currentY;
  const circulation = kind === 'current'
    ? (world.climate as typeof world.climate & { basinCirculation?: { gyreOwner?: Int16Array } } | undefined)?.basinCirculation
    : undefined;
  const centerIndex = layerIndex(x, y, width);
  const centerOwner = circulation?.gyreOwner?.[centerIndex];
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let dy = -radiusY; dy <= radiusY; dy += radiusY) {
    const yy = Math.max(0, Math.min(height - 1, y + dy));
    for (let dx = -radiusX; dx <= radiusX; dx += radiusX) {
      const xx = (x + dx + width) % width;
      const index = layerIndex(xx, yy, width);
      if (kind === 'current') {
        if (world.layers.water[index] === 0) continue;
        if (centerOwner !== undefined && circulation?.gyreOwner?.[index] !== centerOwner) continue;
      }
      sx += xLayer[index];
      sy += yLayer[index];
      count += 1;
    }
  }
  if (count === 0) return { x: xLayer[centerIndex], y: yLayer[centerIndex] };
  return { x: sx / count, y: sy / count };
}

function drawFlowArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, angle: number, step: number, shadow: string, color: string): void {
  const width = Math.max(1.1, step * 0.055);
  for (const [stroke, lineWidth] of [[shadow, width * 2.2], [color, width]] as Array<[string, number]>) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }
  const head = Math.max(4, step * 0.16);
  ctx.fillStyle = color;
  ctx.strokeStyle = shadow;
  ctx.lineWidth = Math.max(0.8, width * 0.8);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - 0.48) * head, y2 - Math.sin(angle - 0.48) * head);
  ctx.lineTo(x2 - Math.cos(angle + 0.48) * head, y2 - Math.sin(angle + 0.48) * head);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function drawRivers(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme, targetWidth: number, targetHeight: number, renderMode: RenderMode): void {
  const { width, height } = world.mapModel.resolution;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  const natural = renderMode === 'natural';
  const shadowColor = natural ? '#123b35' : theme.colors.riverShadow;
  const channelColor = natural ? '#4f7f69' : theme.colors.river;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const river of world.rivers) {
    if (river.path.length < 8) continue;
    const visiblePath = river.path.filter((index, pathIndex) => pathIndex === 0 || world.layers.water[river.path[pathIndex - 1]] === 0);
    const segments = splitWrappedRiverPath(visiblePath, width, scaleX, scaleY);
    ctx.lineWidth = Math.max(natural ? 1.2 : 2.4, Math.min(natural ? 3.2 : 5.6, river.path.length / (natural ? 64 : 44)) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = shadowColor;
    ctx.globalAlpha = natural ? 0.42 : 0.82;
    for (const points of segments) {
      drawSmoothPath(ctx, points);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(natural ? 0.65 : 1.25, Math.min(natural ? 1.7 : 3.2, river.path.length / (natural ? 105 : 70)) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = channelColor;
    ctx.globalAlpha = natural ? 0.54 : 1;
    for (const points of segments) {
      drawSmoothPath(ctx, points);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRiverChannels(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme, targetWidth: number, targetHeight: number, renderMode: RenderMode): void {
  const { width, height } = world.mapModel.resolution;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  const scale = Math.max(scaleX, scaleY);
  const natural = renderMode === 'natural';
  const shadowColor = natural ? '#173d35' : theme.colors.riverShadow;
  const channelColor = natural ? '#5d8065' : theme.colors.river;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.globalAlpha = natural ? 0.2 : 0.62;
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = Math.max(natural ? 0.8 : 1.4, (natural ? 1.25 : 2.5) * scale);
  drawRiverChannelSegments(ctx, world, width, height, scaleX, scaleY, natural ? 0.14 : 0.08);

  ctx.globalAlpha = natural ? 0.28 : 0.86;
  ctx.strokeStyle = channelColor;
  ctx.lineWidth = Math.max(natural ? 0.45 : 0.75, (natural ? 0.72 : 1.35) * scale);
  drawRiverChannelSegments(ctx, world, width, height, scaleX, scaleY, natural ? 0.18 : 0.08);
  ctx.restore();
}

function drawCoastlineOverlay(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme, targetWidth: number, targetHeight: number, treatment: CoastlineTreatment): void {
  const { width, height } = world.mapModel.resolution;
  const image = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const coastLight = parseHex(theme.colors.coastline);
  const coastWater: [number, number, number] = [11, 47, 67];
  const outlineColor: [number, number, number] = [25, 48, 47];
  const shelfLight = parseHex(theme.colors.shelf);
  const radius = treatment === 'outlined' ? 3 : 3;

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const i = sampleIndex(x, y, targetWidth, targetHeight, width, height);
      if (!touchesOppositeWaterState(world, i, width, height, radius)) continue;
      const offset = (y * targetWidth + x) * 4;
      const current: [number, number, number] = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
      const water = world.layers.water[i] === 1;
      const immediate = touchesOppositeWaterState(world, i, width, height, 1, true);
      const near = touchesOppositeWaterState(world, i, width, height, 2);
      const target = water ? mix(coastWater, shelfLight, immediate ? 0.08 : 0.5) : coastLight;
      const amount = water
        ? immediate ? 0.52 : near ? 0.28 : 0.14
        : immediate ? 0.48 : near ? 0.28 : 0.16;
      const color = mix(current, target, amount);
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
    }
  }

  if (treatment === 'outlined') {
    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const i = sampleIndex(x, y, targetWidth, targetHeight, width, height);
        if (world.layers.water[i] === 1 || !touchesOppositeWaterState(world, i, width, height, 1, true)) continue;
        const offset = (y * targetWidth + x) * 4;
        const current: [number, number, number] = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
        const color = mix(current, outlineColor, 0.46);
        image.data[offset] = color[0];
        image.data[offset + 1] = color[1];
        image.data[offset + 2] = color[2];
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

function touchesOppositeWaterState(world: PrimaryWorld, index: number, width: number, height: number, radius = 2, cardinalOnly = false): boolean {
  const water = world.layers.water[index];
  const x = index % width;
  const y = Math.floor(index / width);
  for (let oy = -radius; oy <= radius; oy += 1) {
    const yy = y + oy;
    if (yy < 0 || yy >= height) continue;
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      if (cardinalOnly && Math.abs(ox) + Math.abs(oy) > 1) continue;
      const xx = (x + ox + width) % width;
      if (world.layers.water[yy * width + xx] !== water) return true;
    }
  }
  return false;
}

function drawRiverChannelSegments(
  ctx: CanvasRenderingContext2D,
  world: PrimaryWorld,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  minimumStrength = 0.08
): void {
  ctx.beginPath();
  for (let index = 0; index < world.layers.river.length; index += 1) {
    const strength = world.layers.river[index];
    if (strength <= minimumStrength || world.layers.water[index] === 1) continue;
    const next = downhillRiverNeighbor(world, index, width, height);
    if (next === index) continue;
    const xCell = index % width;
    const nextXCell = next % width;
    if (Math.abs(nextXCell - xCell) > 2) continue;
    const x = (index % width + 0.5) * scaleX;
    const y = (Math.floor(index / width) + 0.5) * scaleY;
    const nextX = (next % width + 0.5) * scaleX;
    const nextY = (Math.floor(next / width) + 0.5) * scaleY;
    ctx.moveTo(x, y);
    ctx.lineTo(nextX, nextY);
  }
  ctx.stroke();
}

function downhillRiverNeighbor(world: PrimaryWorld, index: number, width: number, height: number): number {
  const x = index % width;
  const y = Math.floor(index / width);
  let best = index;
  let bestScore = world.layers.elevation[index] - world.layers.river[index] * 0.04;
  for (let oy = -1; oy <= 1; oy += 1) {
    const yy = y + oy;
    if (yy < 0 || yy >= height) continue;
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const xx = (x + ox + width) % width;
      const candidate = yy * width + xx;
      if (world.layers.water[candidate] === 1) return candidate;
      if (world.layers.river[candidate] <= 0.04) continue;
      const score = world.layers.elevation[candidate] - world.layers.river[candidate] * 0.04;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
}

function splitWrappedRiverPath(
  path: number[],
  width: number,
  scaleX: number,
  scaleY: number
): Array<Array<{ x: number; y: number }>> {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  let previousX: number | undefined;

  for (const index of path) {
    const cellX = index % width;
    if (previousX !== undefined && Math.abs(cellX - previousX) > width / 2) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push({
      x: (cellX + 0.5) * scaleX,
      y: (Math.floor(index / width) + 0.5) * scaleY
    });
    previousX = cellX;
  }

  if (current.length > 1) segments.push(current);
  return segments;
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) return;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midpointX = (points[i].x + points[i + 1].x) / 2;
    const midpointY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midpointX, midpointY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawPlateOverlay(ctx: CanvasRenderingContext2D, world: PrimaryWorld, targetWidth: number, targetHeight: number): void {
  const { width, height } = world.mapModel.resolution;
  const image = ctx.getImageData(0, 0, targetWidth, targetHeight);
  for (let y = 1; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const i = sampleIndex(x, y, targetWidth, targetHeight, width, height);
      const right = sampleIndex((x + 1) % targetWidth, y, targetWidth, targetHeight, width, height);
      const up = sampleIndex(x, y - 1, targetWidth, targetHeight, width, height);
      if (world.layers.plates[i] !== world.layers.plates[right] || world.layers.plates[i] !== world.layers.plates[up]) {
        const offset = (y * targetWidth + x) * 4;
        image.data[offset] = 40;
        image.data[offset + 1] = 30;
        image.data[offset + 2] = 25;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

function sampleIndex(x: number, y: number, targetWidth: number, targetHeight: number, sourceWidth: number, sourceHeight: number): number {
  const sx = Math.min(sourceWidth - 1, Math.floor(((x + 0.5) / Math.max(1, targetWidth)) * sourceWidth));
  const sy = Math.min(sourceHeight - 1, Math.floor(((y + 0.5) / Math.max(1, targetHeight)) * sourceHeight));
  return sy * sourceWidth + sx;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const amount = clamp(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ];
}

function scaleRgb(color: [number, number, number], scale: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * scale))),
    Math.max(0, Math.min(255, Math.round(color[1] * scale))),
    Math.max(0, Math.min(255, Math.round(color[2] * scale)))
  ];
}

function rgbToHex(color: [number, number, number]): string {
  return `#${color.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function roundNumber(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function deterministicGrain(x: number, y: number, seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= Math.imul(x + 374761393, 668265263);
  h ^= Math.imul(y + 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampMagnitude(x: number, y: number): number {
  return Math.max(0, Math.min(1, Math.sqrt(x * x + y * y)));
}

function minMax(values: Float32Array): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

export function landElevationPercentileRange(values: Float32Array, water: Uint8Array, lowPercentile: number, highPercentile: number): [number, number] {
  const landValues: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (water[index] === 1 || !Number.isFinite(values[index])) continue;
    landValues.push(values[index]);
  }
  if (landValues.length === 0) return percentileRange(values, lowPercentile, highPercentile);
  landValues.sort((a, b) => a - b);
  const low = landValues[Math.max(0, Math.min(landValues.length - 1, Math.floor(landValues.length * lowPercentile)))];
  const high = landValues[Math.max(0, Math.min(landValues.length - 1, Math.floor(landValues.length * highPercentile)))];
  return [low, high];
}

export function naturalSnowTintStrength(input: { ice: boolean; temperatureC: number; landElevation01: number; altitudeAboveSeaLevel: number; slope: number }): number {
  if (input.ice) return 1;
  const cold = 1 - smoothStep(-4, 7, input.temperatureC);
  const highland = smoothStep(0.68, 0.95, input.landElevation01);
  const exposedRelief = Math.max(
    smoothStep(0.1, 0.26, input.slope),
    smoothStep(0.26, 0.52, input.altitudeAboveSeaLevel)
  );
  return clamp(cold * highland * exposedRelief);
}

function fingerprintByte(hash: number, value: number): number {
  return Math.imul((hash ^ (Math.round(value) & 0xff)) >>> 0, 16777619) >>> 0;
}

function fingerprintHex(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function arrayFingerprint(values: ArrayLike<number>): string {
  let hash = 2166136261;
  for (let index = 0; index < values.length; index += 1) hash = fingerprintByte(hash, values[index]);
  return fingerprintHex(hash);
}

function percentileRange(values: Float32Array, lowPercentile: number, highPercentile: number): [number, number] {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const low = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * lowPercentile)))];
  const high = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * highPercentile)))];
  return low === high ? minMax(values) : [low, high];
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
