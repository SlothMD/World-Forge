import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { FlaskConical } from 'lucide-react';
import { PresetValidationPanel } from './PresetValidationPanel';
import './presetValidation.css';

let persistentRoot: Root | null = null;

function GlobalPresetValidationLauncher() {
  const [toolbarHost, setToolbarHost] = useState<Element | null>(null);
  const [workspaceHost, setWorkspaceHost] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const locate = () => {
      setToolbarHost(document.querySelector('.graph-toolbar-primary'));
      setWorkspaceHost(document.querySelector('.graph-workspace'));
      frame = window.requestAnimationFrame(locate);
    };
    locate();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <>
    {toolbarHost && createPortal(
      <button
        type="button"
        className="dev-instrument dev-instrument-test"
        onClick={() => setOpen(true)}
        aria-pressed={open}
        aria-label="Run automated preset validation"
        title="Run automated preset validation"
      >
        <FlaskConical size={16} />
      </button>,
      toolbarHost
    )}
    {open && workspaceHost && createPortal(<PresetValidationPanel onClose={() => setOpen(false)} />, workspaceHost)}
  </>;
}

export function PresetValidationLauncher() {
  useEffect(() => {
    if (persistentRoot) return;
    const host = document.createElement('div');
    host.id = 'persistent-preset-validation-launcher';
    document.body.appendChild(host);
    persistentRoot = createRoot(host);
    persistentRoot.render(<GlobalPresetValidationLauncher />);
  }, []);
  return null;
}
