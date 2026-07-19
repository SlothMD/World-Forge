import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import {
  CloudSyncSettings,
  LocalUserIdentity,
  WorkspaceSettings,
  buildSyncEnvelope,
  createLocalIdentity,
  isLoggedIn,
  isLocalOnlyIdentity,
  pullSyncEnvelope,
  pushSyncEnvelope,
  syncIdentity
} from '../sync';
import { ExternalAccountIdentity, detectSteamIdentity, googleSignInAvailable, signInWithGoogle } from '../accountProviders';

type UseCloudWorkspaceSyncOptions = {
  identity: LocalUserIdentity;
  setIdentity: Dispatch<SetStateAction<LocalUserIdentity>>;
  cloudSync: CloudSyncSettings;
  setCloudSync: Dispatch<SetStateAction<CloudSyncSettings>>;
  workspace: WorkspaceSettings;
  applyPulledWorkspace: (workspace: WorkspaceSettings) => void;
  clearProject: () => void;
};

export function useCloudWorkspaceSync({
  identity,
  setIdentity,
  cloudSync,
  setCloudSync,
  workspace,
  applyPulledWorkspace,
  clearProject
}: UseCloudWorkspaceSyncOptions) {
  const [syncStatus, setSyncStatus] = useState('Local profile ready');
  const initialSyncDoneRef = useRef(false);
  const suppressAutoPushRef = useRef(false);
  const steamLinkDoneRef = useRef(false);
  const workspaceRef = useRef(workspace);
  const applyPulledWorkspaceRef = useRef(applyPulledWorkspace);
  const clearProjectRef = useRef(clearProject);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    applyPulledWorkspaceRef.current = applyPulledWorkspace;
  }, [applyPulledWorkspace]);

  useEffect(() => {
    clearProjectRef.current = clearProject;
  }, [clearProject]);

  const updateExternalAccount = useCallback((account: ExternalAccountIdentity) => {
    setIdentity((current) => ({
      ...identityWithExternalAccount(current, account)
    }));
  }, [setIdentity]);

  const updateDisplayName = useCallback((displayName: string) => {
    setIdentity((current) => ({
      ...current,
      displayName,
      updatedAt: new Date().toISOString()
    }));
  }, [setIdentity]);

  const updateCloudSync = useCallback((partial: Partial<CloudSyncSettings>) => {
    setCloudSync((current) => ({
      ...current,
      ...partial,
      schemaVersion: 1
    }));
  }, [setCloudSync]);

  useEffect(() => {
    if (steamLinkDoneRef.current) return;
    const steamIdentity = detectSteamIdentity();
    if (!steamIdentity) return;
    steamLinkDoneRef.current = true;
    const nextIdentity = identityWithExternalAccount(identity, steamIdentity);
    setIdentity(nextIdentity);
    if (!cloudSync.keepSynced) return;
    let cancelled = false;
    const linkSteam = async () => {
      try {
        setSyncStatus('Signing in with Steam...');
        const signedIn = await syncIdentity(cloudSync, nextIdentity);
        if (cancelled) return;
        setIdentity(signedIn);
        setCloudSync((current) => ({ ...current, lastError: '' }));
        setSyncStatus(isLocalOnlyIdentity(signedIn) ? 'Steam account linked locally.' : 'Steam account linked.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Steam sign-in failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    };
    void linkSteam();
    return () => {
      cancelled = true;
    };
  }, [cloudSync, identity, setCloudSync, setIdentity]);

  useEffect(() => {
    if (!cloudSync.keepSynced || !cloudSync.serviceBaseUrl || initialSyncDoneRef.current) return;
    initialSyncDoneRef.current = true;
    let cancelled = false;
    const runInitialSync = async () => {
      try {
        setSyncStatus('Signing in...');
        const signedIn = await syncIdentity(cloudSync, identity);
        if (cancelled) return;
        setIdentity(signedIn);
        if (isLocalOnlyIdentity(signedIn)) {
          setCloudSync((current) => ({ ...current, lastError: '' }));
          setSyncStatus('Signed in locally. Cloud service is not configured or unavailable.');
          return;
        }
        setSyncStatus('Checking cloud data...');
        const pulled = await pullSyncEnvelope(cloudSync, signedIn).catch((error) => {
          if (/404/.test(String(error?.message || ''))) return null;
          throw error;
        });
        if (cancelled) return;
        if (pulled?.workspace) {
          suppressAutoPushRef.current = true;
          applyPulledWorkspaceRef.current(pulled.workspace);
          setCloudSync((current) => ({
            ...current,
            lastPulledAt: pulled.updatedAt,
            lastError: ''
          }));
          setSyncStatus(`Synced from cloud ${new Date(pulled.updatedAt).toLocaleString()}`);
          window.setTimeout(() => {
            suppressAutoPushRef.current = false;
          }, 0);
          return;
        }
        setSyncStatus('Signed in. Local data will sync automatically.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud sign-in failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    };
    void runInitialSync();
    return () => {
      cancelled = true;
    };
  }, [cloudSync, identity, setCloudSync, setIdentity]);

  useEffect(() => {
    if (!cloudSync.keepSynced || !cloudSync.serviceBaseUrl || !isLoggedIn(identity) || isLocalOnlyIdentity(identity) || suppressAutoPushRef.current) return;
    const timer = window.setTimeout(async () => {
      try {
        setSyncStatus('Syncing changes...');
        const envelope = buildSyncEnvelope({ identity, workspace: workspaceRef.current });
        const synced = await pushSyncEnvelope(cloudSync, identity, envelope);
        setCloudSync((current) => ({
          ...current,
          lastSyncedAt: synced.updatedAt,
          lastError: ''
        }));
        setSyncStatus(`Synced ${new Date(synced.updatedAt).toLocaleString()}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud sync failed';
        setCloudSync((current) => ({ ...current, lastError: message }));
        setSyncStatus(message);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [cloudSync.keepSynced, cloudSync.serviceBaseUrl, identity, workspace, setCloudSync]);

  const signInForSync = useCallback(async () => {
    try {
      setSyncStatus('Signing in...');
      const steamIdentity = detectSteamIdentity();
      const providerIdentity = steamIdentity ?? (googleSignInAvailable() ? await signInWithGoogle() : null);
      const identityToSync = providerIdentity ? identityWithExternalAccount(identity, providerIdentity) : identity;
      if (providerIdentity) updateExternalAccount(providerIdentity);
      const signedIn = await syncIdentity(cloudSync, identityToSync);
      setIdentity(signedIn);
      setCloudSync((current) => ({ ...current, lastError: '' }));
      setSyncStatus(isLocalOnlyIdentity(signedIn) ? 'Signed in locally. Cloud service is not configured or unavailable.' : `Signed in as ${signedIn.profileId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  }, [cloudSync, identity, setCloudSync, setIdentity, updateExternalAccount]);

  const signOut = useCallback(() => {
    setIdentity(createLocalIdentity());
    setCloudSync((current) => ({ ...current, lastError: '' }));
    setSyncStatus('Signed out. Anonymous local profile ready.');
  }, [setCloudSync, setIdentity]);

  const pushCloudSync = useCallback(async () => {
    try {
      setSyncStatus('Pushing settings and assets...');
      const signedIn = isLoggedIn(identity) ? identity : await syncIdentity(cloudSync, identity);
      setIdentity(signedIn);
      if (isLocalOnlyIdentity(signedIn)) {
        setCloudSync((current) => ({ ...current, lastError: '' }));
        setSyncStatus('Signed in locally. Cloud service is not configured or unavailable.');
        return;
      }
      const envelope = buildSyncEnvelope({ identity: signedIn, workspace: workspaceRef.current });
      const synced = await pushSyncEnvelope(cloudSync, signedIn, envelope);
      setCloudSync((current) => ({
        ...current,
        lastSyncedAt: synced.updatedAt,
        lastError: ''
      }));
      setSyncStatus(`Pushed ${new Date(synced.updatedAt).toLocaleString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud push failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  }, [cloudSync, identity, setCloudSync, setIdentity]);

  const pullCloudSync = useCallback(async () => {
    try {
      if (isLocalOnlyIdentity(identity)) {
        setSyncStatus('Cloud pull needs a service-backed login.');
        return;
      }
      setSyncStatus('Pulling settings and assets...');
      const synced = await pullSyncEnvelope(cloudSync, identity);
      if (!synced) {
        setSyncStatus('No cloud profile found for this user.');
        return;
      }
      suppressAutoPushRef.current = true;
      setIdentity(synced.identity);
      applyPulledWorkspaceRef.current(synced.workspace);
      clearProjectRef.current();
      setCloudSync((current) => ({
        ...current,
        lastPulledAt: synced.updatedAt,
        lastSyncedAt: synced.updatedAt,
        lastError: ''
      }));
      setSyncStatus(`Pulled ${new Date(synced.updatedAt).toLocaleString()}`);
      window.setTimeout(() => {
        suppressAutoPushRef.current = false;
      }, 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud pull failed';
      setCloudSync((current) => ({ ...current, lastError: message }));
      setSyncStatus(message);
    }
  }, [cloudSync, identity, setCloudSync, setIdentity]);

  return {
    syncStatus,
    updateDisplayName,
    updateExternalAccount,
    updateCloudSync,
    signInForSync,
    signOut,
    pushCloudSync,
    pullCloudSync
  };
}

function identityWithExternalAccount(identity: LocalUserIdentity, account: ExternalAccountIdentity): LocalUserIdentity {
  const displayName = account.displayName?.trim();
  const timestamp = new Date().toISOString();
  const linkedIdentity = {
    provider: account.provider,
    providerUserId: account.externalId,
    email: account.email,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    linkedAt: timestamp
  };
  const linkedIdentities = [
    ...identity.linkedIdentities.filter((entry) => !(entry.provider === account.provider && entry.providerUserId === account.externalId)),
    linkedIdentity
  ];
  return {
    ...identity,
    firebaseIdToken: account.idToken || identity.firebaseIdToken,
    displayName: displayName && identity.displayName === 'Parchment Worldbuilder' ? displayName : identity.displayName,
    email: account.email || identity.email,
    avatarUrl: account.avatarUrl || identity.avatarUrl,
    externalIds: {
      ...identity.externalIds,
      googleId: account.provider === 'google' ? account.externalId : identity.externalIds.googleId,
      steamId: account.provider === 'steam' ? account.externalId : identity.externalIds.steamId
    },
    linkedIdentities,
    updatedAt: timestamp
  };
}
