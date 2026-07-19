import { deserializeProject, serializeProject } from '@world-forge/exporters';
import { WorldProject } from '@world-forge/shared';
import { SavedMapRecord } from './sync';

export const localWorldStorageLimits = {
  maxSavedWorlds: 12,
  maxAssetBytes: 25 * 1024 * 1024,
  maxTotalBytes: 150 * 1024 * 1024
} as const;

export type StorageProviderKind = 'indexeddb' | 'cloud' | 'desktop';

export type StorageProviderInfo = {
  kind: StorageProviderKind;
  label: string;
  durable: boolean;
  crossMachine: boolean;
  limits: typeof localWorldStorageLimits;
};

export type SavedWorldStorageRecord = SavedMapRecord & {
  storageSchemaVersion: 1;
  projectSchemaVersion: 1;
  appVersion: string;
  generatorVersion: string;
  createdAt: string;
  sizeBytes: number;
  project: unknown;
};

export interface WorldStorageProvider {
  info: StorageProviderInfo;
  saveWorld(project: WorldProject): Promise<SavedMapRecord>;
  loadWorld(projectId: string): Promise<WorldProject | null>;
  deleteWorld(projectId: string): Promise<void>;
  listWorlds(): Promise<SavedMapRecord[]>;
  estimateUsage(): Promise<{ usedBytes: number; quotaBytes?: number }>;
}

const worldLibraryDbName = 'world-forge-library';
const worldLibraryStore = 'worlds';

export function savedMapRecordForProject(project: WorldProject): SavedMapRecord {
  return {
    projectId: project.projectId,
    projectName: project.projectName,
    seed: project.seed,
    updatedAt: project.updatedAt
  };
}

export function mergeSavedMapRecords(...groups: SavedMapRecord[][]): SavedMapRecord[] {
  const byId = new Map<string, SavedMapRecord>();
  for (const record of groups.flat()) {
    const existing = byId.get(record.projectId);
    if (!existing || new Date(record.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byId.set(record.projectId, record);
    }
  }
  return [...byId.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export class IndexedDbWorldStorageProvider implements WorldStorageProvider {
  readonly info: StorageProviderInfo = {
    kind: 'indexeddb',
    label: 'Browser local library',
    durable: true,
    crossMachine: false,
    limits: localWorldStorageLimits
  };

  async saveWorld(project: WorldProject): Promise<SavedMapRecord> {
    const record = storedWorldRecordForProject(project);
    const db = await openWorldLibraryDb();
    await idbRequest(db.transaction(worldLibraryStore, 'readwrite').objectStore(worldLibraryStore).put(record));
    db.close();
    await this.pruneOldWorlds();
    return savedMapRecordForProject(project);
  }

  async loadWorld(projectId: string): Promise<WorldProject | null> {
    const db = await openWorldLibraryDb();
    const record = await idbRequest<SavedWorldStorageRecord | undefined>(db.transaction(worldLibraryStore, 'readonly').objectStore(worldLibraryStore).get(projectId));
    db.close();
    return record?.project ? deserializeProject(record.project) : null;
  }

  async deleteWorld(projectId: string): Promise<void> {
    const db = await openWorldLibraryDb();
    await idbRequest(db.transaction(worldLibraryStore, 'readwrite').objectStore(worldLibraryStore).delete(projectId));
    db.close();
  }

  async listWorlds(): Promise<SavedMapRecord[]> {
    const records = await this.listStoredRecords();
    return records.map(({ project, storageSchemaVersion, projectSchemaVersion, appVersion, generatorVersion, createdAt, sizeBytes, ...record }) => record);
  }

  async estimateUsage(): Promise<{ usedBytes: number; quotaBytes?: number }> {
    if (globalThis.navigator?.storage?.estimate) {
      const estimate = await globalThis.navigator.storage.estimate();
      return {
        usedBytes: estimate.usage ?? 0,
        quotaBytes: estimate.quota
      };
    }
    const records = await this.listStoredRecords();
    return {
      usedBytes: records.reduce((sum, record) => sum + (record.sizeBytes || 0), 0)
    };
  }

  private async pruneOldWorlds(): Promise<void> {
    const records = await this.listStoredRecords();
    if (records.length <= localWorldStorageLimits.maxSavedWorlds) return;
    const toDelete = records
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(localWorldStorageLimits.maxSavedWorlds);
    const db = await openWorldLibraryDb();
    const store = db.transaction(worldLibraryStore, 'readwrite').objectStore(worldLibraryStore);
    await Promise.all(toDelete.map((record) => idbRequest(store.delete(record.projectId))));
    db.close();
  }

  private async listStoredRecords(): Promise<SavedWorldStorageRecord[]> {
    const db = await openWorldLibraryDb();
    const records = await idbRequest<SavedWorldStorageRecord[]>(db.transaction(worldLibraryStore, 'readonly').objectStore(worldLibraryStore).getAll());
    db.close();
    return records.map(normalizeStoredWorldRecord).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

export const defaultWorldStorageProvider = new IndexedDbWorldStorageProvider();

function storedWorldRecordForProject(project: WorldProject): SavedWorldStorageRecord {
  const projectPayload = serializeProject(project, { includeLayerData: true });
  return {
    ...savedMapRecordForProject(project),
    storageSchemaVersion: 1,
    projectSchemaVersion: 1,
    appVersion: project.appVersion,
    generatorVersion: project.generatorVersion,
    createdAt: project.createdAt,
    sizeBytes: roughJsonBytes(projectPayload),
    project: projectPayload
  };
}

function normalizeStoredWorldRecord(record: Partial<SavedWorldStorageRecord>): SavedWorldStorageRecord {
  return {
    storageSchemaVersion: 1,
    projectSchemaVersion: 1,
    projectId: String(record.projectId || ''),
    projectName: String(record.projectName || 'Untitled World'),
    seed: String(record.seed || ''),
    createdAt: String(record.createdAt || record.updatedAt || new Date(0).toISOString()),
    updatedAt: String(record.updatedAt || record.createdAt || new Date(0).toISOString()),
    appVersion: String(record.appVersion || ''),
    generatorVersion: String(record.generatorVersion || ''),
    sizeBytes: Number(record.sizeBytes || roughJsonBytes(record.project)),
    project: record.project
  };
}

function openWorldLibraryDb(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('In-app world storage is not available in this environment.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(worldLibraryDbName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(worldLibraryStore)) db.createObjectStore(worldLibraryStore, { keyPath: 'projectId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open world library.'));
  });
}

function idbRequest<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('World library request failed.'));
  });
}

function roughJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
