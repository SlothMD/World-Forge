import { Dispatch, SetStateAction } from 'react';
import { CloudSyncSettings, LocalUserIdentity, WorkspaceSettings } from '../sync';
import { ExternalAccountIdentity } from '../accountProviders';
type UseCloudWorkspaceSyncOptions = {
    identity: LocalUserIdentity;
    setIdentity: Dispatch<SetStateAction<LocalUserIdentity>>;
    cloudSync: CloudSyncSettings;
    setCloudSync: Dispatch<SetStateAction<CloudSyncSettings>>;
    workspace: WorkspaceSettings;
    applyPulledWorkspace: (workspace: WorkspaceSettings) => void;
    clearProject: () => void;
};
export declare function useCloudWorkspaceSync({ identity, setIdentity, cloudSync, setCloudSync, workspace, applyPulledWorkspace, clearProject }: UseCloudWorkspaceSyncOptions): {
    syncStatus: string;
    updateDisplayName: (displayName: string) => void;
    updateExternalAccount: (account: ExternalAccountIdentity) => void;
    updateCloudSync: (partial: Partial<CloudSyncSettings>) => void;
    signInForSync: () => Promise<void>;
    signOut: () => void;
    pushCloudSync: () => Promise<void>;
    pullCloudSync: () => Promise<void>;
};
export {};
