import { ContentLibraryConfig, GenerationConfig, HexTileFeature } from '@world-forge/shared';

export type LocalUserIdentity = {
  schemaVersion: 1;
  profileId: string;
  authToken: string;
  displayName: string;
  externalIds: {
    googleId: string;
  };
  createdAt: string;
  updatedAt: string;
  premiumStatus: 'none' | 'unknown' | 'active';
};

export type CloudSyncSettings = {
  schemaVersion: 1;
  keepSynced: boolean;
  serviceBaseUrl: string;
  lastSyncedAt: string;
  lastPulledAt: string;
  lastError: string;
};

export type SavedMapRecord = {
  projectId: string;
  projectName: string;
  seed: string;
  updatedAt: string;
  serializedProject?: unknown;
};

export type WorkspaceSettings = {
  schemaVersion: 1;
  config: GenerationConfig;
  contentLibrary: ContentLibraryConfig;
  tileExport: {
    presetId: string;
    width: number;
    height: number;
    enabledFeatures: HexTileFeature[];
  };
  savedMaps: SavedMapRecord[];
};

export type SyncEnvelope = {
  format: 'world-forge-user-sync';
  formatVersion: 1;
  identity: LocalUserIdentity;
  workspace: WorkspaceSettings;
  updatedAt: string;
};

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const identityStorageKey = 'world_forge_identity_v1';
const cloudSyncStorageKey = 'world_forge_cloud_sync_v1';
const workspaceStorageKey = 'world_forge_workspace_v1';

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(storage: KeyValueStorage | undefined, key: string): Partial<T> {
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(key) || '{}') as Partial<T>;
  } catch {
    return {};
  }
}

export function createLocalIdentity(timestamp = nowIso(), id = randomId()): LocalUserIdentity {
  return {
    schemaVersion: 1,
    profileId: id,
    authToken: '',
    displayName: 'World Builder',
    externalIds: {
      googleId: ''
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    premiumStatus: 'none'
  };
}

export function normalizeIdentity(raw: Partial<LocalUserIdentity> = {}): LocalUserIdentity {
  const fallback = createLocalIdentity();
  return {
    schemaVersion: 1,
    profileId: String(raw.profileId || fallback.profileId),
    authToken: String(raw.authToken || ''),
    displayName: String(raw.displayName || '').trim() || 'World Builder',
    externalIds: {
      googleId: String(raw.externalIds?.googleId || '').trim()
    },
    createdAt: String(raw.createdAt || fallback.createdAt),
    updatedAt: String(raw.updatedAt || raw.createdAt || fallback.updatedAt),
    premiumStatus: raw.premiumStatus === 'active' || raw.premiumStatus === 'unknown' ? raw.premiumStatus : 'none'
  };
}

export function loadIdentity(storage: KeyValueStorage | undefined = globalThis.localStorage): LocalUserIdentity {
  return normalizeIdentity(readJson<LocalUserIdentity>(storage, identityStorageKey));
}

export function saveIdentity(identity: LocalUserIdentity, storage: KeyValueStorage | undefined = globalThis.localStorage) {
  const normalized = normalizeIdentity(identity);
  try {
    storage?.setItem(identityStorageKey, JSON.stringify(normalized));
  } catch (error) {
    console.warn('Unable to persist World Forge identity.', error);
  }
  return normalized;
}

export function normalizeCloudSyncSettings(raw: Partial<CloudSyncSettings> = {}): CloudSyncSettings {
  return {
    schemaVersion: 1,
    keepSynced: raw.keepSynced !== false,
    serviceBaseUrl: String(raw.serviceBaseUrl || defaultServiceBaseUrl()).trim(),
    lastSyncedAt: String(raw.lastSyncedAt || ''),
    lastPulledAt: String(raw.lastPulledAt || ''),
    lastError: String(raw.lastError || '')
  };
}

export function loadCloudSyncSettings(storage: KeyValueStorage | undefined = globalThis.localStorage): CloudSyncSettings {
  return normalizeCloudSyncSettings(readJson<CloudSyncSettings>(storage, cloudSyncStorageKey));
}

export function saveCloudSyncSettings(settings: CloudSyncSettings, storage: KeyValueStorage | undefined = globalThis.localStorage) {
  const normalized = normalizeCloudSyncSettings(settings);
  try {
    storage?.setItem(cloudSyncStorageKey, JSON.stringify(normalized));
  } catch (error) {
    console.warn('Unable to persist World Forge cloud sync settings.', error);
  }
  return normalized;
}

export function buildWorkspaceSettings(args: {
  config: GenerationConfig;
  contentLibrary: ContentLibraryConfig;
  tileExport: WorkspaceSettings['tileExport'];
  savedMaps?: SavedMapRecord[];
}): WorkspaceSettings {
  return {
    schemaVersion: 1,
    config: args.config,
    contentLibrary: args.contentLibrary,
    tileExport: {
      presetId: args.tileExport.presetId,
      width: Math.max(1, Math.round(args.tileExport.width)),
      height: Math.max(1, Math.round(args.tileExport.height)),
      enabledFeatures: [...args.tileExport.enabledFeatures]
    },
    savedMaps: compactSavedMaps(args.savedMaps ?? [])
  };
}

export function withSavedMaps(workspace: WorkspaceSettings, savedMaps: SavedMapRecord[]): WorkspaceSettings {
  return {
    ...workspace,
    savedMaps: compactSavedMaps(savedMaps)
  };
}

export function loadWorkspaceSettings(storage: KeyValueStorage | undefined = globalThis.localStorage): Partial<WorkspaceSettings> {
  const workspace = readJson<WorkspaceSettings>(storage, workspaceStorageKey);
  if (workspace.savedMaps) {
    return {
      ...workspace,
      savedMaps: compactSavedMaps(workspace.savedMaps)
    };
  }
  return workspace;
}

export function saveWorkspaceSettings(workspace: WorkspaceSettings, storage: KeyValueStorage | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(workspaceStorageKey, JSON.stringify(workspace));
  } catch (error) {
    console.warn('Unable to persist full World Forge workspace; retrying without saved map payloads.', error);
    try {
      storage?.setItem(
        workspaceStorageKey,
        JSON.stringify({
          ...workspace,
          savedMaps: compactSavedMaps(workspace.savedMaps)
        })
      );
    } catch (fallbackError) {
      console.warn('Unable to persist compact World Forge workspace.', fallbackError);
    }
  }
}

