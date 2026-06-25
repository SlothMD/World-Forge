import { PrimaryWorld, WorldProject, codeToBiome, normalizeValue } from '@world-forge/shared';

export type MapTheme = {
  name: string;
  colors: Record<string, string>;
};

export type MapMode = 'biomes' | 'elevation' | 'temperature' | 'rainfall' | 'wind' | 'current';

export type RenderOptions = {
  rivers: boolean;
  plates: boolean;
  heightmap: boolean;
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
    shelf: '#65a9bd',
    ice: '#eef7fb',
    tundra: '#b6c7ad',
    desert: '#d6bf72',
    grassland: '#86a95c',
    forest: '#3f7a4b',
    rainforest: '#236546',
    mountain: '#8b8377',
    wetland: '#5e8f76',
    river: '#a7e3ff',
    riverShadow: '#15556c',
    coastline: '#f3e6be'
  }
};

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
  const [minTemperature, maxTemperature] = minMax(world.layers.temperature);
  const mode = visible.mode ?? (visible.heightmap ? 'elevation' : 'biomes');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = sampleIndex(x, y, width, height, worldResolution.width, worldResolution.height);
      const biome = codeToBiome(world.layers.biomes[i]);
      const elevation = normalizeValue(world.layers.elevation[i], minElevation, maxElevation);
      const color = colorForMode(world, i, x, y, width, height, biome, elevation, mode, theme, minTemperature, maxTemperature);
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  if (visible.rivers) drawRivers(ctx, world, theme, width, height);
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
  maxTemperature: number
): [number, number, number] {
  if (mode === 'elevation') return heightmapColor(world, index, elevation);
  if (mode === 'temperature') return temperatureColor(normalizeValue(world.layers.temperature[index], minTemperature, maxTemperature), world.layers.water[index] === 1);
  if (mode === 'rainfall') return rainfallColor(world.layers.wetness[index], world.layers.water[index] === 1);
  if (mode === 'wind') return windColor(world.layers.windX[index], world.layers.windY[index], x, y, width, height, world.layers.water[index] === 1);
  if (mode === 'current') return currentColor(world.layers.currentX[index], world.layers.currentY[index], x, y, width, height, world.layers.water[index] === 1);
  return colorForCell(world, index, biome, elevation, theme);
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
    `<desc>Seed ${escapeXml(project.seed)}. Simplified SVG export from World Forge MVP.</desc>`,
    ...rects,
    ...rivers,
    '</svg>'
  ].join('');
}

function colorForCell(world: PrimaryWorld, index: number, biome: string, elevation: number, theme: MapTheme): [number, number, number] {
  const hex = hexForBiome(world, index, theme);
  const rgb = parseHex(hex);
  const shade = biome === 'ocean' ? 0.76 + elevation * 0.18 : 0.86 + elevation * 0.22;
  return [Math.round(rgb[0] * shade), Math.round(rgb[1] * shade), Math.round(rgb[2] * shade)];
}

function heightmapColor(world: PrimaryWorld, index: number, elevation: number): [number, number, number] {
  if (world.layers.water[index]) {
    const blue = Math.round(80 + elevation * 90);
    return [24, Math.max(60, blue - 20), blue];
  }
  const value = Math.round(58 + elevation * 178);
  if (world.layers.ice[index]) return [220, 236, 241];
  return [value, value, value];
}

function hexForBiome(world: PrimaryWorld, index: number, theme: MapTheme): string {
  const biome = codeToBiome(world.layers.biomes[index]);
  if (world.layers.ice[index]) return theme.colors.ice;
  if (world.layers.water[index]) {
    const shallow = world.layers.elevation[index] > world.seaLevel - 0.08;
    const deep = world.layers.elevation[index] < world.seaLevel - 0.34;
    if (deep) return theme.colors.oceanDeep;
    return shallow ? theme.colors.shelf : theme.colors.ocean;
  }
  return theme.colors[biome] ?? theme.colors.grassland;
}

function temperatureColor(value: number, water: boolean): [number, number, number] {
  const cold: [number, number, number] = water ? [35, 91, 139] : [190, 224, 231];
  const mild: [number, number, number] = water ? [63, 141, 156] : [137, 172, 88];
  const hot: [number, number, number] = water ? [79, 130, 129] : [210, 166, 83];
  return value < 0.5 ? mix(cold, mild, value * 2) : mix(mild, hot, (value - 0.5) * 2);
}

function rainfallColor(value: number, water: boolean): [number, number, number] {
  if (water) return [38, 111, 146];
  return mix([205, 178, 94], [40, 112, 77], value);
}

function windColor(vx: number, vy: number, x: number, y: number, width: number, height: number, water: boolean): [number, number, number] {
  const magnitude = clampMagnitude(vx, vy);
  const stream = Math.sin((x / width) * Math.PI * 26 + vy * 8 + (y / height) * Math.PI * 5);
  const direction = normalizeValue(vx + stream * 0.18, -1.18, 1.18);
  const calm: [number, number, number] = water ? [33, 92, 124] : [128, 140, 100];
  const westward: [number, number, number] = water ? [50, 129, 154] : [205, 191, 118];
  const eastward: [number, number, number] = water ? [105, 184, 196] : [231, 224, 170];
  return mix(mix(westward, eastward, direction), calm, 1 - magnitude);
}

function currentColor(vx: number, vy: number, x: number, y: number, width: number, height: number, water: boolean): [number, number, number] {
  if (!water) return [110, 139, 89];
  const magnitude = clampMagnitude(vx, vy);
  const curlTexture = Math.sin((x / width) * Math.PI * 18 + vy * 5) * Math.cos((y / height) * Math.PI * 10 + vx * 5);
  const direction = normalizeValue(vx - vy + curlTexture * 0.22, -1.22, 1.22);
  const cold: [number, number, number] = [10, 49, 89];
  const fast: [number, number, number] = [94, 181, 197];
  const calm: [number, number, number] = [25, 83, 123];
  return mix(mix(cold, fast, direction), calm, 1 - magnitude);
}

function drawRivers(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme, targetWidth: number, targetHeight: number): void {
  const { width, height } = world.mapModel.resolution;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  ctx.save();
  ctx.strokeStyle = theme.colors.river;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const river of world.rivers) {
    if (river.path.length < 8) continue;
    ctx.beginPath();
    river.path.forEach((index, step) => {
      const x = (index % width) * scaleX;
      const y = Math.floor(index / width) * scaleY;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineWidth = Math.max(1.6, Math.min(4.2, river.path.length / 58) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = theme.colors.riverShadow;
    ctx.globalAlpha = 0.72;
    ctx.stroke();
    ctx.lineWidth = Math.max(0.9, Math.min(2.6, river.path.length / 92) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = theme.colors.river;
    ctx.globalAlpha = 0.95;
    ctx.stroke();
  }
  ctx.restore();
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
  const sx = Math.min(sourceWidth - 1, Math.floor((x / targetWidth) * sourceWidth));
  const sy = Math.min(sourceHeight - 1, Math.floor((y / targetHeight) * sourceHeight));
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
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
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

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
