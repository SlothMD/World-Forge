import { describe, expect, it } from 'vitest';
import { createDefaultConfig, defaultContentLibrary } from '@world-forge/shared';
import {
  buildSyncEnvelope,
  buildWorkspaceSettings,
  createLocalSignedInIdentity,
  createLocalIdentity,
  isSyncConfigured,
  isLocalOnlyIdentity,
  normalizeCloudSyncSettings,
  normalizeIdentity,
  syncIdentity
} from './sync';

describe('sync helpers', () => {
  it('creates a stable local identity shape', () => {
    const identity = createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-1');

    expect(identity).toEqual({
      schemaVersion: 1,
      profileId: 'profile-1',
      authToken: '',
      displayName: 'World Builder',
      externalIds: {
        googleId: '',
        steamId: ''
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

  it('can create a durable local-only login without a remote service', () => {
    const identity = createLocalSignedInIdentity(createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-2'));

    expect(identity.authToken).toMatch(/^local-/);
    expect(isLocalOnlyIdentity(identity)).toBe(true);
  });

  it('signs in locally when no cloud service is configured', async () => {
    const identity = await syncIdentity(normalizeCloudSyncSettings({ serviceBaseUrl: '' }), createLocalIdentity('2026-06-29T12:00:00.000Z', 'profile-2'));

    expect(identity.profileId).toBe('profile-2');
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
});
