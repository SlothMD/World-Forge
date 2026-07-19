import React from 'react';
import { Activity, Box, GitBranch, Workflow } from 'lucide-react';
import { PresetValidationLauncher } from './PresetValidationLauncher';

export function DevPanel({ onShowGraph }: { onShowGraph: () => void }) {
  return <div className="dev-panel" role="tabpanel" aria-label="Developer tools">
    <PresetValidationLauncher />
    <div className="dev-panel-heading"><GitBranch size={17}/><div><strong>Developer workspace</strong><span>Graph runtime and workflow tooling</span></div></div>
    <button type="button" className="dev-tool-button active" onClick={onShowGraph}><Workflow size={16}/><span><strong>Graph</strong><small>Inspect generation workflows</small></span></button>
    <div className="dev-tool-placeholder"><Box size={15}/><span>Stages</span><small>Coming with decomposition</small></div>
    <div className="dev-tool-placeholder"><Activity size={15}/><span>Reports</span><small>Preset reports available from Test</small></div>
  </div>;
}
