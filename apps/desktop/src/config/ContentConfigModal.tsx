import React, { useEffect, useState } from 'react';
import { Cloud, Copy, Download, Plus, RefreshCw, Search, Upload, User, X } from 'lucide-react';
import {
  biomeNames,
  type ContentCategory,
  type ContentCategoryConfig,
  type ContentLibraryConfig,
  type ContentMember,
  type ContentRule
} from '@world-forge/shared';
import type { CloudSyncSettings, LocalUserIdentity } from '../sync';
import { can, isLoggedIn, isLocalOnlyIdentity } from '../sync';
import { googleSignInAvailable } from '../accountProviders';
import { Metric } from '../diagnostics/DiagnosticsPanels';

export type ConfigTab = ContentCategory | 'sync';
type RuleLogic = 'lt' | 'equals' | 'gt' | 'between';
type RuleFieldKind = 'number' | 'boolean' | 'text';
type RuleFieldOption = { field: string; label: string; kind: RuleFieldKind };

const ruleFieldOptions: RuleFieldOption[] = [
  { field: 'water', label: 'Marine / water', kind: 'boolean' },
  { field: 'lake', label: 'Lake', kind: 'boolean' },
  { field: 'ice', label: 'Ice', kind: 'boolean' },
  { field: 'notFeature', label: 'Not Feature', kind: 'text' },
  { field: 'biome', label: 'Biome', kind: 'text' },
  { field: 'morphology', label: 'Terrain', kind: 'text' },
  { field: 'temperatureC', label: 'Temperature C', kind: 'number' },
  { field: 'wetness', label: 'Wetness', kind: 'number' },
  { field: 'river', label: 'River strength', kind: 'number' },
  { field: 'elevationAboveSeaLevel', label: 'Elevation above sea', kind: 'number' },
  { field: 'depthBelowSeaLevel', label: 'Depth below sea', kind: 'number' },
  { field: 'slope', label: 'Slope', kind: 'number' },
  { field: 'volcanism', label: 'Volcanism', kind: 'number' },
  { field: 'sourceBiome', label: 'Source biome', kind: 'text' },
  { field: 'polarLatitude', label: 'Polar latitude', kind: 'number' }
];

const textRuleValueOptions: Record<string, string[]> = {
  notFeature: [],
  biome: ['marine', 'tundra', 'grassland', 'plains', 'desert', 'tropical'],
  morphology: ['flat', 'rough', 'mountainous', 'navigable-river', 'coastal', 'ocean', 'lake'],
  sourceBiome: biomeNames
};

function singularCategoryLabel(label: string): string {
  const normalized = label.trim();
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized || 'Member';
}

function ruleFieldKind(field: string): RuleFieldKind {
  return ruleFieldOptions.find((option) => option.field === field)?.kind ?? 'number';
}

function ruleLogic(rule: ContentRule): RuleLogic {
  if (ruleFieldKind(rule.field) === 'boolean' || rule.equals !== undefined) return 'equals';
  if (rule.min !== undefined && rule.max !== undefined) return 'between';
  if (rule.min !== undefined) return 'gt';
  if (rule.max !== undefined) return 'lt';
  return 'equals';
}

function makeRuleForField(field: string, featureRuleOptions: string[] = []): ContentRule {
  const kind = ruleFieldKind(field);
  if (kind === 'boolean') return { field, equals: true, min: undefined, max: undefined, includes: undefined };
  if (kind === 'text') return { field, equals: (field === 'notFeature' ? featureRuleOptions : textRuleValueOptions[field])?.[0] ?? '', min: undefined, max: undefined, includes: undefined };
  return { field, min: 0, max: undefined, equals: undefined, includes: undefined };
}

function makeRuleForLogic(rule: ContentRule, logic: RuleLogic, featureRuleOptions: string[] = []): ContentRule {
  if (ruleFieldKind(rule.field) === 'boolean') return { field: rule.field, equals: rule.equals === false ? false : true };
  if (ruleFieldKind(rule.field) === 'text') return { field: rule.field, equals: optionalRuleValueText(rule.equals) || (rule.field === 'notFeature' ? featureRuleOptions : textRuleValueOptions[rule.field])?.[0] || '' };
  const currentValue = typeof rule.equals === 'number' ? rule.equals : rule.min ?? rule.max ?? 0;
  if (logic === 'lt') return { field: rule.field, max: currentValue };
  if (logic === 'gt') return { field: rule.field, min: currentValue };
  if (logic === 'between') return { field: rule.field, min: rule.min ?? currentValue, max: rule.max ?? currentValue };
  return { field: rule.field, equals: currentValue };
}

