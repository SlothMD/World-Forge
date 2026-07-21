import { describe, expect, it } from 'vitest';
import { buildCubedSphereTopology } from '@world-forge/shared';
import { SeededRandom } from '../../random';
import {
  assignTopologyPlateLayer,
  createTopologyPlates,
  measurePlateCohesion
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

  it('uses coherent coordinate warping without pulverizing plates into cell-sized fragments', () => {
    const topology = buildCubedSphereTopology(32);
    const rng = new SeededRandom('plate-cohesion-test');
    const primordial = generatePrimordialTerrain(topology, values, rng);
    const plates = createTopologyPlates(topology, values.plateCount, rng, primordial);

    const defaultLayer = assignTopologyPlateLayer(topology, plates);
    const coherentLayer = assignTopologyPlateLayer(topology, plates, 'coherent');
    const noWarpLayer = assignTopologyPlateLayer(topology, plates, 'none');
    const legacyLayer = assignTopologyPlateLayer(topology, plates, 'legacy-hash');

    expect(Array.from(defaultLayer)).toEqual(Array.from(coherentLayer));
    expect(Array.from(coherentLayer)).not.toEqual(Array.from(noWarpLayer));

    const coherent = measurePlateCohesion(topology, coherentLayer, plates.length);
    const legacy = measurePlateCohesion(topology, legacyLayer, plates.length);

    expect(coherent.boundaryCellShare).toBeLessThan(0.25);
    expect(coherent.connectedComponentCount).toBeLessThan(plates.length * 8);
    expect(coherent.singletonCellShare).toBeLessThan(0.01);
    expect(coherent.sub16CellShare).toBeLessThan(0.03);
    expect(coherent.minimumLargestComponentShare).toBeGreaterThan(0.35);
    expect(coherent.meridionalBoundaryTangentShare).toBeGreaterThanOrEqual(0);
    expect(coherent.meridionalBoundaryTangentShare).toBeLessThanOrEqual(1);

    expect(legacy.boundaryCellShare).toBeGreaterThan(coherent.boundaryCellShare * 1.5);
    expect(legacy.connectedComponentCount).toBeGreaterThan(coherent.connectedComponentCount * 3);
    expect(legacy.singletonCellShare).toBeGreaterThan(coherent.singletonCellShare);
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
