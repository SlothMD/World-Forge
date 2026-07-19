import { Dispatch, SetStateAction } from 'react';
import { WorldProject } from '@world-forge/shared';
import { SavedMapRecord } from '../sync';
type UseWorldLibraryCommandsOptions = {
    project: WorldProject | null;
    setProject: Dispatch<SetStateAction<WorldProject | null>>;
    setSavedMaps: Dispatch<SetStateAction<SavedMapRecord[]>>;
    onWorldLoaded: (project: WorldProject) => void;
};
export declare function useWorldLibraryCommands({ project, setProject, setSavedMaps, onWorldLoaded }: UseWorldLibraryCommandsOptions): {
    worldLibraryStatus: string;
    saveCurrentWorldInApp: () => Promise<void>;
    loadStoredWorld: (record: SavedMapRecord) => Promise<void>;
    deleteStoredWorld: (record: SavedMapRecord) => Promise<void>;
};
export {};
