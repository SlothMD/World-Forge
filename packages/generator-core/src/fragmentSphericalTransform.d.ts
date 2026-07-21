export type UnitVector3 = {
    x: number;
    y: number;
    z: number;
};
export type RigidSphericalRotation = {
    axisX: number;
    axisY: number;
    axisZ: number;
    angleRadians: number;
};
export declare function normalizeUnitVector(vector: UnitVector3): UnitVector3;
export declare function buildTangentSphericalRotation(centroid: UnitVector3, motionEast: number, motionNorth: number, angleRadians: number): RigidSphericalRotation;
export declare function buildRotationBetweenUnitVectors(start: UnitVector3, end: UnitVector3): RigidSphericalRotation;
export declare function rotateUnitVector(vector: UnitVector3, rotation: RigidSphericalRotation): UnitVector3;
export declare function unitVectorToLonLat(vector: UnitVector3): {
    longitude: number;
    latitude: number;
};
export declare function angularDistanceBetweenUnitVectors(left: UnitVector3, right: UnitVector3): number;
//# sourceMappingURL=fragmentSphericalTransform.d.ts.map