import { CubedSphereTopology, Plate, clamp, lerp } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode, NodeValidationResult } from '../types';
import {
  PrimordialTerrainOutput,
  primordialTerrainNodeId
} from './primordial-terrain-node';
import {
  TopologyConstructionOutput,
  topologyConstructionNodeId
} from './topology-construction-node';

export const plateConstructionNodeId = 'plates.construct';

export type TopologyPlate = Plate & {
  centerCell: number;
  centerX3: number;
  centerY3: number;
  centerZ3: number;
  age: number;
  density: number;
};

export type PlateBoundaryWarpMode = 'coherent' | 'none' | 'legacy-hash';

export type PlateCohesionDiagnostics = {
  boundaryCellShare: number;
  boundaryEdgeCount: number;
  connectedComponentCount: number;
  singletonCellShare: number;
  sub16CellShare: number;
  minimumLargestComponentShare: number;
  meanLargestComponentShare: number;
  meridionalBoundaryTangentShare: number;
};

export type PlateConstructionInput = {
  requestedPlateCount: number;
  /**
   * Compatibility input while the legacy generator still uses one shared random stream.
   * Node-scoped seed derivation will be introduced separately after equivalence is locked.
   */
  rng: SeededRandom;
};

export type PlateConstructionOutput = {
  plates: TopologyPlate[];
  plateLayer: Uint16Array;
  cohesion: PlateCohesionDiagnostics;
};

export const plateConstructionNode: GenerationNode<PlateConstructionInput, PlateConstructionOutput> = {
  id: plateConstructionNodeId,
  version: '2',
  dependencies: [topologyConstructionNodeId, primordialTerrainNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const primordial = dependencies.get(primordialTerrainNodeId) as PrimordialTerrainOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!primordial) throw new Error(`Missing dependency output: ${primordialTerrainNodeId}`);

    const plates = createTopologyPlates(
      topologyOutput.topology,
      input.requestedPlateCount,
      input.rng,
      primordial
    );
    const plateLayer = assignTopologyPlateLayer(topologyOutput.topology, plates);
    const cohesion = measurePlateCohesion(topologyOutput.topology, plateLayer, plates.length);
    return { plates, plateLayer, cohesion };
  },
  validate(input, output) {
    return validatePlateConstruction(input, output);
  }
};

export function createTopologyPlates(
  topology: CubedSphereTopology,
  requestedPlateCount: number,
  rng: SeededRandom,
  primordial: PrimordialTerrainOutput
): TopologyPlate[] {
  const plateCount = Math.max(4, Math.min(72, Math.round(requestedPlateCount)));
  const centerCells = choosePlateCenters(topology, plateCount, rng);
  return centerCells.map((centerCell, id) => {
    const centerX3 = topology.positions[centerCell * 3];
    const centerY3 = topology.positions[centerCell * 3 + 1];
    const centerZ3 = topology.positions[centerCell * 3 + 2];
    const longitude = topology.longitudes[centerCell];
    const latitude = topology.latitudes[centerCell];
    const spin = rng.range(-0.45, 0.45);
    const driftX = -centerZ3 + centerY3 * spin;
    const driftZ = centerX3 - centerY3 * spin;
    const motionLength = Math.max(0.000001, Math.sqrt(driftX * driftX + driftZ * driftZ));
    const crustSignal =
      primordial.crustThickness[centerCell] +
      primordial.elevation[centerCell] * 0.45 -
      primordial.basin[centerCell] * 0.35;
    const age = clamp(primordial.crustAge[centerCell] + rng.range(-0.12, 0.12));
    const kind = crustSignal > 0.48 || (crustSignal > 0.38 && rng.next() > 0.35)
      ? 'continental'
      : 'oceanic';
    return {
      id,
      kind,
      centerX: round(((longitude + Math.PI) / (Math.PI * 2)) * 100, 2),
      centerY: round((0.5 - latitude / Math.PI) * 100, 2),
      motionX: driftX / motionLength,
      motionY: driftZ / motionLength,
      centerCell,
      centerX3,
      centerY3,
      centerZ3,
      age,
      density: kind === 'continental'
        ? lerp(0.35, 0.68, primordial.crustThickness[centerCell])
        : lerp(0.7, 1, 1 - age)
    };
  });
}

