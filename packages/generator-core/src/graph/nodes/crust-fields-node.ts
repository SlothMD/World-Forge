import { CubedSphereTopology, SelectedValues, clamp, lerp } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationNode, NodeValidationResult } from '../types';
import { plateConstructionNodeId } from './plate-construction-node';
import {
  TopologyConstructionOutput,
  topologyConstructionNodeId
} from './topology-construction-node';

export const crustFieldsNodeId = 'terrain.crust-fields';

export type TerrainPhases = {
  phaseA: number;
  phaseB: number;
  continentPhase: number;
};

export type CrustFields = {
  continental: Float32Array;
  thickness: Float32Array;
  shelf: Float32Array;
};

export type CrustFieldsInput = {
  values: SelectedValues;
  /**
   * Compatibility input while the legacy generator still uses one shared random stream.
   * The plate dependency preserves the existing RNG consumption order.
   */
  rng: SeededRandom;
};

export type CrustFieldsOutput = {
  phases: TerrainPhases;
  crust: CrustFields;
  timings: {
    phasesMs: number;
    crustMs: number;
  };
};

export const crustFieldsNode: GenerationNode<CrustFieldsInput, CrustFieldsOutput> = {
  id: crustFieldsNodeId,
  version: '1',
  dependencies: [topologyConstructionNodeId, plateConstructionNodeId],
  execute(_context, input, dependencies) {
    const topologyOutput = dependencies.get(topologyConstructionNodeId) as TopologyConstructionOutput | undefined;
    if (!topologyOutput) throw new Error(`Missing dependency output: ${topologyConstructionNodeId}`);
    if (!dependencies.has(plateConstructionNodeId)) throw new Error(`Missing dependency output: ${plateConstructionNodeId}`);

    const phaseStart = nowMs();
    const phases = createTerrainPhases(input.rng);
    const phasesMs = nowMs() - phaseStart;
    const crustStart = nowMs();
    const crust = generateCrustFields(topologyOutput.topology, input.values, phases.phaseA, phases.phaseB, phases.continentPhase);
    const crustMs = nowMs() - crustStart;
    return { phases, crust, timings: { phasesMs, crustMs } };
  },
  validate(input, output) {
    return validateCrustFields(input, output);
  }
};

export function createTerrainPhases(rng: SeededRandom): TerrainPhases {
  return {
    phaseA: rng.range(0, 1000),
    phaseB: rng.range(0, 1000),
    continentPhase: rng.range(0, 1000)
  };
}

