import React from 'react';
import type { SavedMapRecord } from '../sync';
export type MyWorldsPanelProps = {
    activeProjectId?: string;
    canSaveCurrent: boolean;
    records: SavedMapRecord[];
    status: string;
    onSaveCurrent: () => void;
    onLoad: (record: SavedMapRecord) => void;
    onRemove: (record: SavedMapRecord) => void;
};
export declare function MyWorldsPanel({ activeProjectId, canSaveCurrent, records, status, onSaveCurrent, onLoad, onRemove }: MyWorldsPanelProps): React.JSX.Element;
