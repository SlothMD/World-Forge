import { PrimaryWorld, WorldProject, codeToBiome, normalizeValue } from '@world-forge/shared';

export type MapTheme = {
  name: string;
  colors: Record<string, string>;
};

export type MapMode = 'biomes' | 'elevation' | 'heightmap' | 'temperature' | 'rainfall' | 'wind' | 'current';

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
    mountain: '#7b756c',
    wetland: '#5e8f76',
    river: '#d7f7ff',
    riverShadow: '#073949',
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
  const [lowElevation, highElevation] = percentileRange(world.layers.elevation, 0.02, 0.98);
  const [minTemperature, maxTemperature] = minMax(world.layers.temperature);
  const mode = visible.mode ?? (visible.heightmap ? 'elevation' : 'biomes');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = sampleIndex(x, y, width, height, worldResolution.width, worldResolution.height);
      const biome = codeToBiome(world.layers.biomes[i]);
      const elevation = normalizeValue(world.layers.elevation[i], minElevation, maxElevation);
      const color = colorForMode(world, i, x, y, width, height, biome, elevation, mode, theme, minTemperature, maxTemperature, lowElevation, highElevation);
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  if (visible.rivers) {
    drawRiverChannels(ctx, world, theme, width, height);
    drawRivers(ctx, world, theme, width, height);
  }
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
  highElevation: number
): [number, number, number] {
  if (mode === 'elevation') return heightmapColor(world, index, elevation);
  if (mode === 'heightmap') return grayscaleHeightmapColor(world.layers.elevation[index], lowElevation, highElevation);
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
  const shade = biome === 'ocean' ? 0.76 + elevation * 0.18 : 0.84 + elevation * 0.2;
  let color: [number, number, number] = [Math.round(rgb[0] * shade), Math.round(rgb[1] * shade), Math.round(rgb[2] * shade)];
  if (biome === 'mountain') {
    const ridge = mountainRidgeSignal(world, index);
    color = mix(color, [52, 49, 45], ridge * 0.45);
    if (elevation > 0.82) color = mix(color, [238, 238, 230], (elevation - 0.82) / 0.18);
  }
  if (world.layers.ice[index] && world.layers.water[index] === 0) {
    color = elevation > 0.62 ? mix(color, [255, 255, 250], 0.82) : mix(color, [230, 241, 244], 0.72);
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
    const depth = 1 - shaped;
    return mix([5, 33, 72], [48, 158, 174], 1 - depth ** 1.8);
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
  const shaped = clamp((value - 0.12) / 0.76);
  if (shaped < 0.45) return mix([218, 182, 83], [179, 168, 105], shaped / 0.45);
  return mix([179, 168, 105], [22, 115, 80], (shaped - 0.45) / 0.55);
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
    const segments = splitWrappedRiverPath(river.path, width, scaleX, scaleY);
    ctx.lineWidth = Math.max(2.4, Math.min(5.6, river.path.length / 44) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = theme.colors.riverShadow;
    ctx.globalAlpha = 0.82;
    for (const points of segments) {
      drawSmoothPath(ctx, points);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.25, Math.min(3.2, river.path.length / 70) * Math.max(scaleX, scaleY));
    ctx.strokeStyle = theme.colors.river;
    ctx.globalAlpha = 1;
    for (const points of segments) {
      drawSmoothPath(ctx, points);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRiverChannels(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme, targetWidth: number, targetHeight: number): void {
  const { width, height } = world.mapModel.resolution;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  const scale = Math.max(scaleX, scaleY);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = theme.colors.riverShadow;
  ctx.lineWidth = Math.max(1.4, 2.5 * scale);
  drawRiverChannelSegments(ctx, world, width, height, scaleX, scaleY);

  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = theme.colors.river;
  ctx.lineWidth = Math.max(0.75, 1.35 * scale);
  drawRiverChannelSegments(ctx, world, width, height, scaleX, scaleY);
  ctx.restore();
}

function drawRiverChannelSegments(
  ctx: CanvasRenderingContext2D,
  world: PrimaryWorld,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
): void {
  ctx.beginPath();
  for (let index = 0; index < world.layers.river.length; index += 1) {
    const strength = world.layers.river[index];
    if (strength <= 0.08 || world.layers.water[index] === 1) continue;
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
  const amount = clamp(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
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