export function generateCrustFields(
  topology: CubedSphereTopology,
  values: SelectedValues,
  phaseA: number,
  phaseB: number,
  phaseC: number
): CrustFields {
  const continental = new Float32Array(topology.cellCount);
  const thickness = new Float32Array(topology.cellCount);
  const shelf = new Float32Array(topology.cellCount);
  const continentCount = Math.max(1, Math.round(values.continentCount));
  const countFootprint = clamp(Math.sqrt(5 / continentCount), 0.58, 1.75);
  const continentRadius = lerp(0.105, 0.205, values.continentScale) * countFootprint;
  const continentRegions = chooseContinentRegions(continentCount, continentRadius, phaseA, phaseB, phaseC);
  const islandFrequency = lerp(4.8, 14, values.islandDensity);

  for (let cell = 0; cell < topology.cellCount; cell += 1) {
    const x = topology.positions[cell * 3];
    const y = topology.positions[cell * 3 + 1];
    const z = topology.positions[cell * 3 + 2];
    let primary = 0;
    for (const region of continentRegions) {
      const centerDot = x * region.x + y * region.y + z * region.z;
      if (centerDot < region.influenceDot) continue;
      let regionValue = 0;
      for (const lobe of region.lobes) {
        const dot = clamp(x * lobe.x + y * lobe.y + z * lobe.z, -1, 1);
        const axial = Math.abs(x * region.axisX + y * region.axisY + z * region.axisZ);
        const edgeWarp =
          coherentSphericalNoise(x * 3.2 + lobe.x * 9, y * 3.2 + lobe.y * 9, z * 3.2 + lobe.z * 9) * 0.04 +
          coherentSphericalNoise(x * 7.4 - lobe.z * 5, y * 7.4 + lobe.x * 5, z * 7.4 - lobe.y * 5) * 0.018;
        const adjustedInnerDot = lobe.innerDot - edgeWarp * 2.65;
        const adjustedOuterDot = lobe.outerDot - edgeWarp * 2.65 - axial * region.elongation * 0.12;
        regionValue = Math.max(regionValue, smoothStep(adjustedOuterDot, adjustedInnerDot, dot) * lobe.weight);
      }
      primary = Math.max(primary, regionValue);
    }
    primary += coherentSphericalNoise(x * 2.3 + phaseA, y * 2.3 - phaseC, z * 2.3 + phaseB) * 0.12;
    const island =
      Math.max(0, coherentSphericalNoise(x * islandFrequency + phaseC, y * islandFrequency + phaseA, z * islandFrequency - phaseB) - 0.42) *
      lerp(0.12, 0.42, values.islandDensity);
    const rift =
      Math.max(0, coherentSphericalNoise(x * 2.05 - phaseA, y * 2.05 + phaseC, z * 2.05 - phaseB) - 0.22) *
      lerp(0.38, 0.16, values.continentScale);
    const basin =
      Math.max(0, coherentSphericalNoise(x * 1.45 + phaseB, y * 1.45 - phaseA, z * 1.45 + phaseC) - 0.18) *
      lerp(0.28, 0.11, values.continentScale);
    const shearRift =
      Math.max(0, Math.abs(coherentSphericalNoise(x * 4.6 - phaseC, y * 4.6 + phaseB, z * 4.6 - phaseA)) - 0.54) *
      lerp(0.34, 0.12, values.continentScale);
    const edgeThresholdWarp = coherentSphericalNoise(x * 9.5 + phaseA, y * 9.5 - phaseB, z * 9.5 + phaseC) * 0.05;
    const continent = clamp(smoothStep(0.4 + edgeThresholdWarp, 0.76 + edgeThresholdWarp * 0.5, primary - rift - basin - shearRift) + island);
    continental[cell] = continent;
    shelf[cell] = smoothStep(-0.28, 0.18, primary);
    thickness[cell] = clamp(
      continent *
        (0.42 +
          coherentSphericalNoise(x * 1.1 - phaseC, y * 1.1 + phaseB, z * 1.1 + phaseA) * 0.24 +
          coherentSphericalNoise(x * 2.6 + phaseA, y * 2.6, z * 2.6 - phaseB) * 0.12)
    );
  }

  smoothTopologyLayer(continental, topology, 3, 0.28);
  smoothTopologyLayer(thickness, topology, 3, 0.26);
  smoothTopologyLayer(shelf, topology, 3, 0.28);
  return { continental, thickness, shelf };
}

type ContinentRegion = {
  x: number;
  y: number;
  z: number;
  scale: number;
  elongation: number;
  axisX: number;
  axisY: number;
  axisZ: number;
  influenceDot: number;
  lobes: Array<{
    x: number;
    y: number;
    z: number;
    radius: number;
    innerDot: number;
    outerDot: number;
    weight: number;
  }>;
};

