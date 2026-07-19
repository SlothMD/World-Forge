import { CubedSphereTopology, SelectedValues, clamp, lerp } from '@world-forge/shared';
import { GenerationNode, NodeValidationResult } from '../types';
import { CrustFieldsOutput, TerrainPhases, crustFieldsNodeId, coherentSphericalNoise } from './crust-fields-node';
import { PlateConstructionOutput, TopologyPlate, plateConstructionNodeId } from './plate-construction-node';
import { PrimordialTerrainOutput, primordialTerrainNodeId } from './primordial-terrain-node';
import { TopologyConstructionOutput, topologyConstructionNodeId } from './topology-construction-node';

export const topologyElevationNodeId = 'terrain.topology-elevation';

export type TopologyElevationInput = {
  values: SelectedValues;
};

export type TopologyElevationOutput = {
  elevation: Float32Array;
};

export const topologyElevationNode: GenerationNode<TopologyElevationInput, TopologyElevationOutput> = {
  id: topologyElevationNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, primordialTerrainNodeId, plateConstructionNodeId, crustFieldsNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    const primordial = dependencies.get(primordialTerrainNodeId) as PrimordialTerrainOutput | undefined;
    const plates = dependencies.get(plateConstructionNodeId) as PlateConstructionOutput | undefined;
    const crust = dependencies.get(crustFieldsNodeId) as CrustFieldsOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!primordial) throw new Error(`Missing dependency output: ${primordialTerrainNodeId}`);
    if (!plates) throw new Error(`Missing dependency output: ${plateConstructionNodeId}`);
    if (!crust) throw new Error(`Missing dependency output: ${crustFieldsNodeId}`);

    return {
      elevation: generateTopologyElevation(
        plates.plateLayer,
        plates.plates,
        topologyOutput.topology,
        input.values,
        primordial,
        crust.crust,
        crust.phases
      )
    };
  },
  validate(_input, output) {
    return validateTopologyElevation(output);
  }
};

export function generateTopologyElevation(
  plateLayer: Uint16Array,
  plates: readonly TopologyPlate[],
  topology: CubedSphereTopology,
  values: SelectedValues,
  primordial: PrimordialTerrainOutput,
  crust: CrustFieldsOutput['crust'],
  phases: TerrainPhases
): Float32Array {
  const elevation = new Float32Array(topology.cellCount);
  const { phaseA, phaseB, continentPhase } = phases;
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const latitude01 = 1 - Math.abs(topology.latitudes[cell]) / (Math.PI / 2);
    const plate = plates[plateLayer[cell]];
    const plateBias = plate.kind === 'continental' ? 0.012 + plate.age * 0.018 : -0.026 - (1 - plate.age) * 0.018;
    const continental = crust.continental[cell];
    const inheritedThickness = lerp(crust.thickness[cell], primordial.crustThickness[cell], 0.38);
    const thickness = clamp(inheritedThickness + (plate.kind === 'continental' ? 0.08 : -0.08));
    const shelf = crust.shelf[cell];
    const craton = Math.max(0, coherentSphericalNoise(x * 1.25 + phaseB, y * 1.25 - continentPhase, z * 1.25 + phaseA) - 0.15) * continental;
    const plateauField = Math.max(
      0,
      coherentSphericalNoise(x * 2.1 + plate.id * 0.31, y * 2.1 - phaseB, z * 2.1 + phaseA) - 0.2
    ) * 0.22 * continental;
    const basinField = Math.min(
      0,
      coherentSphericalNoise(x * 2.3 - plate.id * 0.27, y * 2.3 + phaseA, z * 2.3 - phaseB) + 0.08
    ) * 0.12;
    const broad =
      coherentSphericalNoise(x * 1.4 + phaseA, y * 1.4, z * 1.4 + phaseB) * 0.08 +
      coherentSphericalNoise(x * 3.0 + phaseB, y * 3.0 + phaseA, z * 3.0) * 0.055;
    const detail =
      coherentSphericalNoise(x * 7.5 + phaseA, y * 7.5 + phaseB, z * 7.5) * 0.035 +
      coherentSphericalNoise(x * 16.5 + phaseB, y * 16.5, z * 16.5 + phaseA) * 0.018;
    const polarShelf = (1 - latitude01) * -0.045;
    const primordialBasin = primordial.basin[cell] * 0.14;
    const primordialRelief = primordial.elevation[cell] * 0.42 + primordial.impact[cell] * 0.18;
    const oceanicBase = -0.34 + shelf * 0.15 + basinField - primordialBasin + primordialRelief * 0.22;
    const continentalBase = 0.09 + thickness * 0.43 + craton * 0.14 + plateauField + primordialRelief;
    const crustBlend = clamp(continental * 0.72 + primordial.crustThickness[cell] * 0.28);
    elevation[cell] = lerp(oceanicBase, continentalBase, crustBlend) + plateBias + broad + detail + polarShelf;
  }

  const uplift = new Float32Array(elevation.length);
  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const currentPlate = plateLayer[cell];
    const neighbors = topology.neighbors.subarray(cell * 4, cell * 4 + 4);
    for (const neighbor of neighbors) {
      if (neighbor < 0 || neighbor <= cell || plateLayer[neighbor] === currentPlate) continue;
      const current = plates[currentPlate];
      const next = plates[plateLayer[neighbor]];
      const effect = topologyPlateBoundaryEffect(current, next, topology, cell, neighbor);
      uplift[cell] += effect;
      uplift[neighbor] += effect;
      for (let i = 0; i < 4; i += 1) {
        const aroundCurrent = topology.neighbors[cell * 4 + i];
        const aroundNext = topology.neighbors[neighbor * 4 + i];
        if (aroundCurrent >= 0) uplift[aroundCurrent] += effect * 0.26;
        if (aroundNext >= 0) uplift[aroundNext] += effect * 0.26;
      }
    }
  }

  for (let cell = 0; cell < elevation.length; cell += 1) elevation[cell] += uplift[cell];
  smoothTopologyLayer(elevation, topology, 3, 0.22);
  return elevation;
}

