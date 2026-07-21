import { describe, expect, it } from 'vitest';
import {
  angularDistanceBetweenUnitVectors,
  buildRotationBetweenUnitVectors,
  buildTangentSphericalRotation,
  rotateUnitVector,
  unitVectorToLonLat
} from './fragmentSphericalTransform';

function vectorFromLonLat(longitude: number, latitude: number) {
  const cosLatitude = Math.cos(latitude);
  return {
    x: cosLatitude * Math.cos(longitude),
    y: Math.sin(latitude),
    z: cosLatitude * Math.sin(longitude)
  };
}

describe('rigid spherical fragment transforms', () => {
  it('preserves length and pairwise angular distance', () => {
    const first = vectorFromLonLat(-0.8, 0.35);
    const second = vectorFromLonLat(-0.62, 0.28);
    const rotation = buildTangentSphericalRotation(first, 0.7, -0.3, 0.24);
    const rotatedFirst = rotateUnitVector(first, rotation);
    const rotatedSecond = rotateUnitVector(second, rotation);

    expect(Math.hypot(rotatedFirst.x, rotatedFirst.y, rotatedFirst.z)).toBeCloseTo(1, 10);
    expect(Math.hypot(rotatedSecond.x, rotatedSecond.y, rotatedSecond.z)).toBeCloseTo(1, 10);
    expect(angularDistanceBetweenUnitVectors(rotatedFirst, rotatedSecond)).toBeCloseTo(
      angularDistanceBetweenUnitVectors(first, second),
      10
    );
  });

  it('moves a centroid along its local east and north tangent', () => {
    const centroid = vectorFromLonLat(0.4, 0.2);
    const rotation = buildTangentSphericalRotation(centroid, 1, 0.45, 0.12);
    const moved = unitVectorToLonLat(rotateUnitVector(centroid, rotation));

    expect(moved.longitude).toBeGreaterThan(0.4);
    expect(moved.latitude).toBeGreaterThan(0.2);
  });

  it('maps one unit vector to another with a rigid rotation', () => {
    const start = vectorFromLonLat(-1.1, -0.25);
    const end = vectorFromLonLat(0.7, 0.42);
    const rotation = buildRotationBetweenUnitVectors(start, end);
    const rotated = rotateUnitVector(start, rotation);

    expect(rotated.x).toBeCloseTo(end.x, 9);
    expect(rotated.y).toBeCloseTo(end.y, 9);
    expect(rotated.z).toBeCloseTo(end.z, 9);
  });

  it('uses an identity transform for zero displacement', () => {
    const source = vectorFromLonLat(1.2, -0.65);
    const rotation = buildTangentSphericalRotation(source, 0.2, 0.8, 0);
    const rotated = rotateUnitVector(source, rotation);

    expect(rotated.x).toBeCloseTo(source.x, 12);
    expect(rotated.y).toBeCloseTo(source.y, 12);
    expect(rotated.z).toBeCloseTo(source.z, 12);
  });
});
