import React from 'react';
import { Save } from 'lucide-react';
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

export function MyWorldsPanel({
  activeProjectId,
  canSaveCurrent,
  records,
  status,
  onSaveCurrent,
  onLoad,
  onRemove
}: MyWorldsPanelProps) {
  return (
    <div className="my-worlds-panel" role="tabpanel" aria-label="My Worlds">
      <div className="world-library-actions">
        <button type="button" disabled={!canSaveCurrent} onClick={onSaveCurrent}>
          <Save size={16} />
          Save Current
        </button>
        <span>{records.length} saved</span>
      </div>
      {status && <div className="world-library-status">{status}</div>}
      {records.length === 0 ? (
        <div className="empty-library">
          <strong>No saved worlds</strong>
          <span>Generate a world, then save it here for in-app loading.</span>
        </div>
      ) : (
        <div className="world-list">
          {records.map((record) => (
            <article key={record.projectId} className={`world-list-item ${activeProjectId === record.projectId ? 'active' : ''}`}>
              <div>
                <strong>{record.projectName}</strong>
                <span>Seed {record.seed} · {new Date(record.updatedAt).toLocaleString()}</span>
              </div>
              <div className="world-list-actions">
                <button type="button" onClick={() => onLoad(record)}>Load</button>
                <button type="button" className="subtle-button" onClick={() => onRemove(record)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
