import React from 'react';
import type { GenerationConfig } from '@world-forge/shared';
import './generatorPanel.css';
export type StarPresetId = 'sol-like' | 'habitable';
export type ResolutionOption = {
    label: string;
    width: number;
    height: number;
};
export type GeneratorProfileStatus = {
    className: string;
    label: string;
    title: string;
};
export type GeneratorPanelProps = {
    config: GenerationConfig;
    selectedPreset: string;
    presetLabels: string[];
    previewResolution: ResolutionOption;
    previewResolutionOptions: ResolutionOption[];
    exportResolution: ResolutionOption;
    resolutionOptions: ResolutionOption[];
    sourceTopologyResolution: number;
    invalidRanges: string[];
    isGenerating: boolean;
    profileStatus: GeneratorProfileStatus;
    onConfigChange: (config: GenerationConfig) => void;
    onRandomizeSeed: () => void;
    onGenerate: () => void;
    onOpenSyncSettings: () => void;
    onGenerationResolutionChange: (resolution: ResolutionOption) => void;
    onPresetChange: (preset: string) => void;
    onPreviewResolutionChange: (resolution: ResolutionOption) => void;
    onExportResolutionChange: (resolution: ResolutionOption) => void;
    onOceanToleranceChange: (value: number) => void;
};
export declare function GeneratorPanel(props: GeneratorPanelProps): React.JSX.Element;
