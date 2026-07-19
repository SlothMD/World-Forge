export const APP_VERSION = '0.3.8';

export function visibleAppVersion(version = APP_VERSION): string {
  return version;
}

export const APP_VISIBLE_VERSION = visibleAppVersion(APP_VERSION);
