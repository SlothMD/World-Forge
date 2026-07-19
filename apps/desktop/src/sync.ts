import { ContentLibraryConfig, GenerationConfig, HexTileFeature } from '@world-forge/shared';

export type IdentityProvider = 'google' | 'steam';
export type EntitlementTier = 'free' | 'pro' | 'admin';

export type LinkedIdentity = {
  provider: IdentityProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  linkedAt: string;
};

export type UserProfile = {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  tier: EntitlementTier;
  modules: string[];
  linkedIdentities: LinkedIdentity[];
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
};

export type UserPreferences = {
  renderMode?: string;
  mapMode?: string;
  defaultResolution?: {
    width: number;
    height: number;
  };
  globe?: {
    oceanShellEnabled?: boolean;
    atmosphereEnabled?: boolean;
    cloudsEnabled?: boolean;
    terrainExaggeration?: number;
    oceanShellOpacity?: number;
    cloudOpacity?: number;
  };
  ui?: Partial<WorkspaceUiSettings>;
  generationDefaults?: Record<string, unknown>;
  updatedAt: string;
};

export type UserPreferencesEnvelope = {
  schemaVersion: 1;
  preferences: UserPreferences;
  updatedAt: string;
};

export type Entitlements = {
  tier: EntitlementTier;
  modules: Record<string, boolean>;
  capabilities: Record<string, boolean>;
  grantSource?: 'manual' | 'purchase_provider' | 'bootstrap_admin' | 'dev' | 'anonymous';
  updatedAt: string;
};

