import React from 'react';
import { ChevronDown, RefreshCw, Shuffle, User } from 'lucide-react';
import type { GenerationConfig } from '@world-forge/shared';
import './generatorPanel.css';

export type StarPresetId = 'sol-like' | 'habitable';

type ExtendedGenerationConfig = GenerationConfig & {
  starPresetId?: StarPresetId;
  worldPresetId?: string;
  seeds?: { star?: string; world?: string };
};

export type ResolutionOption = { label: string; width: number; height: number };
export type GeneratorProfileStatus = { className: string; label: string; title: string };

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

const starPresetOptions: Array<{ id: StarPresetId; label: string; description: string }> = [
  { id: 'sol-like', label: 'Sol-Like', description: 'Strongly favors a quiet, Sun-like main-sequence star and a near-Earth orbital baseline.' },
  { id: 'habitable', label: 'Earthlike-Friendly', description: 'Selects from stable F, G, and K stars with a practical habitable zone, then places the world within that star-specific zone.' }
];

function randomSeed(): string {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

function selectedValuesForNewSeed(config: GenerationConfig): GenerationConfig['selectedValues'] {
  return {
    oceanTolerancePercentagePoints: config.selectedValues?.oceanTolerancePercentagePoints ?? 5
  };
}

export function GeneratorPanel(props: GeneratorPanelProps) {
  const {
    config, selectedPreset, presetLabels, previewResolution, previewResolutionOptions, exportResolution,
    resolutionOptions, sourceTopologyResolution, invalidRanges, isGenerating, profileStatus,
    onConfigChange, onRandomizeSeed, onGenerate, onOpenSyncSettings, onGenerationResolutionChange,
    onPresetChange, onPreviewResolutionChange, onExportResolutionChange, onOceanToleranceChange
  } = props;
  const extended = config as ExtendedGenerationConfig;
  const starPresetId = extended.starPresetId === 'habitable' ? 'habitable' : 'sol-like';
  const starSeed = extended.seeds?.star || config.seed;
  const starPreset = starPresetOptions.find((option) => option.id === starPresetId) ?? starPresetOptions[0];

  const updateStarPreset = (next: StarPresetId) => onConfigChange({
    ...config,
    starPresetId: next,
    worldPresetId: selectedPreset,
    seeds: { ...extended.seeds, star: starSeed, world: config.seed }
  } as GenerationConfig);

  const updateStarSeed = (next: string) => onConfigChange({
    ...config,
    starPresetId,
    worldPresetId: selectedPreset,
    selectedValues: selectedValuesForNewSeed(config),
    seeds: { ...extended.seeds, star: next, world: config.seed }
  } as GenerationConfig);

  const updateWorldSeed = (next: string) => onConfigChange({
    ...config,
    seed: next,
    starPresetId,
    worldPresetId: selectedPreset,
    selectedValues: selectedValuesForNewSeed(config),
    seeds: { ...extended.seeds, star: starSeed, world: next }
  } as GenerationConfig);

  const randomizeAll = () => {
    const world = randomSeed();
    onConfigChange({
      ...config,
      seed: world,
      starPresetId,
      worldPresetId: selectedPreset,
      selectedValues: selectedValuesForNewSeed(config),
      seeds: { star: randomSeed(), world }
    } as GenerationConfig);
  };

  return (
    <div className="generator-panel simplified-generator" role="tabpanel" aria-label="World generator">
      <div className="generator-primary-actions">
        <button type="button" className="secondary-button randomize-all-button" onClick={randomizeAll} title="Randomize star and world seeds"><Shuffle size={16} />Randomize All</button>
        <button type="button" className="primary-button" disabled={invalidRanges.length > 0 || isGenerating} onClick={onGenerate} title="Generate world"><RefreshCw size={16} />Generate</button>
      </div>

      <section className="generator-section" aria-labelledby="star-settings-heading">
        <h3 id="star-settings-heading">Star</h3>
        <div className="generator-field-row">
          <label htmlFor="star-preset">Star Type</label>
          <select id="star-preset" value={starPresetId} title={starPreset.description} onChange={(event) => updateStarPreset(event.target.value as StarPresetId)}>
            {starPresetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
        <p className="generator-field-help">{starPreset.description}</p>
        <div className="generator-seed-row">
          <label htmlFor="star-seed">Star Seed</label>
          <input id="star-seed" inputMode="numeric" pattern="[0-9]*" value={starSeed} onChange={(event) => updateStarSeed(event.target.value.replace(/\D/g, ''))} />
          <button type="button" title="Randomize star seed" aria-label="Randomize star seed" className="secondary-button icon-button" onClick={() => updateStarSeed(randomSeed())}><Shuffle size={16} /></button>
        </div>
      </section>

      <section className="generator-section" aria-labelledby="world-settings-heading">
        <h3 id="world-settings-heading">World</h3>
        <div className="generator-field-row">
          <label htmlFor="world-preset">World Type</label>
          <select id="world-preset" value={selectedPreset} onChange={(event) => onPresetChange(event.target.value)}>
            {presetLabels.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </div>
        <div className="generator-seed-row">
          <label htmlFor="world-seed">World Seed</label>
          <input id="world-seed" inputMode="numeric" pattern="[0-9]*" value={config.seed} onChange={(event) => updateWorldSeed(event.target.value.replace(/\D/g, ''))} />
          <button type="button" title="Randomize world seed" aria-label="Randomize world seed" className="secondary-button icon-button" onClick={() => { onRandomizeSeed(); }}><Shuffle size={16} /></button>
        </div>
        <div className="generator-field-row">
          <label htmlFor="generation-resolution">Map Size</label>
          <select id="generation-resolution" value={`${config.outputResolution.width}x${config.outputResolution.height}`} onChange={(event) => { const resolution = resolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value); if (resolution) onGenerationResolutionChange(resolution); }}>{resolutionOptions.map((option) => <option key={option.label} value={`${option.width}x${option.height}`}>{option.label}</option>)}</select>
        </div>
      </section>

      {invalidRanges.length > 0 && <div className="validation">Invalid advanced ranges: {invalidRanges.join(', ')}</div>}
      <details className="advanced-generator-settings">
        <summary><ChevronDown size={16} /> Advanced Settings</summary>
        <div className="advanced-settings-content">
          <button type="button" className={`profile-pill ${profileStatus.className}`} title={profileStatus.title} onClick={onOpenSyncSettings}><User size={15} /><span>{profileStatus.label}</span></button>
          <section className="advanced-settings-group"><h4>Generation Quality and Output</h4>
            <div className="resolution-row readout-row"><span>Source topology</span><span>{sourceTopologyResolution} cubed-sphere</span></div>
            <div className="resolution-row"><label htmlFor="preview-resolution">Preview</label><select id="preview-resolution" value={`${previewResolution.width}x${previewResolution.height}`} onChange={(event) => { const resolution = previewResolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value); if (resolution) onPreviewResolutionChange(resolution); }}>{previewResolutionOptions.map((option) => <option key={option.label} value={`${option.width}x${option.height}`}>{option.label}</option>)}</select></div>
            <div className="resolution-row"><label htmlFor="export-resolution">PNG export</label><select id="export-resolution" value={`${exportResolution.width}x${exportResolution.height}`} onChange={(event) => { const resolution = resolutionOptions.find((option) => `${option.width}x${option.height}` === event.target.value); if (resolution) onExportResolutionChange(resolution); }}>{resolutionOptions.map((option) => <option key={option.label} value={`${option.width}x${option.height}`}>{option.label}</option>)}</select></div>
          </section>
          <section className="advanced-settings-group"><h4>Final Water</h4><div className="resolution-row"><label htmlFor="ocean-tolerance">Tolerance</label><input id="ocean-tolerance" min="0" step="0.5" type="number" value={config.selectedValues?.oceanTolerancePercentagePoints ?? 5} onChange={(event) => onOceanToleranceChange(Number(event.target.value))} /></div></section>
        </div>
      </details>
    </div>
  );
}
