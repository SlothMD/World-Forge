import React from 'react';
import type { PointInspectionRecord } from '@world-forge/renderer';
import type { GenerationConfig, WorldProject } from '@world-forge/shared';
import type { WorldDiagnosticsSummary } from './buildWorldDiagnostics';
export declare function DiagnosticsPanel({ project, diagnostics, generatorConfig, highestPointTargetActive, onToggleHighestPoint }: {
    project: WorldProject | null;
    diagnostics: WorldDiagnosticsSummary | null;
    generatorConfig?: GenerationConfig;
    highestPointTargetActive?: boolean;
    onToggleHighestPoint?: () => void;
}): React.JSX.Element;
export declare function Metric({ label, value, status }: {
    label: string;
    value: string;
    status?: 'ok' | 'warn';
}): React.JSX.Element;
export declare function PointInspectorPanel({ record, copyStatus, onCopy, onClear }: {
    record: PointInspectionRecord;
    copyStatus: string;
    onCopy: () => void;
    onClear: () => void;
}): React.JSX.Element;
export declare function projectGeneratorMismatch(project: WorldProject, config: GenerationConfig): string | null;
