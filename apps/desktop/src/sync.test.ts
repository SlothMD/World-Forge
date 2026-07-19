import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, defaultContentLibrary } from '@world-forge/shared';
import {
  buildSyncEnvelope,
  buildWorkspaceSettings,
  can,
  createLocalSignedInIdentity,
  createLocalIdentity,
  isSyncConfigured,
  isLocalOnlyIdentity,
  normalizeCloudSyncSettings,
  normalizeIdentity,
  normalizeWorkspaceUiSettings,
  syncIdentity
} from './sync';

describe('sync helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a stable local identity shape', () => {
    const identity = createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-1');

    expect(identity).toEqual({
      schemaVersion: 1,
      userId: 'profile-1',
      profileId: 'profile-1',
      authToken: '',
      displayName: 'Parchment Worldbuilder',
      email: '',
      avatarUrl: '',
      externalIds: {
        googleId: '',
        steamId: ''
      },
      linkedIdentities: [],
      profile: {
        userId: 'profile-1',
        displayName: 'Parchment Worldbuilder',
        tier: 'free',
        modules: [],
        linkedIdentities: [],
        createdAt: '2026-06-29T12:00:00.000Z',
        updatedAt: '2026-06-29T12:00:00.000Z'
      },
      preferencesEnvelope: {
        schemaVersion: 1,
        preferences: {
          updatedAt: '2026-06-29T12:00:00.000Z'
        },
        updatedAt: '2026-06-29T12:00:00.000Z'
      },
      entitlements: {
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
        updatedAt: '2026-06-29T12:00:00.000Z'
      },
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      premiumStatus: 'none'
    });
  });

  it('normalizes incomplete identity and cloud settings records', () => {
    expect(normalizeIdentity({ profileId: 'profile-2', displayName: '  Ada  ', premiumStatus: 'active' }).displayName).toBe('Ada');
    expect(normalizeCloudSyncSettings({ serviceBaseUrl: ' https://sync.example.test/ ', keepSynced: true }).serviceBaseUrl).toBe(
      'https://sync.example.test/'
    );
    expect(isSyncConfigured(normalizeCloudSyncSettings({ serviceBaseUrl: 'https://sync.example.test', keepSynced: true }))).toBe(
      true
    );
    expect(normalizeCloudSyncSettings({}).keepSynced).toBe(true);
  });

  it('normalizes linked identities, entitlements, and capabilities', () => {
    const identity = normalizeIdentity({
      profileId: 'profile-4',
      displayName: 'Admin',
      linkedIdentities: [
        {
          provider: 'google',
          providerUserId: 'google-subject-1',
          email: 'admin@example.test',
          linkedAt: '2026-06-29T12:00:00.000Z'
        }
      ],
      entitlements: {
        tier: 'admin',
        modules: { cartography: true },
        capabilities: {},
        grantSource: 'bootstrap_admin',
        updatedAt: '2026-06-29T12:00:00.000Z'
      }
    });

    expect(identity.userId).toBe('profile-4');
    expect(identity.externalIds.googleId).toBe('google-subject-1');
    expect(identity.profile.tier).toBe('admin');
    expect(identity.profile.modules).toEqual(['cartography']);
    expect(can(identity, 'admin_content_tools')).toBe(true);
    expect(can(identity, 'cloud_preferences')).toBe(true);
  });

  it('can create a durable local-only login without a remote service', () => {
    const identity = createLocalSignedInIdentity(createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-2'));

    expect(identity.authToken).toMatch(/^local-/);
    expect(isLocalOnlyIdentity(identity)).toBe(true);
  });

  it('signs in locally when no cloud service is configured', async () => {
    const identity = await syncIdentity({
      schemaVersion: 1,
      keepSynced: true,
      serviceBaseUrl: '',
      lastSyncedAt: '',
      lastPulledAt: '',
      lastError: ''
    }, createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-2'));

    expect(identity.profileId).toBe('profile-2');
    expect(identity.authToken).toMatch(/^local-/);
    expect(isLocalOnlyIdentity(identity)).toBe(true);
  });

  it('does not call the cloud service for an anonymous local identity', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const identity = await syncIdentity({
      schemaVersion: 1,
      keepSynced: true,
      serviceBaseUrl: 'https://sync.example.test',
      lastSyncedAt: '',
      lastPulledAt: '',
      lastError: ''
    }, createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-2'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(identity.authToken).toMatch(/^local-/);
    expect(isLocalOnlyIdentity(identity)).toBe(true);
  });

  it('falls back to local mode when a stale service token is rejected and no Firebase token is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid app identity token.' })
    } as Response);

    const identity = await syncIdentity({
      schemaVersion: 1,
      keepSynced: true,
      serviceBaseUrl: 'https://sync.example.test',
      lastSyncedAt: '',
      lastPulledAt: '',
      lastError: ''
    }, normalizeIdentity({
      profileId: 'profile-2',
      authToken: 'pw-stale-token',
      displayName: 'Stale User'
    }));

    expect(identity.authToken).toMatch(/^local-/);
    expect(isLocalOnlyIdentity(identity)).toBe(true);
  });

  it('builds a sync envelope around generation and content settings', () => {
    const identity = createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-3');
    const workspace = buildWorkspaceSettings({
      config: createDefaultConfig('1001001', { width: 512, height: 256 }),
      contentLibrary: defaultContentLibrary,
      tileExport: {
        presetId: 'custom',
        width: 42.6,
        height: 24.2,
        enabledFeatures: ['minor-river', 'wet']
      }
    });

    const envelope = buildSyncEnvelope({ identity, workspace, updatedAt: '2026-06-29T12:30:00.000Z' });

    expect(envelope.format).toBe('world-forge-user-sync');
    expect(envelope.identity.profileId).toBe('profile-3');
    expect(envelope.workspace.tileExport.width).toBe(43);
    expect(envelope.workspace.tileExport.enabledFeatures).toEqual(['minor-river', 'wet']);
    expect(envelope.workspace.savedMaps).toEqual([]);
  });

  it('normalizes sticky workspace UI settings', () => {
    const ui = normalizeWorkspaceUiSettings({
      selectedPreset: 'Earthlike',
      previewResolution: { width: 0, height: 0 },
      exportResolution: { width: 1024.2, height: 511.8 },
      vttHexSizeMiles: 600,
      showPlates: true,
      showHexes: true,
      mapMode: 'rainfall',
      leftPanelCollapsed: true,
      mapZoom: 6,
      globeZoom: 0.25
    });

    expect(ui.selectedPreset).toBe('Earthlike');
    expect(ui.previewResolution).toEqual({ width: 0, height: 0 });
    expect(ui.exportResolution).toEqual({ width: 1024, height: 512 });
    expect(ui.vttHexSizeMiles).toBe(600);
    expect(ui.showPlates).toBe(true);
    expect(ui.showRivers).toBe(true);
    expect(ui.showHexes).toBe(true);
    expect(ui.mapMode).toBe('rainfall');
    expect(ui.leftPanelCollapsed).toBe(true);
    expect(ui.mapZoom).toBe(6);
    expect(ui.globeZoom).toBe(0.75);
  });
});