function topologyPlateBoundaryEffect(
  a: TopologyPlate,
  b: TopologyPlate,
  topology: CubedSphereTopology,
  cell: number,
  neighbor: number
): number {
  const lonA = topology.longitudes[cell];
  const latA = topology.latitudes[cell];
  const lonB = topology.longitudes[neighbor];
  const latB = topology.latitudes[neighbor];
  const boundaryX = Math.atan2(Math.sin(lonB - lonA), Math.cos(lonB - lonA));
  const boundaryY = latB - latA;
  const length = Math.max(0.000001, Math.sqrt(boundaryX * boundaryX + boundaryY * boundaryY));
  const nx = boundaryX / length;
  const ny = boundaryY / length;
  const relativeX = b.motionX - a.motionX;
  const relativeY = b.motionY - a.motionY;
  const convergence = relativeX * nx + relativeY * ny;
  const shear = Math.abs(relativeX * -ny + relativeY * nx);

  if (convergence > 0.18) {
    if (a.kind === 'continental' && b.kind === 'continental') return 0.08 + convergence * 0.08;
    if (a.kind !== b.kind) return 0.045 + convergence * 0.07;
    return 0.018 + convergence * 0.03;
  }
  if (convergence < -0.16) return -0.035 + convergence * 0.055;
  return shear > 0.45 ? 0.012 - shear * 0.018 : -0.012;
}

function smoothTopologyLayer(layer: Float32Array, topology: CubedSphereTopology, passes: number, blend: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(layer);
    for (let cell = 0; cell < layer.length; cell += 1) {
      let total = layer[cell];
      let count = 1;
      for (let i = 0; i < 4; i += 1) {
        const neighbor = topology.neighbors[cell * 4 + i];
        if (neighbor < 0) continue;
        total += layer[neighbor];
        count += 1;
      }
      next[cell] = lerp(layer[cell], total / count, blend);
    }
    layer.set(next);
  }
}

function validateTopologyElevation(output: TopologyElevationOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  if (output.elevation.length === 0) issues.push({ severity: 'error', message: 'Topology elevation contains no cells.' });
  for (const value of output.elevation) {
    if (!Number.isFinite(value)) {
      issues.push({ severity: 'error', message: 'Topology elevation contains a non-finite value.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}
