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
};

export const plateConstructionNode: GenerationNode<PlateConstructionInput, PlateConstructionOutput> = {
  id: plateConstructionNodeId,
  version: '1',
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
    return { plates, plateLayer };
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
  plates: readonly TopologyPlate[]
): Uint16Array {
  const layer = new Uint16Array(topology.cellCount);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    let best = plates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const plate of plates) {
      const ridgeWarp =
        sphericalNoise(x * 2.6 + plate.id * 0.17, y * 2.6 - plate.id * 0.11, z * 2.6) * 0.08 +
        sphericalNoise(x * 7.2 - plate.id * 0.13, y * 7.2, z * 7.2 + plate.id * 0.19) * 0.035;
      const score = x * plate.centerX3 + y * plate.centerY3 + z * plate.centerZ3 + ridgeWarp;
      if (score > bestScore) {
        best = plate;
        bestScore = score;
      }
    }
    layer[cell] = best.id;
  }
  return layer;
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

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

function sphericalNoise(x: number, y: number, z: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
