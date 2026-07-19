import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, CircleDot, Clock3, Focus, LoaderCircle, Maximize2, Minus, PanelRightOpen, Play, Plus, RotateCcw, Save, Search, SkipForward, Workflow, X, XCircle } from 'lucide-react';
import { developerGenerationRunEvent, type DeveloperGenerationRunDetail } from '../generation/generationEvents';

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

type Viewport = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.8;
const DEFAULT_VIEWPORT: Viewport = { x: 34, y: 70, zoom: 0.78 };

function statusIcon(status: GraphNodeStatus) {
  if (status === 'running') return <LoaderCircle size={16} className="graph-node-spinner" />;
  if (status === 'complete' || status === 'retained') return <CheckCircle2 size={16} />;
  if (status === 'warning') return <AlertTriangle size={16} />;
  if (status === 'failed') return <XCircle size={16} />;
  if (status === 'skipped') return <SkipForward size={16} />;
  return <CircleDot size={16} />;
}

function statusLabel(status: GraphNodeStatus): string {
  if (status === 'retained') return 'Retained input';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function collapseApplicationPanels(): void {
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) return;
  if (!shell.classList.contains('left-collapsed')) {
    document.querySelector<HTMLButtonElement>('.toolbar .panel-toggle')?.click();
  }
  if (!shell.classList.contains('right-collapsed')) {
    document.querySelector<HTMLButtonElement>('.summary .panel-toggle')?.click();
  }
}

