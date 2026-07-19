import { type GenerationTelemetryDetail } from '../generation/generationEvents';
import type { GraphNode, GraphToolbarState } from './GraphWorkspace';
export declare const defaultGraphToolbar: GraphToolbarState;
export declare function useDevGraphWorkspace(): {
    node: GraphNode[];
    selectedNodeId: string | null;
    toolbar: GraphToolbarState;
    telemetry: GenerationTelemetryDetail | null;
    actions: {
        selectNode: (id: string) => void;
        setWorkflow: (workflowId: string) => void;
        setFidelity: (fidelity: string) => void;
        setSeed: (seed: string) => void;
        validate: () => void;
        reset: () => void;
    };
};
