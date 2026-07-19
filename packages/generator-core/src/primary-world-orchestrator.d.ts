import { GenerationConfig, GenerationDiagnostics, PrimaryWorld, SelectedValues, SolarSystem } from '@world-forge/shared';
import { SeededRandom } from './random';
import type { GenerateProjectOptions } from './index';
export type PrimaryWorldDiagnosticsRecorder = {
    measure<T>(name: string, fn: () => T): T;
    record(name: string, ms: number): void;
    recordGraph(graph: NonNullable<GenerationDiagnostics['graph']>): void;
    snapshot(): GenerationDiagnostics;
};
export type LegacyPrimaryWorldOperations = {
    emitTopologyPreview: (...args: any[]) => void;
    createTopologyPlates: (...args: any[]) => any;
    assignTopologyPlateLayer: (...args: any[]) => void;
    createTerrainPhases: (...args: any[]) => any;
    generateCrustFields: (...args: any[]) => any;
    findTopologySeaLevelForOceanTarget: (...args: any[]) => number;
    applyTopologyTerrainAging: (...args: any[]) => void;
    applyTopologyTerrainEnrichment: (...args: any[]) => void;
    assignTopologyWater: (...args: any[]) => void;
    assignTopologyVolcanism: (...args: any[]) => void;
    generateTopologyClimate: (...args: any[]) => void;
    generateTopologyClimateMoistureCandidate: (...args: any[]) => void;
    assignTopologyIce: (...args: any[]) => void;
    generateClimatePipelinePreview: (...args: any[]) => any;
    generateTopologyHydrology: (...args: any[]) => any[];
    assignTopologyBiomes: (...args: any[]) => void;
    projectTopologyToEquirectangular: (...args: any[]) => void;
    projectTopologyFlowToEquirectangular: (...args: any[]) => void;
    projectTopologyRiver: (...args: any[]) => any;
};
export declare function orchestratePrimaryWorld(config: GenerationConfig, values: SelectedValues, solarSystem: SolarSystem, rng: SeededRandom, diagnostics: PrimaryWorldDiagnosticsRecorder, options: GenerateProjectOptions, operations: LegacyPrimaryWorldOperations): PrimaryWorld;
//# sourceMappingURL=primary-world-orchestrator.d.ts.map