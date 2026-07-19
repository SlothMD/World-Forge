import React from 'react';
import { MapMode, MapTheme, PointInspectionRecord, RenderMode } from '@world-forge/renderer';
import { WorldProject } from '@world-forge/shared';
export type GlobeDebugMode = 'final' | 'albedo' | 'lit' | 'water-mask' | 'sea-level' | 'coast-mask' | 'ocean-shell' | 'neutral-mesh' | 'topology-face' | 'uv-grid' | 'shade' | 'gyres';
export type GlobeFocusTarget = {
    x: number;
    y: number;
    width: number;
    height: number;
    latitude: number;
    longitude: number;
};
export declare function GlobeViewer({ project, mapMode, renderMode, mapTheme, showRivers, showPlates, showGlobeShells, globeDebugMode, diagnosticMode, inspectionRecord, focusTarget, zoom, onZoom, onInspect }: {
    project: WorldProject;
    mapMode: MapMode;
    renderMode: RenderMode;
    mapTheme: MapTheme;
    showRivers: boolean;
    showPlates: boolean;
    showGlobeShells: boolean;
    globeDebugMode: GlobeDebugMode;
    diagnosticMode: boolean;
    inspectionRecord: PointInspectionRecord | null;
    focusTarget: GlobeFocusTarget | null;
    zoom: number;
    onZoom: (event: WheelEvent) => void;
    onInspect: (x: number, y: number, screen: {
        x: number;
        y: number;
    }) => void;
}): React.JSX.Element;