function makeRuleForNumericValue(logic: RuleLogic, value: string): Partial<ContentRule> {
  const parsed = optionalNumberValue(value);
  if (logic === 'lt') return { max: parsed, min: undefined, equals: undefined, includes: undefined };
  if (logic === 'gt') return { min: parsed, max: undefined, equals: undefined, includes: undefined };
  return { equals: parsed, min: undefined, max: undefined, includes: undefined };
}

function optionalNumberText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function optionalNumberValue(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalRuleValueText(value: string | number | boolean | undefined): string {
  return value === undefined ? '' : String(value);
}

function optionalRuleValue(value: string): string | number | boolean | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

function cleanRule(rule: ContentRule): ContentRule {
  return Object.fromEntries(Object.entries(rule).filter(([, value]) => value !== undefined && value !== '')) as ContentRule;
}

function titleText(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function previewColor(member: ContentMember): string {
  return member.assets.find((asset) => asset.kind === 'preview-color')?.value || '#9f998d';
}

export function ContentConfigModal({
  library,
  activeTab,
  onTab,
  onClose,
  onChange,
  identity,
  cloudSync,
  syncStatus,
  savedMapCount,
  onDisplayName,
  onCloudSync,
  onSignIn,
  onSignOut,
  onPush,
  onPull
}: {
  library: ContentLibraryConfig;
  activeTab: ConfigTab;
  onTab: (tab: ConfigTab) => void;
  onClose: () => void;
  onChange: (library: ContentLibraryConfig) => void;
  identity: LocalUserIdentity;
  cloudSync: CloudSyncSettings;
  syncStatus: string;
  savedMapCount: number;
  onDisplayName: (displayName: string) => void;
  onCloudSync: (settings: Partial<CloudSyncSettings>) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onPush: () => void;
  onPull: () => void;
}) {
  const contentTab: ContentCategory = activeTab === 'sync' ? 'biomes' : activeTab;
  const category = library[contentTab];
  const [selectedSetId, setSelectedSetId] = useState(category.defaultSetId);
  const selectedSet = category.sets.find((set) => set.id === selectedSetId) ?? category.sets[0];
  const sortedSets = sortByLabel(category.sets);
  const visibleMembers = sortByLabel(category.members.filter((member) => selectedSet?.memberIds.includes(member.id)));
  const featureClassMembers = contentTab === 'features' ? visibleMembers.filter((member) => member.kind === 'feature-class') : [];
  const featureMembers = contentTab === 'features' ? visibleMembers.filter((member) => member.kind !== 'feature-class') : visibleMembers;
  const [selectedMemberId, setSelectedMemberId] = useState(visibleMembers[0]?.id ?? category.members[0]?.id ?? '');
  const selectedMember = category.members.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? category.members[0];
  const featureRuleOptions = sortByLabel(library.features.members.filter((member) => member.kind === 'feature')).map((member) => member.id);

  useEffect(() => {
    setSelectedSetId(library[contentTab].defaultSetId);
  }, [contentTab]);

  useEffect(() => {
    const nextCategory = library[contentTab];
    const nextSet = nextCategory.sets.find((set) => set.id === selectedSetId) ?? nextCategory.sets[0];
    const currentMemberStillVisible = nextSet?.memberIds.includes(selectedMemberId);
    if (currentMemberStillVisible) return;
    const nextMember = nextCategory.members.find((member) => nextSet?.memberIds.includes(member.id));
    setSelectedMemberId(nextMember?.id ?? '');
  }, [contentTab, library, selectedMemberId, selectedSetId]);

  const updateCategory = (updater: (category: ContentCategoryConfig) => ContentCategoryConfig) => {
    onChange({ ...library, [contentTab]: updater(library[contentTab]) });
  };

  const updateSetLabel = (setId: string, label: string) => {
    updateCategory((current) => ({
      ...current,
      sets: current.sets.map((set) => (set.id === setId ? { ...set, label } : set))
    }));
  };

  const markDefaultSet = (setId: string) => {
    updateCategory((current) => ({
      ...current,
      defaultSetId: setId,
      sets: current.sets.map((set) => ({ ...set, isDefault: set.id === setId }))
    }));
  };

  const addSet = () => {
    const baseId = `${contentTab}-set-${category.sets.length + 1}`;
    const setId = uniqueId(baseId, category.sets.map((set) => set.id));
    updateCategory((current) => ({
      ...current,
      sets: [
        ...current.sets,
        {
          id: setId,
          label: `New ${current.label} Set`,
          description: 'User-defined set.',
          memberIds: [],
          isDefault: false
        }
      ]
    }));
    setSelectedSetId(setId);
  };

  const copySelectedSet = () => {
    if (!selectedSet) return;
    const baseId = `${selectedSet.id}-copy`;
    const setId = uniqueId(baseId, category.sets.map((set) => set.id));
    updateCategory((current) => ({
      ...current,
      sets: [
        ...current.sets,
        {
          ...selectedSet,
          id: setId,
          label: `${selectedSet.label} Copy`,
          description: `Copy of ${selectedSet.label}.`,
          isDefault: false
        }
      ],
      members: current.members.map((member) => selectedSet.memberIds.includes(member.id) && !member.setIds.includes(setId) ? { ...member, setIds: [...member.setIds, setId] } : member)
    }));
    setSelectedSetId(setId);
  };

  const addMemberToSelectedSet = () => {
    if (!selectedSet) return;
    const baseId = `${contentTab}-member-${category.members.length + 1}`;
    const memberId = uniqueId(baseId, category.members.map((member) => member.id));
    const member: ContentMember = {
      id: memberId,
      label: `New ${singularCategoryLabel(category.label)}`,
      description: 'User-defined member.',
      source: 'user',
      setIds: [selectedSet.id],
      rules: [],
      tags: [],
      assets: [
        {
          id: `${memberId}-preview-color`,
          label: 'Preview color',
          kind: 'preview-color',
          value: '#9f998d'
        }
      ]
    };
    updateCategory((current) => ({
      ...current,
      members: [...current.members, member],
      sets: current.sets.map((set) => (set.id === selectedSet.id ? { ...set, memberIds: [...set.memberIds, member.id] } : set))
    }));
    setSelectedMemberId(memberId);
  };

  const deleteSelectedMember = () => {
    if (!selectedMember || selectedMember.source !== 'user') return;
    const deletedMemberId = selectedMember.id;
    updateCategory((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== deletedMemberId),
      sets: current.sets.map((set) => ({ ...set, memberIds: set.memberIds.filter((memberId) => memberId !== deletedMemberId) }))
    }));
    setSelectedMemberId('');
  };

  const copyMemberToSet = (memberId: string, setId: string) => {
    updateCategory((current) => ({
      ...current,
      sets: current.sets.map((set) => (set.id === setId && !set.memberIds.includes(memberId) ? { ...set, memberIds: [...set.memberIds, memberId] } : set)),
      members: current.members.map((member) => (member.id === memberId && !member.setIds.includes(setId) ? { ...member, setIds: [...member.setIds, setId] } : member))
    }));
  };

  const updateMember = (memberId: string, patch: Partial<ContentMember>) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) => (member.id === memberId ? { ...member, ...patch } : member))
    }));
  };

  const updateMemberRule = (memberId: string, index: number, patch: Partial<ContentRule>) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              rules: member.rules.map((rule, ruleIndex) => (ruleIndex === index ? cleanRule({ ...rule, ...patch }) : rule))
            }
          : member
      )
    }));
  };

  const addMemberRule = (memberId: string) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              rules: [...member.rules, { field: 'wetness', min: 0 }]
            }
          : member
      )
    }));
  };

  const removeMemberRule = (memberId: string, index: number) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) => (member.id === memberId ? { ...member, rules: member.rules.filter((_, ruleIndex) => ruleIndex !== index) } : member))
    }));
  };

  const updateMemberAsset = (memberId: string, assetId: string, value: string) => {
    updateCategory((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              assets: member.assets.map((asset) => (asset.id === assetId ? { ...asset, value } : asset))
            }
          : member
      )
    }));
  };

  const attachUploadedAsset = (memberId: string, file: File, kind: 'texture' | 'icon') => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      updateCategory((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.id === memberId
            ? {
                ...member,
                assets: [
                  ...member.assets,
                  {
                    id: `${member.id}-${kind}-${Date.now()}`,
                    label: file.name,
                    kind,
                    value
                  }
                ]
              }
            : member
        )
      }));
    };
    reader.readAsDataURL(file);
  };

  if (activeTab === 'sync') {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="config-modal sync-config-modal" role="dialog" aria-modal="true" aria-label="Sync configuration">
          <header className="config-modal-header">
            <div>
              <h2>Content Configuration</h2>
              <p>Keep user settings, content assets, and saved maps available across machines.</p>
            </div>
            <button type="button" title="Close configuration" className="icon-button" onClick={onClose}><X size={18} /></button>
          </header>
          <ConfigTabs activeTab={activeTab} library={library} onTab={onTab} />
          <div className="sync-config-body">
            <section className="member-detail">
              <h3>Sync</h3>
              <label className="sync-toggle large">
                <input
                  type="checkbox"
                  checked={cloudSync.keepSynced}
                  onChange={(event) => onCloudSync({ keepSynced: event.target.checked })}
                />
                Keep data synced
              </label>
              <p>When this is on and you are signed in, Parchment Worlds automatically syncs configured content, uploaded assets, generation settings, hex export settings, and saved maps.</p>
              <div className="sync-actions">
                <button type="button" onClick={onSignIn} disabled={!cloudSync.keepSynced}>
                  <User size={15} />
                  {signInButtonLabel(identity)}
                </button>
                <button type="button" className="subtle-button" onClick={onSignOut} disabled={!isLoggedIn(identity)}>
                  <X size={15} />
                  Log Out
                </button>
                <button type="button" onClick={onPush} disabled={!cloudSync.serviceBaseUrl || !cloudSync.keepSynced || isLocalOnlyIdentity(identity)}>
                  <Upload size={15} />
                  Sync Now
                </button>
                <button type="button" onClick={onPull} disabled={!cloudSync.serviceBaseUrl || !cloudSync.keepSynced || !isLoggedIn(identity) || isLocalOnlyIdentity(identity)}>
                  <Download size={15} />
                  Pull Latest
                </button>
              </div>
              <div className="sync-status">
                <Cloud size={14} />
                <span>{syncStatus}</span>
              </div>
              <div className="identity-summary-grid">
                <div className="identity-summary-row"><span>User</span><span>{isLoggedIn(identity) ? identity.userId : 'Anonymous'}</span></div>
                <div className="identity-summary-row"><span>Tier</span><span>{identity.entitlements.tier}</span></div>
                <div className="identity-summary-row"><span>Saved maps</span><span>{savedMapCount}</span></div>
                <div className="identity-summary-row"><span>Last push</span><span>{cloudSync.lastSyncedAt ? new Date(cloudSync.lastSyncedAt).toLocaleString() : 'Never'}</span></div>
                <div className="identity-summary-row"><span>Last pull</span><span>{cloudSync.lastPulledAt ? new Date(cloudSync.lastPulledAt).toLocaleString() : 'Never'}</span></div>
              </div>
              {cloudSync.lastError && <div className="sync-error">{cloudSync.lastError}</div>}
            </section>
            <section className="member-detail">
              <h3>Account</h3>
              <label>
                Display name
                <input value={identity.displayName} onChange={(event) => onDisplayName(event.target.value)} />
              </label>
              <div className="identity-summary-grid">
                <div className="identity-summary-row"><span>Google</span><span>{identity.externalIds.googleId ? 'Linked' : 'Not linked'}</span></div>
                <div className="identity-summary-row"><span>Steam</span><span>{identity.externalIds.steamId ? 'Linked' : 'Not linked'}</span></div>
                <div className="identity-summary-row"><span>Cloud prefs</span><span>{can(identity, 'cloud_preferences') ? 'Allowed' : 'Local only'}</span></div>
                <div className="identity-summary-row"><span>Admin tools</span><span>{can(identity, 'admin_content_tools') ? 'Allowed' : 'Unavailable'}</span></div>
              </div>
              <button type="button" onClick={onSignIn} disabled={!cloudSync.keepSynced}>
                <User size={15} />
                {signInButtonLabel(identity)}
              </button>
              <button type="button" className="subtle-button" onClick={onSignOut} disabled={!isLoggedIn(identity)}>
                <X size={15} />
                Log Out
              </button>
              <label>
                Service URL
                <input
                  value={cloudSync.serviceBaseUrl}
                  placeholder="Configured by hosted build"
                  onChange={(event) => onCloudSync({ serviceBaseUrl: event.target.value })}
                />
              </label>
              <p>The hosted build should preconfigure Google and service credentials. Steam builds can inject the Steam account at launch, and the app links it without a manual ID field.</p>
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="config-modal" role="dialog" aria-modal="true" aria-label="Content configuration">
        <header className="config-modal-header">
          <div>
            <h2>Content Configuration</h2>
            <p>Configure source-of-truth content sets, mapping rules, and display assets.</p>
          </div>
          <button type="button" title="Close configuration" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <ConfigTabs activeTab={activeTab} library={library} onTab={onTab} />
        <div className="config-body">
          <aside className="config-sets" aria-label={`${category.label} sets`}>
            <div className="config-section-title">
              <strong>Sets</strong>
              <button type="button" className="icon-button compact-action-button" title={`Create ${category.label} set`} aria-label={`Create ${category.label} set`} onClick={addSet}>
                <Plus size={15} />
              </button>
            </div>
            {sortedSets.map((set) => (
              <div key={set.id} className="set-row">
                <button type="button" className={set.id === selectedSetId ? 'set-button active' : 'set-button'} onClick={() => setSelectedSetId(set.id)}>
                  <span>{set.label}</span>
                  {set.isDefault && <em>Default</em>}
                </button>
                <button type="button" className="icon-button compact-action-button danger-action-button" title={`Delete ${set.label}`} aria-label={`Delete ${set.label}`} disabled={set.isDefault} onClick={() => {
                  setSelectedSetId(set.id);
                  if (!set.isDefault) {
                    const deletedSetId = set.id;
                    updateCategory((current) => {
                      const members = current.members
                        .map((member) => ({ ...member, setIds: member.setIds.filter((setId) => setId !== deletedSetId) }))
                        .filter((member) => member.source !== 'user' || member.setIds.length > 0);
                      return {
                        ...current,
                        sets: current.sets.filter((candidate) => candidate.id !== deletedSetId),
                        members
                      };
                    });
                    setSelectedSetId(category.defaultSetId);
                    setSelectedMemberId('');
                  }
                }}>
                  -
                </button>
              </div>
            ))}
            {selectedSet && (
              <div className="selected-set-tools">
                <label>
                  Set name
                  <input value={selectedSet.label} onChange={(event) => updateSetLabel(selectedSet.id, event.target.value)} />
                </label>
                <div className="compact-button-row">
                  <button type="button" title="Mark selected set as default" onClick={() => markDefaultSet(selectedSet.id)} disabled={selectedSet.isDefault}>
                    Default
                  </button>
                  <button type="button" title="Copy selected set as a new editable set" onClick={copySelectedSet}>
                    <Copy size={14} />
                    Copy As
                  </button>
                </div>
              </div>
            )}
          </aside>
          <section className="config-members" aria-label={`${category.label} members`}>
            <div className="config-section-title">
              <strong>{selectedSet?.label ?? category.label}</strong>
              <div className="section-title-actions">
                <span>{visibleMembers.length} members</span>
                <button type="button" className="icon-button compact-action-button" title={`Create ${singularCategoryLabel(category.label)}`} aria-label={`Create ${singularCategoryLabel(category.label)}`} disabled={!selectedSet} onClick={addMemberToSelectedSet}>
                  <Plus size={15} />
                </button>
              </div>
            </div>
            {contentTab === 'features' ? (
              <div className="member-grid split-member-grid">
                <MemberListSection title="Feature Classes" members={featureClassMembers} selectedMemberId={selectedMember?.id} onSelect={setSelectedMemberId} />
                <MemberListSection title="Features" members={featureMembers} selectedMemberId={selectedMember?.id} onSelect={setSelectedMemberId} />
              </div>
            ) : (
              <MemberListSection members={visibleMembers} selectedMemberId={selectedMember?.id} onSelect={setSelectedMemberId} />
            )}
            <div className="copy-row">
              <label htmlFor="copy-member-target">Copy selected to</label>
              <select id="copy-member-target" onChange={(event) => selectedMember && copyMemberToSet(selectedMember.id, event.target.value)} defaultValue="">
                <option value="" disabled>Select set</option>
                {sortByLabel(category.sets.filter((set) => selectedMember && !set.memberIds.includes(selectedMember.id))).map((set) => (
                  <option key={set.id} value={set.id}>{set.label}</option>
                ))}
              </select>
            </div>
          </section>
          <section className="member-detail" aria-label="Selected member detail">
            {selectedMember ? (
              <>
                <label>
                  Member name
                  <input value={selectedMember.label} onChange={(event) => updateMember(selectedMember.id, { label: event.target.value })} />
                </label>
                <label>
                  Description
                  <textarea value={selectedMember.description} rows={3} onChange={(event) => updateMember(selectedMember.id, { description: event.target.value })} />
                </label>
                <Metric label="Source" value={selectedMember.source} />
                {selectedMember.kind && <Metric label="Kind" value={selectedMember.kind} />}
                <Metric label="Sets" value={selectedMember.setIds.length.toString()} />
                <button type="button" className="danger-action-button" title="Delete selected member" onClick={deleteSelectedMember} disabled={selectedMember.source !== 'user'}>
                  -
                </button>
                <MemberMetadata member={selectedMember} />
                <div className="rule-list">
                  <div className="config-section-title">
                    <h4>Rules</h4>
                    <button type="button" className="icon-button compact-action-button" title="Create mapping rule" aria-label="Create mapping rule" onClick={() => addMemberRule(selectedMember.id)}>
                      <Plus size={15} />
                    </button>
                  </div>
                  {selectedMember.rules.length ? selectedMember.rules.map((rule, index) => (
                    <div className="rule-editor" key={`${rule.field}-${index}`}>
                      <select title="Rule type" aria-label="Rule type" value={rule.field} onChange={(event) => updateMemberRule(selectedMember.id, index, makeRuleForField(event.target.value, featureRuleOptions))}>
                        {ruleFieldOptions.map((option) => <option key={option.field} value={option.field}>{option.label}</option>)}
                      </select>
                      <select title="Logic type" aria-label="Logic type" value={ruleLogic(rule)} disabled={ruleFieldKind(rule.field) === 'boolean' || rule.field === 'notFeature'} onChange={(event) => updateMemberRule(selectedMember.id, index, makeRuleForLogic(rule, event.target.value as RuleLogic, featureRuleOptions))}>
                        <option value="lt">&lt;</option>
                        <option value="equals">=</option>
                        <option value="gt">&gt;</option>
                        <option value="between">&lt;&gt;</option>
                      </select>
                      <RuleValueEditor rule={rule} featureRuleOptions={featureRuleOptions} onChange={(patch) => updateMemberRule(selectedMember.id, index, patch)} />
                      <button type="button" className="icon-button compact-action-button" title="Remove mapping rule" aria-label="Remove mapping rule" onClick={() => removeMemberRule(selectedMember.id, index)}>
                        <X size={14} />
                      </button>
                    </div>
                  )) : <span>No mapping rules yet</span>}
                </div>
                <div className="asset-list">
                  <h4>Assets</h4>
                  {selectedMember.assets.map((asset) => (
                    <label key={asset.id}>
                      {asset.label}
                      <input value={asset.value} onChange={(event) => updateMemberAsset(selectedMember.id, asset.id, event.target.value)} />
                    </label>
                  ))}
                  <label className="asset-upload">
                    Attach texture
                    <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && attachUploadedAsset(selectedMember.id, event.target.files[0], 'texture')} />
                  </label>
                  <label className="asset-upload">
                    Attach icon
                    <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && attachUploadedAsset(selectedMember.id, event.target.files[0], 'icon')} />
                  </label>
                </div>
              </>
            ) : (
              <p>No member selected.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function MemberListSection({
  title,
  members,
  selectedMemberId,
  onSelect
}: {
  title?: string;
  members: ContentMember[];
  selectedMemberId?: string;
  onSelect: (memberId: string) => void;
}) {
  return (
    <div className="member-list-section">
      {title && <h4>{title}</h4>}
      {members.length ? members.map((member) => (
        <button key={member.id} type="button" className={member.id === selectedMemberId ? 'member-button active' : 'member-button'} onClick={() => onSelect(member.id)}>
          <span className="member-swatch" style={{ background: previewColor(member) }} />
          <span>{member.label}</span>
        </button>
      )) : <span className="empty-member-list">None</span>}
    </div>
  );
}

function MemberMetadata({ member }: { member: ContentMember }) {
  const rows = [
    member.classIds?.length ? ['Classes', member.classIds.join(', ')] : null,
    member.parentIds?.length ? ['Parents', member.parentIds.join(', ')] : null,
    member.compatibleWith ? ['Compatible', Object.entries(member.compatibleWith).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' | ')] : null,
    member.targetMappings ? ['Mappings', Object.entries(member.targetMappings).map(([key, value]) => `${key}: ${value}`).join(' | ')] : null
  ].filter(Boolean) as Array<[string, string]>;
  if (!rows.length) return null;
  return (
    <div className="member-metadata">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <p>{value}</p>
        </div>
      ))}
    </div>
  );
}

