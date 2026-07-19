import React from 'react';
import { Coffee, FolderOpen, Home, Mail, Settings, UserRound } from 'lucide-react';
import { createPortal } from 'react-dom';
import { APP_VERSION, APP_VISIBLE_VERSION } from '../appVersion';
import { resolveParchmentNavigation } from './parchmentNavigation';
import './shellStatus.css';

const SUPPORT_URL = 'https://buymeacoffee.com/SlothDC';

function openConfiguration() {
  const settings = document.querySelector<HTMLButtonElement>('button[title="Configure content sets"]');
  settings?.click();
}

function openReleaseNotes() {
  const releaseControl = document.querySelector<HTMLButtonElement>('.release-pill, .release-version-link');
  releaseControl?.click();
}

export function ShellStatusControls({ onFeedback }: { onFeedback: () => void }) {
  const navigation = resolveParchmentNavigation(window.location.href);

  return createPortal(
    <header className="shell-status-controls" aria-label="Parchment Worlds: World Forge application header">
      <a className="shell-product-identity" href={navigation.landingUrl} title="Return to the Parchment Worlds landing page">
        <strong>Parchment Worlds: World Forge</strong>
      </a>
      <div className="shell-header-spacer" />
      <a className="shell-status-button" href={navigation.landingUrl} title="Parchment Worlds landing page" aria-label="Parchment Worlds landing page">
        <Home size={17} aria-hidden="true" />
      </a>
      <a className="shell-status-button" href={navigation.projectsUrl} title="My Parchment Worlds projects" aria-label="My Parchment Worlds projects">
        <FolderOpen size={17} aria-hidden="true" />
      </a>
      <button type="button" className="shell-status-button shell-feedback-button" title="Contact Parchment Worlds support" aria-label="Contact Parchment Worlds support" onClick={onFeedback}>
        <Mail size={17} aria-hidden="true" />
      </button>
      <a className="shell-status-button shell-support-button" href={SUPPORT_URL} rel="noreferrer" target="_blank" title="Support Parchment Worlds development" aria-label="Support Parchment Worlds development">
        <Coffee size={17} aria-hidden="true" />
      </a>
      <a className="shell-status-button shell-account-button" href={navigation.accountUrl} title="Open the Parchment Worlds account page" aria-label="Open the Parchment Worlds account page">
        <UserRound size={17} aria-hidden="true" />
      </a>
      <button type="button" className="shell-version-badge" title={`Open World Forge release notes and roadmap for build ${APP_VERSION}`} aria-label={`Open World Forge release notes and roadmap for version ${APP_VISIBLE_VERSION}`} onClick={openReleaseNotes}>v{APP_VISIBLE_VERSION}</button>
      <button type="button" className="shell-status-button shell-config-button" title="Configure World Forge" aria-label="Configure World Forge" onClick={openConfiguration}>
        <Settings size={17} aria-hidden="true" />
      </button>
    </header>,
    document.body,
  );
}
