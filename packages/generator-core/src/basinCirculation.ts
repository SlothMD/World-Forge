import { clamp, type WorldProject } from '@world-forge/shared';

export type PackedGyreDiagnostic = {
  id: number;
  basinId: number;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  rotationSign: number;
  territorySize: number;
};

export type BasinCirculationDiagnostics = {
  modelVersion: 'basin-circulation-v5.1';
  marineBasinCount: number;
  largestBasinShare: number;
  coherentGyreCount: number;
  gyreCandidateCount: number;
  coastalAlignmentScore: number;
  stagnantOceanShare: number;
  meanCurrentSpeed: number;
  windTerrainDeflectionIndex: number;
  stagnantWindShare: number;
  packedGyres: PackedGyreDiagnostic[];
  gyreOwner: Int16Array;
};

type BasinGeometry = {
  size: number;
  centerX: number;
  centerY: number;
  minY: number;
  maxY: number;
  maxInteriorDistance: number;
};

type PackedGyre = {
  basinId: number;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  rotationSign: number;
  territorySize: number;
};

function indexOf(x: number, y: number, width: number): number {
  return y * width + ((x % width) + width) % width;
}

function wrappedDeltaX(x: number, centerX: number, width: number): number {
  let delta = x - centerX;
  if (delta > width / 2) delta -= width;
  if (delta < -width / 2) delta += width;
  return delta;
}

function normalizeTo(x: number, y: number, speed: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude < 1e-6) return { x: 0, y: 0 };
  return { x: x / magnitude * speed, y: y / magnitude * speed };
}

function scalarGradient(values: Float32Array, x: number, y: number, width: number, height: number): { x: number; y: number } {
  const west = values[indexOf(x - 1, y, width)];
  const east = values[indexOf(x + 1, y, width)];
  const north = values[indexOf(x, Math.max(0, y - 1), width)];
  const south = values[indexOf(x, Math.min(height - 1, y + 1), width)];
  return { x: (east - west) * 0.5, y: (south - north) * 0.5 };
}

function labelBasins(water: Uint8Array, width: number, height: number): { ids: Int32Array; basins: BasinGeometry[] } {
  const ids = new Int32Array(water.length);
  ids.fill(-1);
  const basins: BasinGeometry[] = [];
  const queue: number[] = [];
  for (let start = 0; start < water.length; start += 1) {
    if (!water[start] || ids[start] >= 0) continue;
    const basinId = basins.length;
    ids[start] = basinId;
    queue.length = 0;
    queue.push(start);
    let head = 0;
    let size = 0;
    let sinX = 0;
    let cosX = 0;
    let sumY = 0;
    let minY = height;
    let maxY = 0;
    while (head < queue.length) {
      const cell = queue[head++];
      const x = cell % width;
      const y = Math.floor(cell / width);
      const angle = ((x + 0.5) / width) * Math.PI * 2;
      sinX += Math.sin(angle);
      cosX += Math.cos(angle);
      sumY += y;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      size += 1;
      const neighbors = [indexOf(x - 1, y, width), indexOf(x + 1, y, width), y > 0 ? indexOf(x, y - 1, width) : -1, y + 1 < height ? indexOf(x, y + 1, width) : -1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !water[neighbor] || ids[neighbor] >= 0) continue;
        ids[neighbor] = basinId;
        queue.push(neighbor);
      }
    }
    let centerAngle = Math.atan2(sinX, cosX);
    if (centerAngle < 0) centerAngle += Math.PI * 2;
    basins.push({ size, centerX: centerAngle / (Math.PI * 2) * width - 0.5, centerY: sumY / Math.max(1, size), minY, maxY, maxInteriorDistance: 1 });
  }
  return { ids, basins };
}

