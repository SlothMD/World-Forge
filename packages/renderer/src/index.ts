import { PrimaryWorld, WorldProject, codeToBiome, normalizeValue } from '@world-forge/shared';

export type MapTheme = {
  name: string;
  colors: Record<string, string>;
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
    coastline: '#f3e6be'
  }
};

export function renderWorldToCanvas(
  canvas: HTMLCanvasElement,
  project: WorldProject,
  theme: MapTheme = cleanGameMapTheme,
  visible = { rivers: true, plates: false }
): void {
  const world = project.primaryWorld;
  const { width, height } = world.mapModel.resolution;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire canvas context');
  const image = ctx.createImageData(width, height);

  const [minElevation, maxElevation] = minMax(world.layers.elevation);
  for (let i = 0; i < world.layers.elevation.length; i += 1) {
    const biome = codeToBiome(world.layers.biomes[i]);
    const elevation = normalizeValue(world.layers.elevation[i], minElevation, maxElevation);
    const color = colorForCell(world, i, biome, elevation, theme);
    const offset = i * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  if (visible.rivers) drawRivers(ctx, world, theme);
  if (visible.plates) drawPlateOverlay(ctx, world);
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

function hexForBiome(world: PrimaryWorld, index: number, theme: MapTheme): string {
  const biome = codeToBiome(world.layers.biomes[index]);
  if (world.layers.ice[index]) return theme.colors.ice;
  if (world.layers.water[index]) {
    const shallow = world.layers.elevation[index] > world.seaLevel - 0.08;
    return shallow ? theme.colors.shelf : theme.colors.ocean;
  }
  return theme.colors[biome] ?? theme.colors.grassland;
}

function drawRivers(ctx: CanvasRenderingContext2D, world: PrimaryWorld, theme: MapTheme): void {
  const { width } = world.mapModel.resolution;
  ctx.save();
  ctx.strokeStyle = theme.colors.river;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const river of world.rivers) {
    if (river.path.length < 8) continue;
    ctx.beginPath();
    river.path.forEach((index, step) => {
      const x = index % width;
      const y = Math.floor(index / width);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineWidth = Math.max(0.7, Math.min(2.4, river.path.length / 80));
    ctx.globalAlpha = 0.88;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlateOverlay(ctx: CanvasRenderingContext2D, world: PrimaryWorld): void {
  const { width, height } = world.mapModel.resolution;
  const image = ctx.getImageData(0, 0, width, height);
  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (world.layers.plates[i] !== world.layers.plates[y * width + ((x + 1) % width)] || world.layers.plates[i] !== world.layers.plates[(y - 1) * width + x]) {
        const offset = i * 4;
        image.data[offset] = 40;
        image.data[offset + 1] = 30;
        image.data[offset + 2] = 25;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
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
