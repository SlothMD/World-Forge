import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DevPanel } from './dev/DevPanel';
import { GraphWorkspace } from './dev/GraphWorkspace';
import { useDevGraphWorkspace } from './dev/useDevGraphWorkspace';
import { APP_VERSION } from './appVersion';
import './devWorkspace.css';

function DevGraphRoot() {
  const { node, selectedNodeId, toolbar, actions } = useDevGraphWorkspace();

  return (
    <GraphWorkspace
      node={node}
      selectedNodeId={selectedNodeId}
      toolbar={toolbar}
      onSelectNode={actions.selectNode}
      onWorkflowChange={actions.setWorkflow}
      onFidelityChange={actions.setFidelity}
      onSeedChange={actions.setSeed}
      onValidate={actions.validate}
      onReset={actions.reset}
    />
  );
}

export function mountDevWorkspace(container: HTMLElement): Root {
  const root = createRoot(container);
  root.render(<DevGraphRoot />);
  return root;
}

export { APP_VERSION, DevPanel };