export function assignTopologyPlateLayer(
  topology: CubedSphereTopology,
  plates: readonly TopologyPlate[],
  warpMode: PlateBoundaryWarpMode = 'coherent'
): Uint16Array {
  const layer = new Uint16Array(topology.cellCount);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const sourceX = topology.positions[cell * 3];
    const sourceY = topology.positions[cell * 3 + 1];
    const sourceZ = topology.positions[cell * 3 + 2];
    const sample = warpMode === 'coherent'
      ? coherentPlateSampleVector(sourceX, sourceY, sourceZ)
      : { x: sourceX, y: sourceY, z: sourceZ };
    let best = plates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const plate of plates) {
      const legacyWarp = warpMode === 'legacy-hash'
        ? sphericalHashNoise(sourceX * 2.6 + plate.id * 0.17, sourceY * 2.6 - plate.id * 0.11, sourceZ * 2.6) * 0.08 +
          sphericalHashNoise(sourceX * 7.2 - plate.id * 0.13, sourceY * 7.2, sourceZ * 7.2 + plate.id * 0.19) * 0.035
        : 0;
      const score = sample.x * plate.centerX3 + sample.y * plate.centerY3 + sample.z * plate.centerZ3 + legacyWarp;
      if (score > bestScore) {
        best = plate;
        bestScore = score;
      }
    }
    layer[cell] = best.id;
  }
  return layer;
}

export function measurePlateCohesion(
  topology: CubedSphereTopology,
  plateLayer: Uint16Array,
  plateCount: number
): PlateCohesionDiagnostics {
  const cellCount = plateLayer.length;
  if (cellCount === 0 || plateCount <= 0) {
    return {
      boundaryCellShare: 0,
      boundaryEdgeCount: 0,
      connectedComponentCount: 0,
      singletonCellShare: 0,
      sub16CellShare: 0,
      minimumLargestComponentShare: 0,
      meanLargestComponentShare: 0,
      meridionalBoundaryTangentShare: 0
    };
  }

  const plateCellCounts = new Uint32Array(plateCount);
  const largestComponents = new Uint32Array(plateCount);
  let boundaryCellCount = 0;
  let boundaryEdgeCount = 0;
  let meridionalBoundaryEdges = 0;

  for (let cell = 0; cell < cellCount; cell += 1) {
    const plateId = plateLayer[cell];
    if (plateId < plateCount) plateCellCounts[plateId] += 1;
    let isBoundary = false;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor < 0 || plateLayer[neighbor] === plateId) continue;
      isBoundary = true;
      if (neighbor <= cell) continue;
      boundaryEdgeCount += 1;
      const meanLatitude = (topology.latitudes[cell] + topology.latitudes[neighbor]) * 0.5;
      const longitudeDelta = wrappedAngle(topology.longitudes[neighbor] - topology.longitudes[cell]) * Math.max(0.12, Math.cos(meanLatitude));
      const latitudeDelta = topology.latitudes[neighbor] - topology.latitudes[cell];
      // The edge between unlike cells is approximately normal to the plate boundary.
      // A mostly east-west crossing edge therefore implies a mostly north-south boundary tangent.
      if (Math.abs(longitudeDelta) >= Math.abs(latitudeDelta)) meridionalBoundaryEdges += 1;
    }
    if (isBoundary) boundaryCellCount += 1;
  }

  const visited = new Uint8Array(cellCount);
  const queue = new Int32Array(cellCount);
  let connectedComponentCount = 0;
  let singletonCells = 0;
  let sub16Cells = 0;

  for (let start = 0; start < cellCount; start += 1) {
    if (visited[start]) continue;
    const plateId = plateLayer[start];
    let head = 0;
    let tail = 0;
    let componentSize = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const cell = queue[head++];
      componentSize += 1;
      for (let direction = 0; direction < 4; direction += 1) {
        const neighbor = topology.neighbors[cell * 4 + direction];
        if (neighbor < 0 || visited[neighbor] || plateLayer[neighbor] !== plateId) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    connectedComponentCount += 1;
    if (componentSize === 1) singletonCells += 1;
    if (componentSize < 16) sub16Cells += componentSize;
    if (plateId < plateCount && componentSize > largestComponents[plateId]) largestComponents[plateId] = componentSize;
  }

  let minimumLargestComponentShare = 1;
  let largestComponentShareSum = 0;
  let populatedPlateCount = 0;
  for (let plateId = 0; plateId < plateCount; plateId += 1) {
    const plateCells = plateCellCounts[plateId];
    if (plateCells === 0) {
      minimumLargestComponentShare = 0;
      continue;
    }
    const share = largestComponents[plateId] / plateCells;
    minimumLargestComponentShare = Math.min(minimumLargestComponentShare, share);
    largestComponentShareSum += share;
    populatedPlateCount += 1;
  }

  return {
    boundaryCellShare: round(boundaryCellCount / cellCount, 6),
    boundaryEdgeCount,
    connectedComponentCount,
    singletonCellShare: round(singletonCells / cellCount, 6),
    sub16CellShare: round(sub16Cells / cellCount, 6),
    minimumLargestComponentShare: round(minimumLargestComponentShare, 6),
    meanLargestComponentShare: round(largestComponentShareSum / Math.max(1, populatedPlateCount), 6),
    meridionalBoundaryTangentShare: round(meridionalBoundaryEdges / Math.max(1, boundaryEdgeCount), 6)
  };
}