export type LocalUserIdentity = {
  schemaVersion: 1;
  userId: string;
  profileId: string;
  authToken: string;
  firebaseIdToken?: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  externalIds: {
    googleId: string;
    steamId: string;
  };
  linkedIdentities: LinkedIdentity[];
  profile: UserProfile;
  preferencesEnvelope: UserPreferencesEnvelope;
  entitlements: Entitlements;
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

export type WorkspaceUiSettings = {
  selectedPreset: string;
  previewResolution: {
    width: number;
    height: number;
  };
  exportResolution: {
    width: number;
    height: number;
  };
  vttResolution: {
    width: number;
    height: number;
  };
  vttGridEnabled: boolean;
  vttHexSizeMiles: number;
  showPlates: boolean;
  showRivers: boolean;
  showHexes: boolean;
  mapMode: string;
  renderMode: string;
  coastlineTreatment: string;
  viewMode: string;
  rightPanelTab: string;
  leftPanelTab: string;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  mapZoom: number;
  globeZoom: number;
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
  ui?: Partial<WorkspaceUiSettings>;
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

function anonymousEntitlements(timestamp = nowIso()): Entitlements {
  return {
    tier: 'free',
    modules: {},
    capabilities: {
      local_preferences: true,
      local_world_saves: true,
      cloud_preferences: false,
      cloud_world_saves: false,
      high_resolution_exports: false,
      advanced_visuals: false,
      admin_content_tools: false,
      dev_diagnostics: true,
      module_management: false,
      experimental_features: false
    },
    grantSource: 'anonymous',
    updatedAt: timestamp
  };
}

function preferencesEnvelope(timestamp = nowIso(), preferences: Partial<UserPreferences> = {}): UserPreferencesEnvelope {
  return {
    schemaVersion: 1,
    preferences: {
      ...preferences,
      updatedAt: String(preferences.updatedAt || timestamp)
    },
    updatedAt: String(preferences.updatedAt || timestamp)
  };
}

function normalizeLinkedIdentities(raw: Partial<LinkedIdentity>[] | undefined, timestamp = nowIso()): LinkedIdentity[] {
  const byProviderAndId = new Map<string, LinkedIdentity>();
  for (const entry of raw ?? []) {
    const provider = entry.provider === 'steam' ? 'steam' : entry.provider === 'google' ? 'google' : null;
    const providerUserId = String(entry.providerUserId || '').trim();
    if (!provider || !providerUserId) continue;
    byProviderAndId.set(`${provider}:${providerUserId}`, {
      provider,
      providerUserId,
      email: String(entry.email || '').trim() || undefined,
      displayName: String(entry.displayName || '').trim() || undefined,
      avatarUrl: String(entry.avatarUrl || '').trim() || undefined,
      linkedAt: String(entry.linkedAt || timestamp)
    });
  }
  return [...byProviderAndId.values()];
}

function normalizeEntitlements(raw: Partial<Entitlements> | undefined, timestamp = nowIso()): Entitlements {
  const fallback = anonymousEntitlements(timestamp);
  const tier = raw?.tier === 'admin' || raw?.tier === 'pro' ? raw.tier : 'free';
  const capabilities = {
    ...fallback.capabilities,
    ...(tier === 'pro' || tier === 'admin' ? {
      cloud_preferences: true,
      high_resolution_exports: true,
      advanced_visuals: true
    } : {}),
    ...(tier === 'admin' ? {
      admin_content_tools: true,
      module_management: true,
      experimental_features: true
    } : {}),
    ...(raw?.capabilities ?? {})
  };
  return {
    tier,
    modules: { ...(raw?.modules ?? {}) },
    capabilities,
    grantSource: raw?.grantSource ?? fallback.grantSource,
    updatedAt: String(raw?.updatedAt || timestamp)
  };
}

function normalizePreferencesEnvelope(raw: Partial<UserPreferencesEnvelope> | undefined, timestamp = nowIso()): UserPreferencesEnvelope {
  return preferencesEnvelope(String(raw?.updatedAt || timestamp), raw?.preferences ?? {});
}

function profileForIdentity(args: {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  linkedIdentities: LinkedIdentity[];
  entitlements: Entitlements;
  createdAt: string;
  updatedAt: string;
}): UserProfile {
  return {
    userId: args.userId,
    displayName: args.displayName,
    email: args.email || undefined,
    avatarUrl: args.avatarUrl || undefined,
    tier: args.entitlements.tier,
    modules: Object.entries(args.entitlements.modules).filter(([, enabled]) => enabled).map(([module]) => module),
    linkedIdentities: args.linkedIdentities,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt
  };
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
  const entitlements = anonymousEntitlements(timestamp);
  const linkedIdentities: LinkedIdentity[] = [];
  const profile = profileForIdentity({
    userId: id,
    displayName: 'Parchment Worldbuilder',
    email: '',
    avatarUrl: '',
    linkedIdentities,
    entitlements,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return {
    schemaVersion: 1,
    userId: id,
    profileId: id,
    authToken: '',
    displayName: 'Parchment Worldbuilder',
    email: '',
    avatarUrl: '',
    externalIds: {
      googleId: '',
      steamId: ''
    },
    linkedIdentities,
    profile,
    preferencesEnvelope: preferencesEnvelope(timestamp),
    entitlements,
    createdAt: timestamp,
    updatedAt: timestamp,
    premiumStatus: 'none'
  };
}

export function normalizeIdentity(raw: Partial<LocalUserIdentity> = {}): LocalUserIdentity {
  const fallback = createLocalIdentity();
  const timestamp = String(raw.updatedAt || raw.createdAt || fallback.updatedAt);
  const userId = String(raw.userId || raw.profileId || fallback.userId);
  const externalLinkedIdentities: LinkedIdentity[] = [
    ...(raw.externalIds?.googleId ? [{
      provider: 'google' as const,
      providerUserId: String(raw.externalIds.googleId),
      linkedAt: timestamp
    }] : []),
    ...(raw.externalIds?.steamId ? [{
      provider: 'steam' as const,
      providerUserId: String(raw.externalIds.steamId),
      linkedAt: timestamp
    }] : [])
  ];
  const linkedIdentities = normalizeLinkedIdentities([...(raw.linkedIdentities ?? []), ...externalLinkedIdentities], timestamp);
  const googleId = linkedIdentities.find((entry) => entry.provider === 'google')?.providerUserId || String(raw.externalIds?.googleId || '').trim();
  const steamId = linkedIdentities.find((entry) => entry.provider === 'steam')?.providerUserId || String(raw.externalIds?.steamId || '').trim();
  const entitlements = normalizeEntitlements(raw.entitlements, timestamp);
  const displayName = String(raw.displayName || raw.profile?.displayName || '').trim() || 'Parchment Worldbuilder';
  const email = String(raw.email || raw.profile?.email || '').trim();
  const avatarUrl = String(raw.avatarUrl || raw.profile?.avatarUrl || '').trim();
  const createdAt = String(raw.createdAt || raw.profile?.createdAt || fallback.createdAt);
  const updatedAt = String(raw.updatedAt || raw.profile?.updatedAt || fallback.updatedAt);
  const profile = profileForIdentity({
    userId,
    displayName,
    email,
    avatarUrl,
    linkedIdentities,
    entitlements,
    createdAt,
    updatedAt
  });
  return {
    schemaVersion: 1,
    userId,
    profileId: String(raw.profileId || raw.userId || fallback.profileId),
    authToken: String(raw.authToken || ''),
    displayName,
    email,
    avatarUrl,
    externalIds: {
      googleId,
      steamId
    },
    linkedIdentities,
    profile,
    preferencesEnvelope: normalizePreferencesEnvelope(raw.preferencesEnvelope, updatedAt),
    entitlements,
    createdAt,
    updatedAt,
    premiumStatus: entitlements.tier === 'pro' || entitlements.tier === 'admin'
      ? 'active'
      : raw.premiumStatus === 'unknown'
        ? 'unknown'
        : 'none'
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
    console.warn('Unable to persist Parchment Worlds identity.', error);
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
    console.warn('Unable to persist Parchment Worlds cloud sync settings.', error);
  }
  return normalized;
}

export function buildWorkspaceSettings(args: {
  config: GenerationConfig;
  contentLibrary: ContentLibraryConfig;
  tileExport: WorkspaceSettings['tileExport'];
  ui?: Partial<WorkspaceUiSettings>;
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
    ui: args.ui ? normalizeWorkspaceUiSettings(args.ui) : undefined,
    savedMaps: compactSavedMaps(args.savedMaps ?? [])
  };
}

export function normalizeWorkspaceUiSettings(raw: Partial<WorkspaceUiSettings> | undefined = {}): WorkspaceUiSettings {
  const cleanResolution = (resolution: Partial<WorkspaceUiSettings['previewResolution']> | undefined, fallback: { width: number; height: number }) => ({
    width: Math.max(0, Math.round(Number(resolution?.width ?? fallback.width))),
    height: Math.max(0, Math.round(Number(resolution?.height ?? fallback.height)))
  });
  return {
    selectedPreset: String(raw.selectedPreset || 'Earthlike'),
    previewResolution: cleanResolution(raw.previewResolution, { width: 1024, height: 512 }),
    exportResolution: cleanResolution(raw.exportResolution, { width: 512, height: 256 }),
    vttResolution: cleanResolution(raw.vttResolution, { width: 1024, height: 512 }),
    vttGridEnabled: raw.vttGridEnabled !== false,
    vttHexSizeMiles: Math.max(1, Number(raw.vttHexSizeMiles ?? 1200)),
    showPlates: raw.showPlates === true,
    showRivers: raw.showRivers !== false,
    showHexes: raw.showHexes === true,
    mapMode: String(raw.mapMode || 'biomes'),
    renderMode: String(raw.renderMode || 'data'),
    coastlineTreatment: String(raw.coastlineTreatment || 'toned'),
    viewMode: String(raw.viewMode || 'map'),
    rightPanelTab: String(raw.rightPanelTab || 'world'),
    leftPanelTab: String(raw.leftPanelTab || 'generator'),
    leftPanelCollapsed: raw.leftPanelCollapsed === true,
    rightPanelCollapsed: raw.rightPanelCollapsed === true,
    mapZoom: cleanZoom(raw.mapZoom),
    globeZoom: cleanZoom(raw.globeZoom)
  };
}

function cleanZoom(value: unknown): number {
  const parsed = Number(value ?? 1);
  return Math.max(0.75, Math.min(8, Number.isFinite(parsed) ? parsed : 1));
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
    console.warn('Unable to persist full Parchment Worlds workspace; retrying without saved map payloads.', error);
    try {
      storage?.setItem(
        workspaceStorageKey,
        JSON.stringify({
          ...workspace,
          savedMaps: compactSavedMaps(workspace.savedMaps)
        })
      );
    } catch (fallbackError) {
      console.warn('Unable to persist compact Parchment Worlds workspace.', fallbackError);
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

export function isLocalOnlyIdentity(identity: LocalUserIdentity) {
  return identity.authToken.startsWith('local-');
}

export function can(identity: LocalUserIdentity, capability: string) {
  return normalizeIdentity(identity).entitlements.capabilities[capability] === true;
}

export function createLocalSignedInIdentity(identity: LocalUserIdentity): LocalUserIdentity {
  const timestamp = nowIso();
  return normalizeIdentity({
    ...identity,
    authToken: identity.authToken || `local-${randomId()}`,
    updatedAt: timestamp
  });
}

function defaultServiceBaseUrl() {
  const envUrl = configuredServiceUrl();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return '';
}

function configuredServiceUrl() {
  return (import.meta as { env?: { VITE_WORLD_FORGE_SERVICE_URL?: string } }).env?.VITE_WORLD_FORGE_SERVICE_URL?.trim() ?? '';
}

function isUnconfiguredAppOrigin(settings: CloudSyncSettings) {
  if (configuredServiceUrl()) return false;
  if (typeof window === 'undefined') return false;
  return settings.serviceBaseUrl.replace(/\/+$/, '') === window.location.origin.replace(/\/+$/, '');
}

function serviceUrl(settings: CloudSyncSettings, path: string) {
  return `${settings.serviceBaseUrl.replace(/\/+$/, '')}${path}`;
}

function authHeaders(identity: LocalUserIdentity) {
  const headers: Record<string, string> = {
    'X-Player-Id': identity.profileId,
    'X-Player-Token': identity.authToken
  };
  if (identity.firebaseIdToken) headers.Authorization = `Bearer ${identity.firebaseIdToken}`;
  return headers;
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
    userId?: string;
    authToken?: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    externalIds?: {
      googleId?: string;
      steamId?: string;
    };
    linkedIdentities?: LinkedIdentity[];
    preferencesEnvelope?: UserPreferencesEnvelope;
    entitlements?: Entitlements;
    createdAt: string;
    updatedAt: string;
  };
};

function identityFromPayload(current: LocalUserIdentity, payload: IdentityPayload): LocalUserIdentity {
  return normalizeIdentity({
    ...current,
    userId: payload.player.userId || payload.player.playerId,
    profileId: payload.player.playerId,
    authToken: payload.player.authToken || current.authToken,
    firebaseIdToken: undefined,
    displayName: payload.player.displayName,
    email: payload.player.email || current.email,
    avatarUrl: payload.player.avatarUrl || current.avatarUrl,
    externalIds: {
      googleId: payload.player.externalIds?.googleId || current.externalIds.googleId,
      steamId: payload.player.externalIds?.steamId || current.externalIds.steamId
    },
    linkedIdentities: payload.player.linkedIdentities || current.linkedIdentities,
    preferencesEnvelope: payload.player.preferencesEnvelope || current.preferencesEnvelope,
    entitlements: payload.player.entitlements || current.entitlements,
    createdAt: payload.player.createdAt,
    updatedAt: payload.player.updatedAt
  });
}

export async function syncIdentity(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<LocalUserIdentity> {
  if (isUnconfiguredAppOrigin(settings)) return createLocalSignedInIdentity(identity);
  if (!settings.keepSynced || !settings.serviceBaseUrl) return createLocalSignedInIdentity(identity);
  if ((!identity.authToken || isLocalOnlyIdentity(identity)) && !identity.firebaseIdToken) {
    return createLocalSignedInIdentity(identity);
  }
  if (identity.authToken && !isLocalOnlyIdentity(identity)) {
    try {
      const payload = await requestJson<IdentityPayload>(serviceUrl(settings, '/api/identity/me'), {
        method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(identity)
      },
        body: JSON.stringify({
          userId: identity.userId,
          displayName: identity.displayName,
          email: identity.email,
          avatarUrl: identity.avatarUrl,
          externalIds: {
            googleId: identity.externalIds.googleId,
            steamId: identity.externalIds.steamId
          },
          linkedIdentities: identity.linkedIdentities,
          preferencesEnvelope: identity.preferencesEnvelope
        })
      });
      return identityFromPayload(identity, payload);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        if (identity.firebaseIdToken) return registerIdentity(settings, identity);
        return createLocalSignedInIdentity({ ...identity, authToken: '' });
      }
      if (isMissingServiceError(error)) return createLocalSignedInIdentity(identity);
      throw error;
    }
  }
  return registerIdentity(settings, identity);
}

async function registerIdentity(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<LocalUserIdentity> {
  if (!identity.firebaseIdToken) return createLocalSignedInIdentity(identity);
  try {
    const payload = await requestJson<IdentityPayload>(serviceUrl(settings, '/api/identity/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(identity)
      },
      body: JSON.stringify({
        userId: identity.userId,
        displayName: identity.displayName,
        email: identity.email,
        avatarUrl: identity.avatarUrl,
        externalIds: {
          googleId: identity.externalIds.googleId,
          steamId: identity.externalIds.steamId
        },
        linkedIdentities: identity.linkedIdentities,
        preferencesEnvelope: identity.preferencesEnvelope
      })
    });
    return identityFromPayload(identity, payload);
  } catch (error) {
    if (isMissingServiceError(error)) return createLocalSignedInIdentity(identity);
    throw error;
  }
}

export async function pushSyncEnvelope(settings: CloudSyncSettings, identity: LocalUserIdentity, envelope: SyncEnvelope): Promise<SyncEnvelope> {
  if (!isSyncConfigured(settings) || !isLoggedIn(identity) || isLocalOnlyIdentity(identity)) {
    throw new Error('Cloud sync requires service configuration and a service-backed signed-in profile.');
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
  if (!isSyncConfigured(settings) || !isLoggedIn(identity) || isLocalOnlyIdentity(identity)) {
    throw new Error('Cloud sync requires service configuration and a service-backed signed-in profile.');
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

function isMissingServiceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|failed to fetch|remote service is not configured/i.test(message);
}

function isUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /401|unauthorized|invalid app identity token|missing app identity token|missing firebase bearer token/i.test(message);
}