export function GraphWorkspace({
  node: nodes,
  selectedNodeId,
  toolbar,
  onSelectNode,
  onWorkflowChange,
  onFidelityChange,
  onSeedChange,
  onValidate,
  onReset
}: GraphWorkspaceProps) {
  const selected = nodes.find((candidate) => candidate.id === selectedNodeId) ?? null;
  const running = nodes.find((candidate) => candidate.status === 'running');
  const completedCount = nodes.filter((candidate) => candidate.status === 'complete' || candidate.status === 'retained').length;
  const runDisabledReason = running
    ? 'A generation run is already active.'
    : '';
  const canRun = !runDisabledReason;
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastManualNavigationRef = useRef(0);

  const runGraph = () => {
    if (!canRun) return;
    const detail: DeveloperGenerationRunDetail = {
      seed: toolbar.seed,
      startNodeId: null
    };
    window.dispatchEvent(new CustomEvent<DeveloperGenerationRunDetail>(developerGenerationRunEvent, { detail }));
  };

  const zoomAroundPoint = useCallback((nextZoom: number, pointerX?: number, pointerY?: number) => {
    lastManualNavigationRef.current = performance.now();
    setViewport((current) => {
      const zoom = clampZoom(nextZoom);
      if (pointerX === undefined || pointerY === undefined) return { ...current, zoom };
      const contentX = (pointerX - current.x) / current.zoom;
      const contentY = (pointerY - current.y) / current.zoom;
      return { zoom, x: pointerX - contentX * zoom, y: pointerY - contentY * zoom };
    });
  }, []);

  const calculateFit = useCallback(() => {
    const host = viewportRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const contentWidth = Math.max(1, canvas.offsetWidth);
    const contentHeight = Math.max(1, canvas.offsetHeight);
    const availableWidth = Math.max(1, host.clientWidth - 48);
    const availableHeight = Math.max(1, host.clientHeight - 48);
    const zoom = clampZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
    setViewport({
      zoom,
      x: (host.clientWidth - contentWidth * zoom) / 2,
      y: (host.clientHeight - contentHeight * zoom) / 2
    });
  }, []);

  const fitToView = useCallback(() => {
    setInspectorOpen(false);
    collapseApplicationPanels();
    window.requestAnimationFrame(() => window.requestAnimationFrame(calculateFit));
  }, [calculateFit]);

  const focusNode = useCallback((nodeId?: string) => {
    if (!nodeId) return;
    const host = viewportRef.current;
    const target = nodeRefs.current.get(nodeId);
    if (!host || !target) return;
    const targetCenterX = target.offsetLeft + target.offsetWidth / 2;
    const targetCenterY = target.offsetTop + target.offsetHeight / 2;
    setViewport((current) => ({
      ...current,
      x: host.clientWidth / 2 - targetCenterX * current.zoom,
      y: host.clientHeight / 2 - targetCenterY * current.zoom
    }));
  }, []);

  const inspectNode = useCallback((nodeId: string) => {
    setInspectorOpen(true);
    onSelectNode(nodeId);
  }, [onSelectNode]);

  useEffect(() => {
    if (!running || performance.now() - lastManualNavigationRef.current < 1800) return;
    focusNode(running.id);
  }, [focusNode, running?.id]);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = host.getBoundingClientRect();
      zoomAroundPoint(
        viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1),
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [viewport.zoom, zoomAroundPoint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!viewportRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomAroundPoint(viewport.zoom + 0.1);
      } else if (event.key === '-') {
        event.preventDefault();
        zoomAroundPoint(viewport.zoom - 0.1);
      } else if (event.key === '0') {
        event.preventDefault();
        fitToView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fitToView, viewport.zoom, zoomAroundPoint]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    lastManualNavigationRef.current = performance.now();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewport((current) => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }));
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <section className="graph-workspace" aria-label="Generation workflow graph">
      <div className="graph-toolbar">
        <div className="graph-toolbar-primary">
          <button type="button" title="New workflow" disabled><CircleDot size={16} />New</button>
          <button type="button" title="Save workflow" disabled><Save size={16} />Save</button>
          <button type="button" onClick={runGraph} disabled={!canRun} title={runDisabledReason || 'Run the full generation graph'}>
            <Play size={16} />Run
          </button>
          <button type="button" onClick={onValidate}><Activity size={16} />Validate</button>
          <button type="button" onClick={onReset} disabled={Boolean(running)} title="Reset graph selection and live run state"><RotateCcw size={16} />Reset</button>
        </div>
        <div className="graph-toolbar-fields">
          <label>
            Workflow
            <select value={toolbar.workflowId} onChange={(event) => onWorkflowChange(event.target.value)} disabled={Boolean(running)}>
              <option value="core.live-world">Live world generation</option>
            </select>
          </label>
          <label>
            Fidelity
            <select value={toolbar.fidelity} onChange={(event) => onFidelityChange(event.target.value)} disabled={Boolean(running)}>
              <option value="preview">Preview</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="diagnostic">Diagnostic</option>
            </select>
          </label>
          <label>
            Seed
            <input value={toolbar.seed} onChange={(event) => onSeedChange(event.target.value.replace(/\D/g, ''))} disabled={Boolean(running)} />
          </label>
        </div>
        <div className={`graph-run-notice ${runDisabledReason ? 'blocked' : ''}`}>
          {runDisabledReason || (selected ? `Inspecting ${selected.label}. Run executes the full graph to produce a complete world.` : 'No node selected. Run executes the full graph from topology construction.')}
        </div>
      </div>

      <div className={`graph-stage ${inspectorOpen ? '' : 'inspector-closed'}`}>
        <div className="graph-grid-shell">
          <div className="graph-run-summary">
            <span><Workflow size={16} />{running ? `Running: ${running.label}` : completedCount === nodes.length ? 'Last run complete' : 'Waiting for generation'}</span>
            <span>{completedCount}/{nodes.length} stages complete</span>
          </div>
          <div className="graph-viewport-controls" aria-label="Graph viewport controls">
            <button type="button" className="icon-button" title="Zoom out" onClick={() => zoomAroundPoint(viewport.zoom - 0.1)}><Minus size={16} /></button>
            <output>{Math.round(viewport.zoom * 100)}%</output>
            <button type="button" className="icon-button" title="Zoom in" onClick={() => zoomAroundPoint(viewport.zoom + 0.1)}><Plus size={16} /></button>
            <button type="button" className="icon-button" title="Fit graph to screen and collapse app panels" onClick={fitToView}><Maximize2 size={16} /></button>
            <button type="button" className="icon-button" title="Focus selected or running node" onClick={() => focusNode(selected?.id ?? running?.id ?? nodes[0]?.id)}><Focus size={16} /></button>
            {!inspectorOpen && <button type="button" className="icon-button" title="Show node details" onClick={() => setInspectorOpen(true)}><PanelRightOpen size={16} /></button>}
          </div>
          <div
            ref={viewportRef}
            className={`graph-viewport ${dragRef.current ? 'dragging' : ''}`}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <div className="graph-pan-layer" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
              <div ref={canvasRef} className="graph-node-chain">
                {nodes.map((graphNode, index) => (
                  <React.Fragment key={graphNode.id}>
                    <button
                      ref={(element) => {
                        if (element) nodeRefs.current.set(graphNode.id, element);
                        else nodeRefs.current.delete(graphNode.id);
                      }}
                      type="button"
                      className={`graph-node status-${graphNode.status} ${selectedNodeId === graphNode.id ? 'selected' : ''}`}
                      onClick={() => inspectNode(graphNode.id)}
                      aria-pressed={selectedNodeId === graphNode.id}
                    >
                      <span className="graph-node-header">
                        {statusIcon(graphNode.status)}
                        <span>{statusLabel(graphNode.status)}</span>
                        {graphNode.elapsedMs !== undefined && <small>{Math.round(graphNode.elapsedMs).toLocaleString()} ms elapsed</small>}
                      </span>
                      <strong>{graphNode.label}</strong>
                      <code>{graphNode.stageId}</code>
                      <span className="graph-node-description">{graphNode.description}</span>
                      <span className="graph-node-progress" aria-label={`${Math.round(graphNode.progress * 100)} percent complete`}>
                        <i style={{ width: `${Math.round(graphNode.progress * 100)}%` }} />
                      </span>
                      <span className="graph-node-ports">
                        <span className="input-port">{graphNode.inputs.length} input{graphNode.inputs.length === 1 ? '' : 's'}</span>
                        <span className="output-port">{graphNode.outputs.length} output{graphNode.outputs.length === 1 ? '' : 's'}</span>
                      </span>
                    </button>
                    {index < nodes.length - 1 && (
                      <div className={`graph-edge ${graphNode.status === 'complete' || graphNode.status === 'retained' ? 'complete' : ''}`} aria-hidden="true"><span /></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {inspectorOpen && (
          <aside className="graph-inspector" aria-label="Selected graph node">
            <div className="graph-inspector-title">
              <Search size={16} /><strong>Node details</strong>
              <button type="button" className="icon-button graph-inspector-close" title="Close node details" onClick={() => setInspectorOpen(false)}><X size={16} /></button>
            </div>
            {selected ? (
              <>
                <h2>{selected.label}</h2>
                <p>{selected.description}</p>
                <div className={`graph-live-status status-${selected.status}`}>
                  {statusIcon(selected.status)}
                  <strong>{statusLabel(selected.status)}</strong>
                  {selected.elapsedMs !== undefined && <span><Clock3 size={14} />{Math.round(selected.elapsedMs).toLocaleString()} ms</span>}
                </div>
                <dl>
                  <div><dt>Stage ID</dt><dd><code>{selected.stageId}</code></dd></div>
                  <div><dt>Implementation</dt><dd><code>{selected.implementationId}</code></dd></div>
                  <div><dt>Inputs</dt><dd>{selected.inputs.length ? selected.inputs.join(', ') : 'None'}</dd></div>
                  <div><dt>Outputs</dt><dd>{selected.outputs.join(', ')}</dd></div>
                  <div><dt>Fidelity</dt><dd>{selected.fidelity.join(', ')}</dd></div>
                </dl>
                <section className="graph-artifacts">
                  <h3>Artifact summary</h3>
                  {selected.artifactSummary.length ? <ul>{selected.artifactSummary.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No completed artifact summary is available for this stage yet.</p>}
                </section>
                {selected.findings.length > 0 && <section className="graph-findings"><h3>Findings</h3><ul>{selected.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul></section>}
                <div className={`graph-validation ${toolbar.validationStatus === 'valid' ? 'validated' : ''}`}>
                  {toolbar.validationStatus === 'valid' ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                  <span>{toolbar.validationStatus === 'valid' ? 'Workflow shape validated' : 'Not validated in this session'}</span>
                </div>
                <div className="graph-summary"><span>core.live-world@0.3.1</span><span>{nodes.length} stages</span><span>{Math.max(0, nodes.length - 1)} edges</span></div>
              </>
            ) : (
              <div className="dev-empty-inspector">Select a graph node to inspect its contract and live run state. Leave all nodes unselected to run from the beginning.</div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
