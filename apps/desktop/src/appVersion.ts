export const APP_VERSION = '0.3.14';
export const APP_SOURCE_COMMIT = import.meta.env.VITE_WORLD_FORGE_COMMIT_SHA?.trim() || 'dev-local';

export function visibleAppVersion(version = APP_VERSION): string {
  return version;
}

export const APP_VISIBLE_VERSION = visibleAppVersion(APP_VERSION);