function RuleValueEditor({ rule, featureRuleOptions, onChange }: { rule: ContentRule; featureRuleOptions: string[]; onChange: (patch: Partial<ContentRule>) => void }) {
  const fieldKind = ruleFieldKind(rule.field);
  const logic = ruleLogic(rule);
  if (fieldKind === 'boolean') {
    return (
      <label className="rule-toggle">
        <input type="checkbox" checked={rule.equals === true} onChange={(event) => onChange({ equals: event.target.checked, min: undefined, max: undefined, includes: undefined })} />
        {rule.equals === true ? 'Yes' : 'No'}
      </label>
    );
  }
  if (fieldKind === 'text') {
    const options = rule.field === 'notFeature' ? featureRuleOptions : textRuleValueOptions[rule.field] ?? [];
    return (
      <select title="Rule value" aria-label="Rule value" value={optionalRuleValueText(rule.equals)} onChange={(event) => onChange({ equals: optionalRuleValue(event.target.value), min: undefined, max: undefined, includes: undefined })}>
        <option value="">Select value</option>
        {options.map((option) => <option key={option} value={option}>{titleText(option)}</option>)}
      </select>
    );
  }
  if (logic === 'between') {
    return (
      <div className="rule-value-pair">
        <input title="Minimum value" aria-label="Minimum value" placeholder="min" value={optionalNumberText(rule.min)} onChange={(event) => onChange({ min: optionalNumberValue(event.target.value), equals: undefined, includes: undefined })} />
        <input title="Maximum value" aria-label="Maximum value" placeholder="max" value={optionalNumberText(rule.max)} onChange={(event) => onChange({ max: optionalNumberValue(event.target.value), equals: undefined, includes: undefined })} />
      </div>
    );
  }
  const label = logic === 'lt' ? 'Maximum value' : logic === 'gt' ? 'Minimum value' : 'Equals value';
  const value = logic === 'lt' ? rule.max : logic === 'gt' ? rule.min : typeof rule.equals === 'number' ? rule.equals : undefined;
  return (
    <input
      title={label}
      aria-label={label}
      placeholder={logic === 'lt' ? 'max' : logic === 'gt' ? 'min' : 'value'}
      value={optionalNumberText(value)}
      onChange={(event) => onChange(makeRuleForNumericValue(logic, event.target.value))}
    />
  );
}

function ConfigTabs({
  activeTab,
  library,
  onTab
}: {
  activeTab: ConfigTab;
  library: ContentLibraryConfig;
  onTab: (tab: ConfigTab) => void;
}) {
  const tabs: ConfigTab[] = [...(Object.keys(library) as ContentCategory[]), 'sync'];
  return (
    <div className="config-tabs" role="tablist" aria-label="Content categories">
      {tabs.map((tab) => (
          <button key={tab} type="button" role="tab" title={`Configure ${tab}`} aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => onTab(tab)}>
            {tab === 'sync' ? 'Sync' : library[tab].label}
          </button>
      ))}
    </div>
  );
}

function signInButtonLabel(identity: LocalUserIdentity): string {
  if (googleSignInAvailable()) {
    return identity.externalIds.googleId ? 'Refresh Google Sign-In' : 'Sign In with Google';
  }
  if (identity.externalIds.steamId) return 'Refresh Steam Sign-In';
  return 'Sign In';
}

function uniqueId(baseId: string, existing: string[]): string {
  if (!existing.includes(baseId)) return baseId;
  let index = 2;
  while (existing.includes(`${baseId}-${index}`)) index += 1;
  return `${baseId}-${index}`;
}

function sortByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