function basinInteriorDistance(water: Uint8Array, basinIds: Int32Array, basins: BasinGeometry[], width: number, height: number): Float32Array {
  const distance = new Float32Array(water.length);
  distance.fill(1e6);
  const queue: number[] = [];
  let head = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = indexOf(x, y, width);
      if (!water[cell]) continue;
      const basin = basinIds[cell];
      const neighbors = [indexOf(x - 1, y, width), indexOf(x + 1, y, width), y > 0 ? indexOf(x, y - 1, width) : -1, y + 1 < height ? indexOf(x, y + 1, width) : -1];
      if (neighbors.some((neighbor) => neighbor < 0 || basinIds[neighbor] !== basin)) {
        distance[cell] = 0;
        queue.push(cell);
      }
    }
  }
  while (head < queue.length) {
    const cell = queue[head++];
    const x = cell % width;
    const y = Math.floor(cell / width);
    const basin = basinIds[cell];
    const next = distance[cell] + 1;
    const neighbors = [indexOf(x - 1, y, width), indexOf(x + 1, y, width), y > 0 ? indexOf(x, y - 1, width) : -1, y + 1 < height ? indexOf(x, y + 1, width) : -1];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || basinIds[neighbor] !== basin || distance[neighbor] <= next) continue;
      distance[neighbor] = next;
      queue.push(neighbor);
    }
  }
  for (let cell = 0; cell < basinIds.length; cell += 1) {
    const basin = basinIds[cell];
    if (basin >= 0) basins[basin].maxInteriorDistance = Math.max(basins[basin].maxInteriorDistance, distance[cell]);
  }
  return distance;
}

function scanAvailableSpan(x: number, y: number, dx: number, dy: number, basinId: number, basinIds: Int32Array, owner: Int16Array, width: number, height: number, limit: number): number {
  let span = 0;
  for (let step = 1; step <= limit; step += 1) {
    const sy = y + dy * step;
    if (sy < 0 || sy >= height) break;
    const cell = indexOf(x + dx * step, sy, width);
    if (basinIds[cell] !== basinId || owner[cell] >= 0) break;
    span = step;
  }
  return span;
}

function nearestGyreBoundaryClearance(x: number, y: number, basinId: number, gyres: PackedGyre[], width: number): number {
  let clearance = Number.POSITIVE_INFINITY;
  for (const gyre of gyres) {
    if (gyre.basinId !== basinId) continue;
    const nx = wrappedDeltaX(x, gyre.centerX, width) / Math.max(1, gyre.radiusX);
    const ny = (y - gyre.centerY) / Math.max(1, gyre.radiusY);
    const normalizedDistance = Math.hypot(nx, ny);
    const edgeDistance = Math.max(0, normalizedDistance - 1) * Math.min(gyre.radiusX, gyre.radiusY);
    clearance = Math.min(clearance, edgeDistance);
  }
  return clearance;
}

