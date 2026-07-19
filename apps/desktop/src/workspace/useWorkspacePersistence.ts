import { useEffect } from 'react';
import { CloudSyncSettings, LocalUserIdentity, SavedMapRecord, WorkspaceSettings, saveCloudSyncSettings, saveIdentity, saveWorkspaceSettings } from '../sync';
import { defaultWorldStorageProvider } from '../storage';

type UseWorkspacePersistenceOptions = {
  identity: LocalUserIdentity;
  cloudSync: CloudSyncSettings;
  workspace: WorkspaceSettings;
  onSavedMapsLoaded: (records: SavedMapRecord[]) => void;
};

export function useWorkspacePersistence({ identity, cloudSync, workspace, onSavedMapsLoaded }: UseWorkspacePersistenceOptions) {
  useEffect(() => {
    saveIdentity(identity);
  }, [identity]);

  useEffect(() => {
    saveCloudSyncSettings(cloudSync);
  }, [cloudSync]);

  useEffect(() => {
    saveWorkspaceSettings(workspace);
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    const loadStoredWorlds = async () => {
      const stored = await defaultWorldStorageProvider.listWorlds().catch(() => []);
      if (!cancelled && stored.length) onSavedMapsLoaded(stored);
    };
    void loadStoredWorlds();
    return () => {
      cancelled = true;
    };
  }, [onSavedMapsLoaded]);
}
