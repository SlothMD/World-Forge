import { WorldProject } from '@world-forge/shared';
import { SavedMapRecord } from './sync';
export declare const localWorldStorageLimits: {
    readonly maxSavedWorlds: 12;
    readonly maxAssetBytes: number;
    readonly maxTotalBytes: number;
};
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
    estimateUsage(): Promise<{
        usedBytes: number;
        quotaBytes?: number;
    }>;
}
export declare function savedMapRecordForProject(project: WorldProject): SavedMapRecord;
export declare function mergeSavedMapRecords(...groups: SavedMapRecord[][]): SavedMapRecord[];
export declare class IndexedDbWorldStorageProvider implements WorldStorageProvider {
    readonly info: StorageProviderInfo;
    saveWorld(project: WorldProject): Promise<SavedMapRecord>;
    loadWorld(projectId: string): Promise<WorldProject | null>;
    deleteWorld(projectId: string): Promise<void>;
    listWorlds(): Promise<SavedMapRecord[]>;
    estimateUsage(): Promise<{
        usedBytes: number;
        quotaBytes?: number;
    }>;
    private pruneOldWorlds;
    private listStoredRecords;
}
export declare const defaultWorldStorageProvider: IndexedDbWorldStorageProvider;
