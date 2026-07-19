import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function ReleaseNotesModal({ version, onClose }: { version: string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return createPortal((
    <div className="modal-backdrop release-notes-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="release-notes-modal" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
        <header className="release-notes-header">
          <div>
            <span>Current build v{version}</span>
            <h2 id="release-notes-title">Release notes and roadmap</h2>
          </div>
          <button type="button" className="icon-button" title="Close release notes" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="release-notes-body">
          <section>
            <p className="release-kicker">Release 0.2.0</p>
            <h3>Detailed planet generation refinement</h3>
            <ul>
              <li>Reworked terrain, sea level, coastlines, erosion, hydrology, and biome generation into a more physically coherent planet pipeline.</li>
              <li>Added basin-aware atmospheric and ocean circulation, including packed gyre assignment, terrain steering, and coast-following currents.</li>
              <li>Reduced unsupported micro-biomes while retaining collapsed local detail for future zoomed-in terrain generation.</li>
              <li>Expanded generation diagnostics across climate, rivers, biome transitions, elevation, tree line, ice line, and validation matrices.</li>
              <li>Improved globe and map inspection, visual debugging modes, export behavior, saved worlds, and generation workflow reliability.</li>
            </ul>
          </section>

          <section className="release-roadmap">
            <p className="release-kicker">Roadmap</p>
            <article>
              <h3>Performance updates</h3>
              <p>Decompose generation into independently measurable nodes, then optimize each node without changing its output contract.</p>
            </article>
            <article>
              <h3>Visual options updates</h3>
              <p>Broaden presentation controls, layer styling, map and globe polish, and reusable visual presets.</p>
            </article>
            <article>
              <h3>VTT integration</h3>
              <p>Improve map packaging, grid metadata, scale controls, and direct workflows for common virtual tabletop platforms.</p>
            </article>
          </section>
        </div>
      </section>
    </div>
  ), document.body);
}
