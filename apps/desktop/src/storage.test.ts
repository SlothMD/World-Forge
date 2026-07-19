import { describe, expect, it } from 'vitest';
import { createDefaultConfig, generateProject } from '@world-forge/generator-core';
import { localWorldStorageLimits, mergeSavedMapRecords, savedMapRecordForProject } from './storage';

describe('world storage provider helpers', () => {
  it('creates compact saved-world metadata from generated projects', () => {
    const project = generateProject(createDefaultConfig('storage-record-001', { width: 64, height: 32 }));
    const record = savedMapRecordForProject(project);

    expect(record).toEqual({
      projectId: project.projectId,
      projectName: project.projectName,
      seed: 'storage-record-001',
      updatedAt: project.updatedAt
    });
    expect('primaryWorld' in record).toBe(false);
  });

  it('merges saved-world metadata by latest update time', () => {
    const older = { projectId: 'world-1', projectName: 'Old', seed: '1', updatedAt: '2026-07-01T00:00:00.000Z' };
    const newer = { projectId: 'world-1', projectName: 'New', seed: '1', updatedAt: '2026-07-02T00:00:00.000Z' };
    const other = { projectId: 'world-2', projectName: 'Other', seed: '2', updatedAt: '2026-07-03T00:00:00.000Z' };

    expect(mergeSavedMapRecords([older, other], [newer])).toEqual([other, newer]);
  });

  it('sets conservative hosted-beta local storage limits', () => {
    expect(localWorldStorageLimits.maxSavedWorlds).toBeGreaterThanOrEqual(8);
    expect(localWorldStorageLimits.maxSavedWorlds).toBeLessThanOrEqual(20);
    expect(localWorldStorageLimits.maxAssetBytes).toBeLessThanOrEqual(25 * 1024 * 1024);
  });
});