function packGyres(water: Uint8Array, basinIds: Int32Array, basins: BasinGeometry[], coastDistance: Float32Array, windX: Float32Array, windY: Float32Array, width: number, height: number): { gyres: PackedGyre[]; owner: Int16Array } {
  const owner = new Int16Array(water.length);
  owner.fill(-1);
  const gyres: PackedGyre[] = [];
  const minimumRadius = Math.max(3, Math.min(width, height) * 0.035);
  const maximumRadius = Math.max(minimumRadius * 2.2, Math.min(width, height) * 0.24);
  const minimumTerritory = Math.max(70, width * height * 0.004);
  const maximumGyres = 14;
  const scanLimit = Math.ceil(maximumRadius * 1.5);

  for (let iteration = 0; iteration < maximumGyres; iteration += 1) {
    let bestCell = -1;
    let bestScore = 0;
    let bestRadiusX = 0;
    let bestRadiusY = 0;
    for (let y = 1; y < height - 1; y += 1) {
      const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
      const absLat = Math.abs(latitude / (Math.PI / 2));
      const latitudeSuitability = Math.max(Math.exp(-((absLat - 0.31) ** 2) / 0.065), Math.exp(-((absLat - 0.64) ** 2) / 0.045) * 0.52);
      if (latitudeSuitability < 0.12) continue;
      for (let x = 0; x < width; x += 1) {
        const cell = indexOf(x, y, width);
        const basinId = basinIds[cell];
        if (basinId < 0 || owner[cell] >= 0 || basins[basinId].size < minimumTerritory * 1.5) continue;
        const coastClearance = coastDistance[cell];
        if (coastClearance < minimumRadius * 0.72) continue;
        const boundaryClearance = nearestGyreBoundaryClearance(x, y, basinId, gyres, width);
        const availableClearance = Math.min(coastClearance, boundaryClearance);
        if (availableClearance < minimumRadius * 0.72) continue;
        const west = scanAvailableSpan(x, y, -1, 0, basinId, basinIds, owner, width, height, scanLimit);
        const east = scanAvailableSpan(x, y, 1, 0, basinId, basinIds, owner, width, height, scanLimit);
        const north = scanAvailableSpan(x, y, 0, -1, basinId, basinIds, owner, width, height, scanLimit);
        const south = scanAvailableSpan(x, y, 0, 1, basinId, basinIds, owner, width, height, scanLimit);
        const radiusX = clamp((west + east) * 0.38, minimumRadius, maximumRadius);
        const radiusY = clamp((north + south) * 0.46, minimumRadius, maximumRadius * 0.82);
        const areaSupport = Math.sqrt(radiusX * radiusY);
        const compactness = Math.min(radiusX, radiusY) / Math.max(radiusX, radiusY);
        const hemisphere = latitude >= 0 ? 1 : -1;
        const windMagnitude = Math.hypot(windX[cell], windY[cell]);
        const windCompatibility = windMagnitude > 1e-6 ? 0.72 + Math.max(-0.2, (windX[cell] / windMagnitude) * hemisphere) * 0.28 : 0.72;
        const separation = Number.isFinite(boundaryClearance) ? clamp(boundaryClearance / Math.max(minimumRadius, Math.min(radiusX, radiusY)), 0.35, 1.4) : 1.2;
        const score = availableClearance * areaSupport * latitudeSuitability * windCompatibility * (0.58 + compactness * 0.42) * separation;
        if (score > bestScore) {
          bestScore = score;
          bestCell = cell;
          bestRadiusX = radiusX;
          bestRadiusY = radiusY;
        }
      }
    }
    if (bestCell < 0 || bestScore < minimumRadius * minimumRadius * 0.95) break;
    const centerX = bestCell % width;
    const centerY = Math.floor(bestCell / width);
    const basinId = basinIds[bestCell];
    const latitude = Math.PI / 2 - ((centerY + 0.5) / height) * Math.PI;
    const gyre: PackedGyre = { basinId, centerX, centerY, radiusX: bestRadiusX, radiusY: bestRadiusY, rotationSign: latitude >= 0 ? 1 : -1, territorySize: 0 };
    const gyreId = gyres.length;
    for (let y = Math.max(0, Math.floor(centerY - bestRadiusY * 1.15)); y <= Math.min(height - 1, Math.ceil(centerY + bestRadiusY * 1.15)); y += 1) {
      for (let xOffset = -Math.ceil(bestRadiusX * 1.15); xOffset <= Math.ceil(bestRadiusX * 1.15); xOffset += 1) {
        const x = centerX + xOffset;
        const cell = indexOf(x, y, width);
        if (basinIds[cell] !== basinId || owner[cell] >= 0) continue;
        const nx = wrappedDeltaX(x, centerX, width) / bestRadiusX;
        const ny = (y - centerY) / bestRadiusY;
        const normalizedRadius = Math.hypot(nx, ny);
        const coastAllowance = clamp(coastDistance[cell] / Math.max(1, minimumRadius), 0.5, 1);
        if (normalizedRadius <= coastAllowance) {
          owner[cell] = gyreId;
          gyre.territorySize += 1;
        }
      }
    }
    if (gyre.territorySize < minimumTerritory) {
      for (let cell = 0; cell < owner.length; cell += 1) if (owner[cell] === gyreId) owner[cell] = -1;
      break;
    }
    gyres.push(gyre);
  }
  return { gyres, owner };
}

