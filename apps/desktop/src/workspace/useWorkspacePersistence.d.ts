import { CloudSyncSettings, LocalUserIdentity, SavedMapRecord, WorkspaceSettings } from '../sync';
type UseWorkspacePersistenceOptions = {
    identity: LocalUserIdentity;
    cloudSync: CloudSyncSettings;
    workspace: WorkspaceSettings;
    onSavedMapsLoaded: (records: SavedMapRecord[]) => void;
};
export declare function useWorkspacePersistence({ identity, cloudSync, workspace, onSavedMapsLoaded }: UseWorkspacePersistenceOptions): void;
export {};
