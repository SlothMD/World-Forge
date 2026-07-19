import { describe, expect, it } from 'vitest';
import { buildCubedSphereTopology } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import {
  assignTopologyPlateLayer,
  createTopologyPlates
} from './plate-construction-node';
import { generatePrimordialTerrain } from './primordial-terrain-node';

const values = {
  systemAgeGy: 4.5,
  oceanPercentage: 68,
  averageTemperatureC: 15,
  aridity: 0.4,
  seaLevel: 0,
  axialTiltDeg: 23.4,
  orbitalEccentricity: 0.02,
  sizeClass: 1,
  moonCount: 1,
  impactFrequency: 1,
  plateCount: 12,
  riverDensity: 1.5,
  continentCount: 5,
  continentScale: 0.55,
  islandDensity: 0.4,
  oceanTolerancePercentagePoints: 5
};

describe('plateConstructionNode helpers', () => {
  it('creates and assigns deterministic plates with the shared RNG sequence', () => {
    const topology = buildCubedSphereTopology(16);

    const firstRng = new SeededRandom('plate-node-test');
    const firstPrimordial = generatePrimordialTerrain(topology, values, firstRng);
    const firstPlates = createTopologyPlates(topology, values.plateCount, firstRng, firstPrimordial);
    const firstLayer = assignTopologyPlateLayer(topology, firstPlates);

    const secondRng = new SeededRandom('plate-node-test');
    const secondPrimordial = generatePrimordialTerrain(topology, values, secondRng);
    const secondPlates = createTopologyPlates(topology, values.plateCount, secondRng, secondPrimordial);
    const secondLayer = assignTopologyPlateLayer(topology, secondPlates);

    expect(firstPlates).toEqual(secondPlates);
    expect(Array.from(firstLayer)).toEqual(Array.from(secondLayer));
    expect(firstPlates).toHaveLength(12);
    expect(firstLayer).toHaveLength(topology.cellCount);
    expect(Math.max(...firstLayer)).toBeLessThan(firstPlates.length);
  });

  it('clamps requested plate counts to the supported range', () => {
    const topology = buildCubedSphereTopology(16);
    const lowRng = new SeededRandom('plate-low');
    const lowPrimordial = generatePrimordialTerrain(topology, values, lowRng);
    expect(createTopologyPlates(topology, 1, lowRng, lowPrimordial)).toHaveLength(4);

    const highRng = new SeededRandom('plate-high');
    const highPrimordial = generatePrimordialTerrain(topology, values, highRng);
    expect(createTopologyPlates(topology, 100, highRng, highPrimordial)).toHaveLength(72);
  });
});
