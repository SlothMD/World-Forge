import './styles.css';
import { readParchmentContext } from './parchmentContext';

const context = readParchmentContext(window.location.search);
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('World Forge root element was not found.');
}

app.innerHTML = `
  <main class="world-forge-shell">
    <section class="tool-panel">
      <p class="eyebrow">Public tool app</p>
      <h1>World Forge</h1>
      <p class="lede">
        This public repository is now the runnable World Forge app boundary. The generator implementation will be ported here in focused modules without private product state.
      </p>
      <dl class="context-grid" aria-label="Parchment Worlds project context">
        <div>
          <dt>Contract</dt>
          <dd>${escapeHtml(context.contractVersion)}</dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>${escapeHtml(context.projectName)}</dd>
        </div>
        <div>
          <dt>Project ID</dt>
          <dd><code>${escapeHtml(context.projectId)}</code></dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>${escapeHtml(context.revision)}</dd>
        </div>
      </dl>
    </section>
  </main>
`;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
