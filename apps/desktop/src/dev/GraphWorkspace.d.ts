import React from 'react';
export type GraphNodeStatus = 'waiting' | 'running' | 'complete' | 'retained' | 'warning' | 'failed' | 'skipped';
export type GraphNode = {
    id: string;
    stageId: string;
    implementationId: string;
    label: string;
    description: string;
    inputs: string[];
    outputs: string[];
    fidelity: string[];
    status: GraphNodeStatus;
    progress: number;
    elapsedMs?: number;
    artifactSummary: string[];
    findings: string[];
};
export type GraphToolbarState = {
    workflowId: string;
    fidelity: string;
    seed: string;
    validationStatus: '' | 'valid';
};
export type GraphWorkspaceProps = {
    node: GraphNode[];
    selectedNodeId: string | null;
    toolbar: GraphToolbarState;
    onSelectNode: (id: string) => void;
    onWorkflowChange: (id: string) => void;
    onFidelityChange: (fidelity: string) => void;
    onSeedChange: (seed: string) => void;
    onValidate: () => void;
    onReset: () => void;
};
export declare function GraphWorkspace({ node: nodes, selectedNodeId, toolbar, onSelectNode, onWorkflowChange, onFidelityChange, onSeedChange, onValidate, onReset }: GraphWorkspaceProps): React.JSX.Element;
