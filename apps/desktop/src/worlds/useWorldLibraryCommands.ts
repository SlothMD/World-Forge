import { Dispatch, SetStateAction, useState } from 'react';
import { WorldProject } from '@world-forge/shared';
import { SavedMapRecord } from '../sync';
import { defaultWorldStorageProvider, localWorldStorageLimits, mergeSavedMapRecords } from '../storage';

type UseWorldLibraryCommandsOptions = {
  project: WorldProject | null;
  setProject: Dispatch<SetStateAction<WorldProject | null>>;
  setSavedMaps: Dispatch<SetStateAction<SavedMapRecord[]>>;
  onWorldLoaded: (project: WorldProject) => void;
};

export function useWorldLibraryCommands({
  project,
  setProject,
  setSavedMaps,
  onWorldLoaded
}: UseWorldLibraryCommandsOptions) {
  const [worldLibraryStatus, setWorldLibraryStatus] = useState('');

  const saveCurrentWorldInApp = async () => {
    if (!project) return;
    setWorldLibraryStatus('Saving world...');
    try {
      const projectToSave = { ...project, updatedAt: new Date().toISOString() };
      const record = await defaultWorldStorageProvider.saveWorld(projectToSave);
      setProject(projectToSave);
      setSavedMaps((current) => mergeSavedMapRecords([record], current).slice(0, localWorldStorageLimits.maxSavedWorlds));
      setWorldLibraryStatus(`Saved ${project.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save world';
      setWorldLibraryStatus(message);
    }
  };

  const loadStoredWorld = async (record: SavedMapRecord) => {
    setWorldLibraryStatus(`Loading ${record.projectName}...`);
    try {
      const loaded = await defaultWorldStorageProvider.loadWorld(record.projectId);
      if (!loaded) {
        setWorldLibraryStatus('Saved world data is not available on this machine.');
        return;
      }
      onWorldLoaded(loaded);
      setWorldLibraryStatus(`Loaded ${loaded.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load world';
      setWorldLibraryStatus(message);
    }
  };

  const deleteStoredWorld = async (record: SavedMapRecord) => {
    setWorldLibraryStatus(`Removing ${record.projectName}...`);
    try {
      await defaultWorldStorageProvider.deleteWorld(record.projectId);
      setSavedMaps((current) => current.filter((entry) => entry.projectId !== record.projectId));
      setWorldLibraryStatus(`Removed ${record.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove world';
      setWorldLibraryStatus(message);
    }
  };

  return {
    worldLibraryStatus,
    saveCurrentWorldInApp,
    loadStoredWorld,
    deleteStoredWorld
  };
}