function chooseContinentRegions(count: number, baseRadius: number, phaseA: number, phaseB: number, phaseC: number): ContinentRegion[] {
  const candidates = Array.from({ length: Math.max(24, count * 10) }, (_, index) => continentCenterVector(index, phaseA, phaseB, phaseC));
  const selected = [candidates[0]];
  while (selected.length < count) {
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const nearest = selected.reduce((min, center) => Math.min(min, 1 - (candidate.x * center.x + candidate.y * center.y + candidate.z * center.z)), Number.POSITIVE_INFINITY);
      if (nearest > bestScore) {
        best = candidate;
        bestScore = nearest;
      }
    }
    selected.push(best);
  }
  return selected.map((center, index) => {
    const axisSeed = continentCenterVector(index + 101, phaseC, phaseA, phaseB);
    const lobeCount = 2 + Math.abs(Math.round(latticeNoise3(index * 5.3, phaseA * 0.031, phaseB * 0.029) * 2));
    const lobes = Array.from({ length: lobeCount }, (_, lobeIndex) => {
      if (lobeIndex === 0) {
        const radius = baseRadius * center.scale;
        return { x: center.x, y: center.y, z: center.z, radius, innerDot: Math.cos(radius * Math.PI), outerDot: Math.cos((radius + 0.075) * Math.PI), weight: 1 };
      }
      const offset = continentCenterVector(index * 17 + lobeIndex * 3, phaseA + lobeIndex * 11, phaseB - lobeIndex * 7, phaseC + lobeIndex * 5);
      const mixed = normalize3(
        center.x * 0.82 + offset.x * 0.36,
        center.y * 0.82 + offset.y * 0.36,
        center.z * 0.82 + offset.z * 0.36
      );
      const radius = baseRadius * center.scale * lerp(0.55, 0.9, (latticeNoise3(index, lobeIndex, phaseC * 0.01) + 1) / 2);
      return {
        ...mixed,
        radius,
        innerDot: Math.cos(radius * Math.PI),
        outerDot: Math.cos((radius + 0.075) * Math.PI),
        weight: lerp(0.62, 0.92, (latticeNoise3(index * 2, lobeIndex * 3, phaseB * 0.01) + 1) / 2)
      };
    });
    const maxRadius = lobes.reduce((max, lobe) => Math.max(max, lobe.radius), 0);
    return {
      ...center,
      elongation: lerp(0.15, 0.75, (latticeNoise3(index * 4.1, phaseB * 0.021, phaseC * 0.017) + 1) / 2),
      axisX: axisSeed.x,
      axisY: axisSeed.y,
      axisZ: axisSeed.z,
      influenceDot: Math.cos(Math.min(0.48, maxRadius * 1.95 + 0.18) * Math.PI),
      lobes
    };
  });
}

function continentCenterVector(index: number, phaseA: number, phaseB: number, phaseC: number): { x: number; y: number; z: number; scale: number } {
  const a = index + 1;
  const longitude = latticeNoise3(a * 1.7, phaseA * 0.013, phaseB * 0.017) * Math.PI;
  const latitude = Math.asin(clamp(latticeNoise3(a * 2.3, phaseB * 0.019, phaseC * 0.011) * 0.78, -0.9, 0.9));
  const cosLat = Math.cos(latitude);
  return {
    x: cosLat * Math.cos(longitude),
    y: Math.sin(latitude),
    z: cosLat * Math.sin(longitude),
    scale: lerp(0.75, 1.25, (latticeNoise3(a * 3.1, phaseC * 0.017, phaseA * 0.023) + 1) / 2)
  };
}

function normalize3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.max(0.000001, Math.sqrt(x * x + y * y + z * z));
  return { x: x / length, y: y / length, z: z / length };
}

export function coherentSphericalNoise(x: number, y: number, z: number): number {
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

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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

function validateCrustFields(_input: Readonly<CrustFieldsInput>, output: CrustFieldsOutput): NodeValidationResult {
  const issues: NodeValidationResult['issues'] = [];
  const length = output.crust.continental.length;
  if (length === 0) issues.push({ severity: 'error', message: 'Crust fields contain no cells.' });
  if (output.crust.thickness.length !== length || output.crust.shelf.length !== length) {
    issues.push({ severity: 'error', message: 'Crust field lengths do not match.' });
  }
  for (const layer of [output.crust.continental, output.crust.thickness, output.crust.shelf]) {
    for (const value of layer) {
      if (!Number.isFinite(value)) {
        issues.push({ severity: 'error', message: 'Crust fields contain a non-finite value.' });
        return { valid: false, issues };
      }
    }
  }
  for (const value of [output.phases.phaseA, output.phases.phaseB, output.phases.continentPhase]) {
    if (!Number.isFinite(value)) {
      issues.push({ severity: 'error', message: 'Terrain phases contain a non-finite value.' });
      break;
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
