import { WorldProject } from '@world-forge/shared';
export type MapTheme = {
    name: string;
    colors: Record<string, string>;
};
export declare const cleanGameMapTheme: MapTheme;
export declare function renderWorldToCanvas(canvas: HTMLCanvasElement, project: WorldProject, theme?: MapTheme, visible?: {
    rivers: boolean;
    plates: boolean;
}): void;
export declare function worldToSvg(project: WorldProject, theme?: MapTheme): string;
//# sourceMappingURL=index.d.ts.map