import { CubedSphereTopology, SelectedValues, clamp, lerp } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode, NodeValidationResult } from '../types';
import {
  TopologyConstructionOutput,
  topologyConstructionNodeId
} from './topology-construction-node';

export const primordialTerrainNodeId = 'terrain.primordial';

export type PrimordialTerrainInput = {
  values: SelectedValues;
  /**
   * Compatibility input while the legacy generator still uses one shared random stream.
   * Node-scoped seed derivation will be introduced separately after output equivalence is locked.
   */
  rng: SeededRandom;
};

export type PrimordialTerrainOutput = {
  elevation: Float32Array;
  crustAge: Float32Array;
  crustThickness: Float32Array;
  basin: Float32Array;
  impact: Float32Array;
};

export const primordialTerrainNode: GenerationNode<PrimordialTerrainInput, PrimordialTerrainOutput> = {
  id: primordialTerrainNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    return generatePrimordialTerrain(topologyOutput.topology, input.values, input.rng);
  },
  validate(input, output) {
    return validatePrimordialTerrain(input, output);
  }
};

export function generatePrimordialTerrain(
  topology: CubedSphereTopology,
  values: SelectedValues,
  rng: SeededRandom
): PrimordialTerrainOutput {
  const elevation = new Float32Array(topology.cellCount);
  const crustAge = new Float32Array(topology.cellCount);
  const crustThickness = new Float32Array(topology.cellCount);
  const basin = new Float32Array(topology.cellCount);
  const impact = new Float32Array(topology.cellCount);
  const phaseA = rng.range(0, 1000);
  const phaseB = rng.range(0, 1000);
  const phaseC = rng.range(0, 1000);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    const accretion =
      coherentSphericalNoise(x * 0.85 + phaseA, y * 0.85 - phaseC, z * 0.85 + phaseB) * 0.2 +
      coherentSphericalNoise(x * 1.65 - phaseB, y * 1.65 + phaseA, z * 1.65 - phaseC) * 0.13 +
      coherentSphericalNoise(x * 3.2 + phaseC, y * 3.2 + phaseB, z * 3.2 - phaseA) * 0.055;
    const basinSignal = smoothStep(
      0.18,
      0.72,
      coherentSphericalNoise(x * 1.25 - phaseA, y * 1.25 + phaseC, z * 1.25 - phaseB)
    );
    const ageSignal = clamp(
      0.5 +
        coherentSphericalNoise(x * 1.05 + phaseC, y * 1.05 + phaseA, z * 1.05 - phaseB) * 0.36 +
        coherentSphericalNoise(x * 2.7 - phaseB, y * 2.7 + phaseC, z * 2.7 + phaseA) * 0.14
    );
    basin[cell] = basinSignal;
    crustAge[cell] = ageSignal;
    crustThickness[cell] = clamp(0.44 + accretion * 0.95 + ageSignal * 0.22 - basinSignal * 0.34);
    elevation[cell] = accretion + crustThickness[cell] * 0.18 - basinSignal * 0.23;
  }

  const impactCount = Math.max(
    6,
    Math.round(
      (topology.cellCount / 9000) *
        values.impactFrequency *
        lerp(0.8, 1.45, clamp(values.systemAgeGy / 10))
    )
  );
  for (let i = 0; i < impactCount; i += 1) {
    const center = rng.int(0, topology.cellCount - 1);
    const radius = rng.range(0.025, 0.095);
    const strength = rng.range(0.035, 0.12);
    const cx = topology.positions[center * 3];
    const cy = topology.positions[center * 3 + 1];
    const cz = topology.positions[center * 3 + 2];
    for (let cell = 0; cell < topology.cellCount; cell += 1) {
      const dot =
        cx * topology.positions[cell * 3] +
        cy * topology.positions[cell * 3 + 1] +
        cz * topology.positions[cell * 3 + 2];
      const clampedDot = clamp(dot, -1, 1);
      if (clampedDot < Math.cos(radius * 1.42 * Math.PI)) continue;
      const distance = Math.acos(clampedDot) / Math.PI;
      const t = distance / radius;
      const bowl = t <= 1 ? (1 - t) ** 2 : 0;
      const rim = Math.max(0, 1 - Math.abs(t - 0.95) / 0.24);
      const signal = rim * strength * 0.32 - bowl * strength;
      elevation[cell] += signal;
      impact[cell] = Math.max(impact[cell], Math.abs(signal));
      crustThickness[cell] = clamp(
        crustThickness[cell] - bowl * strength * 0.7 + rim * strength * 0.18
      );
    }
  }

  smoothTopologyLayer(elevation, topology, 2, 0.2);
  smoothTopologyLayer(crustThickness, topology, 2, 0.18);
  smoothTopologyLayer(basin, topology, 2, 0.22);
  return { elevation, crustAge, crustThickness, basin, impact };
}

function validatePrimordialTerrain(
  _input: Readonly<PrimordialTerrainInput>,
  output: PrimordialTerrainOutput
): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const lengths = [
    output.elevation.length,
    output.crustAge.length,
    output.crustThickness.length,
    output.basin.length,
    output.impact.length
  ];
  const expectedLength = lengths[0];

  if (expectedLength <= 0) {
    issues.push({ severity: 'error', message: 'Primordial terrain output contains no cells.' });
  }
  if (lengths.some((length) => length !== expectedLength)) {
    issues.push({ severity: 'error', message: 'Primordial terrain layer lengths do not match.' });
  }
  if (
    !allFinite(output.elevation) ||
    !allFinite(output.crustAge) ||
    !allFinite(output.crustThickness) ||
    !allFinite(output.basin) ||
    !allFinite(output.impact)
  ) {
    issues.push({ severity: 'error', message: 'Primordial terrain output contains non-finite values.' });
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

function smoothTopologyLayer(
  layer: Float32Array,
  topology: CubedSphereTopology,
  passes: number,
  blend: number
): void {
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
        const weight =
          (dx ? tx : 1 - tx) *
          (dy ? ty : 1 - ty) *
          (dz ? tz : 1 - tz);
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

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function allFinite(values: Float32Array): boolean {
  for (const value of values) if (!Number.isFinite(value)) return false;
  return true;
}
