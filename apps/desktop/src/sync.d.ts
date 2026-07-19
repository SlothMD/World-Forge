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
export declare function createLocalIdentity(timestamp?: string, id?: string): LocalUserIdentity;
export declare function normalizeIdentity(raw?: Partial<LocalUserIdentity>): LocalUserIdentity;
export declare function loadIdentity(storage?: KeyValueStorage | undefined): LocalUserIdentity;
export declare function saveIdentity(identity: LocalUserIdentity, storage?: KeyValueStorage | undefined): LocalUserIdentity;
export declare function normalizeCloudSyncSettings(raw?: Partial<CloudSyncSettings>): CloudSyncSettings;
export declare function loadCloudSyncSettings(storage?: KeyValueStorage | undefined): CloudSyncSettings;
export declare function saveCloudSyncSettings(settings: CloudSyncSettings, storage?: KeyValueStorage | undefined): CloudSyncSettings;
export declare function buildWorkspaceSettings(args: {
    config: GenerationConfig;
    contentLibrary: ContentLibraryConfig;
    tileExport: WorkspaceSettings['tileExport'];
    ui?: Partial<WorkspaceUiSettings>;
    savedMaps?: SavedMapRecord[];
}): WorkspaceSettings;
export declare function normalizeWorkspaceUiSettings(raw?: Partial<WorkspaceUiSettings> | undefined): WorkspaceUiSettings;
export declare function withSavedMaps(workspace: WorkspaceSettings, savedMaps: SavedMapRecord[]): WorkspaceSettings;
export declare function loadWorkspaceSettings(storage?: KeyValueStorage | undefined): Partial<WorkspaceSettings>;
export declare function saveWorkspaceSettings(workspace: WorkspaceSettings, storage?: KeyValueStorage | undefined): void;
export declare function buildSyncEnvelope(args: {
    identity: LocalUserIdentity;
    workspace: WorkspaceSettings;
    updatedAt?: string;
}): SyncEnvelope;
export declare function isSyncConfigured(settings: CloudSyncSettings): boolean;
export declare function isLoggedIn(identity: LocalUserIdentity): boolean;
export declare function isLocalOnlyIdentity(identity: LocalUserIdentity): boolean;
export declare function can(identity: LocalUserIdentity, capability: string): boolean;
export declare function createLocalSignedInIdentity(identity: LocalUserIdentity): LocalUserIdentity;
export declare function syncIdentity(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<LocalUserIdentity>;
export declare function pushSyncEnvelope(settings: CloudSyncSettings, identity: LocalUserIdentity, envelope: SyncEnvelope): Promise<SyncEnvelope>;
export declare function pullSyncEnvelope(settings: CloudSyncSettings, identity: LocalUserIdentity): Promise<SyncEnvelope | null>;
