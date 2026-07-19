import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import { GenerationGraphRunner } from '../runner';
import { plateConstructionNode, plateConstructionNodeId } from './plate-construction-node';
import { primordialTerrainNode, primordialTerrainNodeId } from './primordial-terrain-node';
import { topologyConstructionNode, topologyConstructionNodeId } from './topology-construction-node';
import { coherentSphericalNoise, crustFieldsNode, crustFieldsNodeId } from './crust-fields-node';

const values = {
  systemAgeGy: 4.6,
  oceanPercentage: 68,
  averageTemperatureC: 14,
  aridity: 0.45,
  seaLevel: 0,
  axialTiltDeg: 23.4,
  orbitalEccentricity: 0.017,
  sizeClass: 1,
  moonCount: 1,
  impactFrequency: 1,
  plateCount: 18,
  riverDensity: 1.6,
  continentCount: 5,
  continentScale: 0.55,
  islandDensity: 0.4,
  oceanTolerancePercentagePoints: 5
};

function run(seed: string) {
  const rng = new SeededRandom(seed);
  const runner = new GenerationGraphRunner([
    topologyConstructionNode,
    primordialTerrainNode,
    plateConstructionNode,
    crustFieldsNode
  ]);
  const config = createDefaultConfig(seed);
  const result = runner.run(crustFieldsNodeId, { rootSeed: seed }, new Map([
    [topologyConstructionNodeId, { outputResolution: config.outputResolution, topologyResolution: 16 }],
    [primordialTerrainNodeId, { values, rng }],
    [plateConstructionNodeId, { requestedPlateCount: values.plateCount, rng }],
    [crustFieldsNodeId, { values, rng }]
  ]));
  return result.results.get(crustFieldsNodeId);
}

describe('crustFieldsNode', () => {
  it('produces validated fields matching topology size', () => {
    const execution = run('crust-node');
    const output = execution?.output as any;
    expect(execution?.validation?.valid).toBe(true);
    expect(output.crust.continental.length).toBe(16 * 16 * 6);
    expect(output.crust.thickness.length).toBe(output.crust.continental.length);
    expect(output.crust.shelf.length).toBe(output.crust.continental.length);
  });

  it('is deterministic with the compatibility RNG stream', () => {
    const first = (run('crust-repeat')?.output as any);
    const second = (run('crust-repeat')?.output as any);
    expect(Array.from(first.crust.continental)).toEqual(Array.from(second.crust.continental));
    expect(first.phases).toEqual(second.phases);
  });

  it('matches the retained legacy coherent spherical noise exactly', () => {
    const legacyNoise = (x: number, y: number, z: number): number => {
      const lattice = (lx: number, ly: number, lz: number): number => {
        const value = Math.sin(lx * 127.1 + ly * 311.7 + lz * 74.7) * 43758.5453123;
        return (value - Math.floor(value)) * 2 - 1;
      };
      const smooth = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const z0 = Math.floor(z);
      const tx = smooth(x - x0);
      const ty = smooth(y - y0);
      const tz = smooth(z - z0);
      let value = 0;
      for (let dz = 0; dz <= 1; dz += 1) {
        for (let dy = 0; dy <= 1; dy += 1) {
          for (let dx = 0; dx <= 1; dx += 1) {
            const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
            value += lattice(x0 + dx, y0 + dy, z0 + dz) * weight;
          }
        }
      }
      return value;
    };

    for (const [x, y, z] of [[0.1, 0.2, 0.3], [17.4, -9.2, 3.7], [-4.25, 12.75, 0.5], [901.125, 77.875, -44.5]]) {
      expect(coherentSphericalNoise(x, y, z)).toBe(legacyNoise(x, y, z));
    }
  });
});