function compactSavedMaps(savedMaps: SavedMapRecord[]): SavedMapRecord[] {
  return savedMaps.map(({ projectId, projectName, seed, updatedAt }) => ({ projectId, projectName, seed, updatedAt }));
}

export function buildSyncEnvelope(args: {
  identity: LocalUserIdentity;
  workspace: WorkspaceSettings;
  updatedAt?: string;
}): SyncEnvelope {
  return {
    format: 'world-forge-user-sync',
    formatVersion: 1,
    identity: normalizeIdentity(args.identity),
    workspace: args.workspace,
    updatedAt: args.updatedAt ?? nowIso()
  };
}

export function isSyncConfigured(settings: CloudSyncSettings) {
  return settings.keepSynced && Boolean(settings.serviceBaseUrl);
}

export function isLoggedIn(identity: LocalUserIdentity) {
  return Boolean(identity.profileId && identity.authToken);
}

function defaultServiceBaseUrl() {
  const envUrl = (import.meta as { env?: { VITE_WORLD_FORGE_SERVICE_URL?: string } }).env?.VITE_WORLD_FORGE_SERVICE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return '';
}

function serviceUrl(settings: CloudSyncSettings, path: string) {
  return `${settings.serviceBaseUrl.replace(/\/+$/, '')}${path}`;
}

function authHeaders(identity: LocalUserIdentity) {
  return {
    'X-Player-Id': identity.profileId,
    'X-Player-Token': identity.authToken
  };
}

async function requestJson<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string })?.error || `Service request failed (${response.status})`);
  }
  return payload as T;
}

type IdentityPayload = {
  player: {
    playerId: string;
    authToken?: string;
    displayName: string;
    externalIds?: {
      googleId?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
};

function identityFromPayload(current: LocalUserIdentity, payload: IdentityPayload): LocalUserIdentity {
  return normalizeIdentity({
    ...current,
    profileId: payload.player.playerId,
    authToken: payload.player.authToken || current.authToken,
    displayName: payload.player.displayName,
    externalIds: {
      googleId: payload.player.externalIds?.googleId || current.externalIds.googleId
    },
    createdAt: payload.player.createdAt,
    updatedAt: payload.player.updatedAt
  });
}

export async function syncIdentity(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<LocalUserIdentity> {
  if (!settings.keepSynced || !settings.serviceBaseUrl) return identity;
  if (identity.authToken) {
    const payload = await requestJson<IdentityPayload>(serviceUrl(settings, '/api/identity/me'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(identity)
      },
      body: JSON.stringify({
        displayName: identity.displayName,
        externalIds: {
          googleId: identity.externalIds.googleId
        }
      })
    });
    return identityFromPayload(identity, payload);
  }
  const payload = await requestJson<IdentityPayload>(serviceUrl(settings, '/api/identity/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: identity.displayName,
      externalIds: {
        googleId: identity.externalIds.googleId
      }
    })
  });
  return identityFromPayload(identity, payload);
}

export async function pushSyncEnvelope(settings: CloudSyncSettings, identity: LocalUserIdentity, envelope: SyncEnvelope): Promise<SyncEnvelope> {
  if (!isSyncConfigured(settings) || !isLoggedIn(identity)) {
    throw new Error('Cloud sync requires service configuration and a signed-in profile.');
  }
  const response = await fetch(serviceUrl(settings, `/api/world-forge/user-sync/${encodeURIComponent(identity.profileId)}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(identity)
    },
    body: JSON.stringify(envelope)
  });
  if (!response.ok) {
    throw new Error(`Cloud push failed (${response.status})`);
  }
  return response.status === 204 ? envelope : ((await response.json()) as SyncEnvelope);
}

export async function pullSyncEnvelope(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<SyncEnvelope | null> {
  if (!isSyncConfigured(settings) || !isLoggedIn(identity)) {
    throw new Error('Cloud sync requires service configuration and a signed-in profile.');
  }
  const response = await fetch(serviceUrl(settings, `/api/world-forge/user-sync/${encodeURIComponent(identity.profileId)}`), {
    method: 'GET',
    headers: authHeaders(identity)
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Cloud pull failed (${response.status})`);
  }
  return (await response.json()) as SyncEnvelope;
}