function choosePlateCenters(
  topology: CubedSphereTopology,
  count: number,
  rng: SeededRandom
): number[] {
  const candidateCount = Math.max(count * 16, 96);
  const candidates = Array.from({ length: candidateCount }, () => rng.int(0, topology.cellCount - 1));
  const selected = [candidates[0]];
  while (selected.length < count) {
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const cx = topology.positions[candidate * 3];
      const cy = topology.positions[candidate * 3 + 1];
      const cz = topology.positions[candidate * 3 + 2];
      let nearest = Number.POSITIVE_INFINITY;
      for (const center of selected) {
        const dot =
          cx * topology.positions[center * 3] +
          cy * topology.positions[center * 3 + 1] +
          cz * topology.positions[center * 3 + 2];
        nearest = Math.min(nearest, 1 - dot);
      }
      const jitter = rng.range(-0.018, 0.018);
      if (nearest + jitter > bestScore) {
        best = candidate;
        bestScore = nearest + jitter;
      }
    }
    selected.push(best);
  }
  return selected;
}

function validatePlateConstruction(
  input: Readonly<PlateConstructionInput>,
  output: PlateConstructionOutput
): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const expectedPlateCount = Math.max(4, Math.min(72, Math.round(input.requestedPlateCount)));

  if (output.plates.length !== expectedPlateCount) {
    issues.push({ severity: 'error', message: `Expected ${expectedPlateCount} plates, received ${output.plates.length}.` });
  }
  if (output.plateLayer.length === 0) {
    issues.push({ severity: 'error', message: 'Plate assignment layer contains no cells.' });
  }
  for (const plate of output.plates) {
    if (!Number.isFinite(plate.motionX) || !Number.isFinite(plate.motionY)) {
      issues.push({ severity: 'error', message: `Plate ${plate.id} has a non-finite motion vector.` });
      break;
    }
    if (plate.kind !== 'continental' && plate.kind !== 'oceanic') {
      issues.push({ severity: 'error', message: `Plate ${plate.id} has an invalid kind.` });
      break;
    }
  }
  for (const plateId of output.plateLayer) {
    if (plateId >= output.plates.length) {
      issues.push({ severity: 'error', message: `Plate layer references missing plate ${plateId}.` });
      break;
    }
  }

  const componentLimit = Math.max(expectedPlateCount * 32, Math.ceil(output.plateLayer.length * 0.02));
  if (output.cohesion.boundaryCellShare > 0.25) {
    issues.push({ severity: 'error', message: `Plate assignment is pathologically fragmented: ${(output.cohesion.boundaryCellShare * 100).toFixed(1)}% of cells touch a plate boundary.` });
  }
  if (output.cohesion.connectedComponentCount > componentLimit) {
    issues.push({ severity: 'error', message: `Plate assignment produced ${output.cohesion.connectedComponentCount} connected components for ${expectedPlateCount} plates.` });
  }
  if (output.cohesion.singletonCellShare > 0.08) {
    issues.push({ severity: 'error', message: `Plate assignment contains too many isolated one-cell components: ${(output.cohesion.singletonCellShare * 100).toFixed(1)}% of topology cells.` });
  }
  if (output.cohesion.sub16CellShare > 0.25) {
    issues.push({ severity: 'error', message: `Plate assignment contains too many sub-16-cell fragments: ${(output.cohesion.sub16CellShare * 100).toFixed(1)}% of topology cells.` });
  }
  if (output.cohesion.minimumLargestComponentShare < 0.35) {
    issues.push({ severity: 'error', message: `At least one plate has less than 35% of its cells in its largest connected component.` });
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

function coherentPlateSampleVector(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const frequency = 3.4;
  const amplitude = 0.075;
  const dx = coherentSphericalNoise(x * frequency + 11.7, y * frequency - 4.2, z * frequency + 7.9);
  const dy = coherentSphericalNoise(x * frequency - 8.1, y * frequency + 13.4, z * frequency - 2.6);
  const dz = coherentSphericalNoise(x * frequency + 3.8, y * frequency + 6.5, z * frequency - 12.3);
  const warpedX = x + dx * amplitude;
  const warpedY = y + dy * amplitude;
  const warpedZ = z + dz * amplitude;
  const length = Math.max(0.000001, Math.sqrt(warpedX * warpedX + warpedY * warpedY + warpedZ * warpedZ));
  return { x: warpedX / length, y: warpedY / length, z: warpedZ / length };
}

function coherentSphericalNoise(x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smoothNoiseStep(x - x0);
  const ty = smoothNoiseStep(y - y0);
  const tz = smoothNoiseStep(z - z0);
  let value = 0;
  for (let dz = 0; dz <= 1; dz += 1) {
    for (let dy = 0; dy <= 1; dy += 1) {
      for (let dx = 0; dx <= 1; dx += 1) {
        const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
        value += latticeNoise3(x0 + dx, y0 + dy, z0 + dz) * weight;
      }
    }
  }
  return value;
}

function smoothNoiseStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function latticeNoise3(x: number, y: number, z: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function sphericalHashNoise(x: number, y: number, z: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
