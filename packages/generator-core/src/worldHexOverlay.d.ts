import { Projection, WorldHexOverlay, WorldHexOverlayCoverage, WorldHexOverlayLevelId } from '@world-forge/shared';
export declare function buildFlatWorldHexOverlay(sizeClass: number, projection?: Projection): WorldHexOverlay;
export declare function hexCoverageForLatLonBounds(overlay: WorldHexOverlay, bounds: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
}, levelId?: WorldHexOverlayLevelId): WorldHexOverlayCoverage;
//# sourceMappingURL=worldHexOverlay.d.ts.map