export function applyBasinAwareCirculation(project: WorldProject): BasinCirculationDiagnostics {
  const world = project.primaryWorld;
  const layers = world.layers;
  const { width, height } = world.mapModel.resolution;
  const pressure = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const lat01 = latitude / (Math.PI / 2);
    const absLat = Math.abs(lat01);
    const pressureBelts = Math.cos(absLat * Math.PI * 3) * 0.62;
    for (let x = 0; x < width; x += 1) {
      const cell = indexOf(x, y, width);
      const longitude = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const thermal = clamp((layers.temperature[cell] - world.averageTemperatureC) / 32, -1, 1);
      const altitude = Math.max(0, layers.elevation[cell] - world.seaLevel);
      const stationaryWave = Math.sin(longitude * 2 + latitude * 1.4) * (0.25 + absLat * 0.18) + Math.sin(longitude * 3 - latitude * 0.8) * 0.12;
      pressure[cell] = pressureBelts - thermal * 0.42 + altitude * 0.48 + stationaryWave;
    }
  }
  let windDeflectionTotal = 0;
  let stagnantWind = 0;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const coriolis = Math.sin(latitude);
    for (let x = 0; x < width; x += 1) {
      const cell = indexOf(x, y, width);
      const gradient = scalarGradient(pressure, x, y, width, height);
      let wx = -gradient.x;
      let wy = -gradient.y;
      const geostrophicX = -wy * coriolis;
      const geostrophicY = wx * coriolis;
      const turnStrength = 0.38 + Math.abs(coriolis) * 0.46;
      wx = wx * (1 - turnStrength) + geostrophicX * turnStrength;
      wy = wy * (1 - turnStrength) + geostrophicY * turnStrength;
      const terrain = scalarGradient(layers.elevation, x, y, width, height);
      const slope = Math.hypot(terrain.x, terrain.y);
      const uphill = Math.max(0, wx * terrain.x + wy * terrain.y);
      const deflection = clamp(slope * 10 + uphill * 7, 0, 0.82);
      const tangentX = -terrain.y;
      const tangentY = terrain.x;
      const tangentSign = wx * tangentX + wy * tangentY < 0 ? -1 : 1;
      wx = wx * (1 - deflection * 0.64) + tangentX * tangentSign * deflection * 2.8;
      wy = wy * (1 - deflection * 0.64) + tangentY * tangentSign * deflection * 2.8;
      const lowBasin = !layers.water[cell] && slope < 0.006 && layers.elevation[cell] < world.seaLevel + 0.08;
      const rawSpeed = Math.hypot(wx, wy);
      const speed = clamp((0.16 + rawSpeed * 0.62) * (lowBasin ? 0.5 : 1), 0.08, 0.66);
      const wind = normalizeTo(wx, wy, speed);
      layers.windX[cell] = wind.x;
      layers.windY[cell] = wind.y;
      windDeflectionTotal += deflection;
      if (speed < 0.16) stagnantWind += 1;
    }
  }
  const { ids: basinIds, basins } = labelBasins(layers.water, width, height);
  const coastDistance = basinInteriorDistance(layers.water, basinIds, basins, width, height);
  const marineCells = basins.reduce((sum, basin) => sum + basin.size, 0);
  const largestBasinShare = basins.length ? Math.max(...basins.map((basin) => basin.size)) / Math.max(1, marineCells) : 0;
  const { gyres, owner } = packGyres(layers.water, basinIds, basins, coastDistance, layers.windX, layers.windY, width, height);
  const currentX = new Float32Array(width * height);
  const currentY = new Float32Array(width * height);
  let coastalCells = 0;
  let coastalAligned = 0;
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const absLat = Math.abs(latitude / (Math.PI / 2));
    for (let x = 0; x < width; x += 1) {
      const cell = indexOf(x, y, width);
      if (basinIds[cell] < 0) continue;
      let cx = 0;
      let cy = 0;
      let structuralStrength = 0;
      const gyreId = owner[cell];
      if (gyreId >= 0) {
        const gyre = gyres[gyreId];
        const nx = wrappedDeltaX(x, gyre.centerX, width) / Math.max(1, gyre.radiusX);
        const ny = (y - gyre.centerY) / Math.max(1, gyre.radiusY);
        const radius = clamp(Math.hypot(nx, ny), 0, 1);
        const ringStrength = 0.38 + Math.pow(Math.max(0, Math.sin(radius * Math.PI)), 0.55) * 0.62;
        // Tangent to the actual ellipse, not a circle drawn inside it.
        const tangentX = -ny / Math.max(1, gyre.radiusY);
        const tangentY = nx / Math.max(1, gyre.radiusX);
        cx = tangentX * gyre.rotationSign;
        cy = tangentY * gyre.rotationSign;
        structuralStrength = ringStrength;
        const westSide = nx < -0.35 ? clamp((-nx - 0.35) / 0.65, 0, 1) : 0;
        const boundaryBoost = 1 + westSide * 0.82;
        cx *= boundaryBoost;
        cy *= boundaryBoost;
        cx += layers.windX[cell] * 0.045;
        cy += layers.windY[cell] * 0.045;
      } else {
        const equatorial = Math.exp(-(absLat ** 2) / 0.025);
        const circumpolar = Math.exp(-((absLat - 0.78) ** 2) / 0.025);
        cx = layers.windX[cell] * 0.34 - equatorial * 0.42 + circumpolar * 0.38;
        cy = layers.windY[cell] * 0.2;
        structuralStrength = Math.max(equatorial, circumpolar) * 0.55;
      }
      const coastGradient = scalarGradient(coastDistance, x, y, width, height);
      const coastMagnitude = Math.hypot(coastGradient.x, coastGradient.y);
      if (coastDistance[cell] <= 4 && coastMagnitude > 0) {
        coastalCells += 1;
        const nx = coastGradient.x / coastMagnitude;
        const ny = coastGradient.y / coastMagnitude;
        const landward = Math.max(0, -(cx * nx + cy * ny));
        cx += nx * landward * 2.1;
        cy += ny * landward * 2.1;
        const tx = -ny;
        const ty = nx;
        const sign = cx * tx + cy * ty < 0 ? -1 : 1;
        const steering = 0.24 + (4 - coastDistance[cell]) * 0.1;
        cx += tx * sign * steering;
        cy += ty * sign * steering;
        const magnitude = Math.hypot(cx, cy);
        if (magnitude > 0 && Math.abs((cx / magnitude) * tx + (cy / magnitude) * ty) > 0.62) coastalAligned += 1;
      }
      const speed = clamp(0.055 + structuralStrength * 0.48 + Math.hypot(layers.windX[cell], layers.windY[cell]) * (gyreId >= 0 ? 0.045 : 0.11), 0.04, 0.64);
      const current = normalizeTo(cx, cy, speed);
      currentX[cell] = current.x;
      currentY[cell] = current.y;
    }
  }
  const nextX = new Float32Array(currentX);
  const nextY = new Float32Array(currentY);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = indexOf(x, y, width);
      const basin = basinIds[cell];
      if (basin < 0) continue;
      let sx = currentX[cell] * 9;
      let sy = currentY[cell] * 9;
      let weight = 9;
      const neighbors = [indexOf(x - 1, y, width), indexOf(x + 1, y, width), y > 0 ? indexOf(x, y - 1, width) : -1, y + 1 < height ? indexOf(x, y + 1, width) : -1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || basinIds[neighbor] !== basin || owner[neighbor] !== owner[cell]) continue;
        sx += currentX[neighbor];
        sy += currentY[neighbor];
        weight += 1;
      }
      nextX[cell] = sx / weight;
      nextY[cell] = sy / weight;
    }
  }
  currentX.set(nextX);
  currentY.set(nextY);
  let speedTotal = 0;
  let stagnantOcean = 0;
  for (let cell = 0; cell < basinIds.length; cell += 1) {
    if (basinIds[cell] < 0) {
      layers.currentX[cell] = 0;
      layers.currentY[cell] = 0;
      continue;
    }
    layers.currentX[cell] = currentX[cell];
    layers.currentY[cell] = currentY[cell];
    const speed = Math.hypot(currentX[cell], currentY[cell]);
    speedTotal += speed;
    if (speed < 0.1) stagnantOcean += 1;
  }
  const coherentGyreCount = gyres.filter((gyre) => gyre.territorySize >= Math.max(70, width * height * 0.004)).length;
  const diagnostics: BasinCirculationDiagnostics = {
    modelVersion: 'basin-circulation-v5.1', marineBasinCount: basins.length, largestBasinShare, coherentGyreCount, gyreCandidateCount: gyres.length,
    coastalAlignmentScore: coastalAligned / Math.max(1, coastalCells), stagnantOceanShare: stagnantOcean / Math.max(1, marineCells),
    meanCurrentSpeed: speedTotal / Math.max(1, marineCells), windTerrainDeflectionIndex: windDeflectionTotal / Math.max(1, width * height),
    stagnantWindShare: stagnantWind / Math.max(1, width * height),
    packedGyres: gyres.map((gyre, id) => ({ id, ...gyre })),
    gyreOwner: owner
  };
  const climate = world.climate as (typeof world.climate & { basinCirculation?: BasinCirculationDiagnostics }) | undefined;
  if (climate) {
    climate.basinCirculation = diagnostics;
    climate.notes = [...climate.notes.filter((note) => !note.startsWith('Basin-aware circulation')), `Basin-aware circulation v5.1 packed ${gyres.length} explicit gyre(s) across ${basins.length} marine basin(s) with ownership-preserving flow.`];
  }
  return diagnostics;
}
