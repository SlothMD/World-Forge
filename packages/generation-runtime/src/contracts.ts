export type FidelityLevel = 'preview' | 'standard' | 'high' | 'diagnostic';
export type BodyKind = 'star' | 'rocky' | 'gas-giant' | 'ice-giant' | 'moon' | 'small-body' | 'system';
export type StageStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed' | 'skipped' | 'cancelled';
export type DiagnosticSeverity = 'info' | 'ok' | 'warn' | 'error';

export interface ArtifactRequirement {
  type: string;
  version?: string;
  optional?: boolean;
  multiple?: boolean;
}

export interface ArtifactDeclaration {
  type: string;
  version: string;
  optional?: boolean;
  core?: boolean;
}

export interface StagePermissionSet {
  readArtifacts: string[];
  writeArtifacts: string[];
  extendMetadata: string[];
  emitTags: boolean;
  emitEvents: boolean;
  filesystem: boolean;
  network: boolean;
  clock: boolean;
}

export const noStagePermissions: StagePermissionSet = {
  readArtifacts: [],
  writeArtifacts: [],
  extendMetadata: [],
  emitTags: false,
  emitEvents: false,
  filesystem: false,
  network: false,
  clock: false
};

export interface OutcomeInfluence {
  sourceParameter: string;
  targetOutcome: string;
  direction: 'increasing' | 'decreasing' | 'mixed' | 'threshold';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: 'low' | 'medium' | 'high';
  applicableWhen?: Record<string, unknown>;
}

export interface StagePlanningCapabilities {
  controls: string[];
  influences: OutcomeInfluence[];
  replanningCost: 'low' | 'medium' | 'high';
}

export interface StageDefinition {
  id: string;
  version: string;
  displayName: string;
  description?: string;
  bodyKinds: BodyKind[];
  inputs: ArtifactRequirement[];
  outputs: ArtifactDeclaration[];
  supportedFidelity: FidelityLevel[];
  deterministic: boolean;
  resumable: boolean;
  permissions: StagePermissionSet;
  planning?: StagePlanningCapabilities;
}

export interface DiagnosticMetric {
  id: string;
  value: number | string | boolean;
  unit?: string;
  severity?: DiagnosticSeverity;
  expected?: {
    target?: number;
    greenRange?: [number, number];
    yellowRange?: [number, number];
  };
  detail?: string;
}

export interface DiagnosticFinding {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
}

export interface ConvergenceSignal {
  id: string;
  value: number;
}

export interface CallbackRequest {
  type: 'invalidate' | 'rerun-iteration-group';
  target: string;
  reason: string;
}

export interface StageProvenance {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  stageId: string;
  implementationId: string;
  implementationVersion: string;
  sourceId: string;
  seedPath: string;
  inputArtifactHashes: string[];
  outputArtifactHashes: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  fidelity: FidelityLevel;
  iteration?: number;
}

export interface StageResult {
  status: Exclude<StageStatus, 'pending' | 'running'>;
  artifacts: ArtifactEnvelope[];
  metrics: DiagnosticMetric[];
  findings: DiagnosticFinding[];
  convergenceSignals?: ConvergenceSignal[];
  callbackRequests?: CallbackRequest[];
  provenance?: StageProvenance;
}

export interface ArtifactExtensions {
  [modId: string]: Record<string, unknown>;
}

export interface ArtifactEnvelope<T = unknown> {
  id: string;
  type: string;
  version: string;
  core: Readonly<T>;
  extensions: Readonly<ArtifactExtensions>;
  tags: readonly string[];
  hash: string;
  createdBy: {
    stageId: string;
    implementationId: string;
  };
}

export interface EventLedgerEntry {
  id: string;
  type: string;
  sourceStageId: string;
  bodyId?: string;
  relativeTime?: number;
  severity?: DiagnosticSeverity;
  scope?: EffectScope;
  data: Record<string, unknown>;
}

export type EffectScope =
  | { kind: 'global' }
  | { kind: 'system'; bodyIds?: string[] }
  | { kind: 'body'; bodyId: string }
  | { kind: 'spatial'; bodyId: string; origin: [number, number]; radiusKm: number; secondaryRadiusKm?: number }
  | { kind: 'dependency'; depth: number };

export interface RandomStream {
  readonly seedPath: string;
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
  child(name: string): RandomStream;
}

export interface StageExecutionContext {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  stageId: string;
  implementationId: string;
  sourceId: string;
  fidelity: FidelityLevel;
  parameters: Readonly<Record<string, unknown>>;
  artifacts: ReadonlyArtifactAccess;
  output: ArtifactOutputWriter;
  random: RandomStream;
  diagnostics: DiagnosticEmitter;
  events: EventLedgerWriter;
  signal: AbortSignal;
  iteration?: number;
}

export interface ReadonlyArtifactAccess {
  get<T = unknown>(type: string): ArtifactEnvelope<T> | undefined;
  getAll<T = unknown>(type: string): ArtifactEnvelope<T>[];
  require<T = unknown>(type: string): ArtifactEnvelope<T>;
}

export interface ArtifactOutputWriter {
  writeCore<T>(type: string, version: string, core: T, options?: { id?: string; tags?: string[] }): ArtifactEnvelope<T>;
  extend<T extends Record<string, unknown>>(artifactId: string, namespace: string, value: T): void;
  addTag(artifactId: string, namespace: string, tag: string): void;
}

export interface DiagnosticEmitter {
  metric(metric: DiagnosticMetric): void;
  finding(finding: DiagnosticFinding): void;
}

export interface EventLedgerWriter {
  append(entry: Omit<EventLedgerEntry, 'id' | 'sourceStageId'>): EventLedgerEntry;
}

export interface StageImplementation {
  id: string;
  version: string;
  stageId: string;
  sourceId: string;
  definition: StageDefinition;
  execute(context: StageExecutionContext): Promise<StageResult | void> | StageResult | void;
}
