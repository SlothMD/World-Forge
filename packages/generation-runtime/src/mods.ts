import type { StagePermissionSet } from './contracts';

export type ModDependency = {
  id: string;
  version?: string;
};

export type ModStageRegistration = {
  implementationId: string;
  stageId: string;
  replaces?: boolean;
};

export type GenerationModManifest = {
  id: string;
  version: string;
  displayName?: string;
  priority?: number;
  dependsOn?: ModDependency[];
  loadsAfter?: string[];
  loadsBefore?: string[];
  permissions: StagePermissionSet;
  stages?: ModStageRegistration[];
};

export type ResolvedModOrder = {
  ordered: GenerationModManifest[];
  warnings: string[];
};

function assertUniqueIds(manifests: readonly GenerationModManifest[]): void {
  const seen = new Set<string>();
  for (const manifest of manifests) {
    if (!manifest.id.includes('.')) throw new Error(`Mod ID ${manifest.id} must use a globally unique dotted namespace.`);
    if (seen.has(manifest.id)) throw new Error(`Duplicate mod ID ${manifest.id}.`);
    seen.add(manifest.id);
  }
}

export function resolveModOrder(manifests: readonly GenerationModManifest[]): ResolvedModOrder {
  assertUniqueIds(manifests);
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const outgoing = new Map<string, Set<string>>();
  const incomingCount = new Map<string, number>();
  const warnings: string[] = [];

  for (const manifest of manifests) {
    outgoing.set(manifest.id, new Set());
    incomingCount.set(manifest.id, 0);
  }

  const addEdge = (before: string, after: string, required: boolean) => {
    if (!byId.has(before) || !byId.has(after)) {
      if (required) throw new Error(`Required mod ordering dependency ${before} -> ${after} cannot be satisfied.`);
      warnings.push(`Optional mod ordering preference ${before} -> ${after} was ignored because one mod is not loaded.`);
      return;
    }
    if (before === after) throw new Error(`Mod ${before} cannot order itself.`);
    const targets = outgoing.get(before)!;
    if (targets.has(after)) return;
    targets.add(after);
    incomingCount.set(after, (incomingCount.get(after) ?? 0) + 1);
  };

  for (const manifest of manifests) {
    for (const dependency of manifest.dependsOn ?? []) {
      if (!byId.has(dependency.id)) throw new Error(`Mod ${manifest.id} depends on missing mod ${dependency.id}.`);
      addEdge(dependency.id, manifest.id, true);
    }
    for (const after of manifest.loadsAfter ?? []) addEdge(after, manifest.id, false);
    for (const before of manifest.loadsBefore ?? []) addEdge(manifest.id, before, false);
  }

  const ready = manifests.filter((manifest) => incomingCount.get(manifest.id) === 0);
  const sortReady = () => ready.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id));
  sortReady();

  const ordered: GenerationModManifest[] = [];
  while (ready.length) {
    const next = ready.shift()!;
    ordered.push(next);
    for (const target of outgoing.get(next.id) ?? []) {
      const remaining = (incomingCount.get(target) ?? 0) - 1;
      incomingCount.set(target, remaining);
      if (remaining === 0) {
        ready.push(byId.get(target)!);
        sortReady();
      }
    }
  }

  if (ordered.length !== manifests.length) {
    const blocked = manifests.filter((manifest) => !ordered.some((item) => item.id === manifest.id)).map((manifest) => manifest.id);
    throw new Error(`Mod ordering cycle detected among: ${blocked.join(', ')}.`);
  }

  const replacements = new Map<string, string[]>();
  for (const manifest of ordered) {
    for (const registration of manifest.stages ?? []) {
      if (!registration.replaces) continue;
      replacements.set(registration.stageId, [...(replacements.get(registration.stageId) ?? []), manifest.id]);
    }
  }
  for (const [stageId, sources] of replacements) {
    if (sources.length > 1) throw new Error(`Stage ${stageId} has competing exclusive replacements from ${sources.join(', ')}.`);
  }

  return { ordered, warnings };
}

export function assertPermissionSubset(requested: StagePermissionSet, granted: StagePermissionSet): void {
  const missing = (requestedValues: string[], grantedValues: string[]) => requestedValues.filter((value) => !grantedValues.includes(value));
  const missingReads = missing(requested.readArtifacts, granted.readArtifacts);
  const missingWrites = missing(requested.writeArtifacts, granted.writeArtifacts);
  const missingExtensions = missing(requested.extendMetadata, granted.extendMetadata);
  if (missingReads.length) throw new Error(`Artifact read permissions not granted: ${missingReads.join(', ')}.`);
  if (missingWrites.length) throw new Error(`Artifact write permissions not granted: ${missingWrites.join(', ')}.`);
  if (missingExtensions.length) throw new Error(`Metadata extension permissions not granted: ${missingExtensions.join(', ')}.`);
  for (const flag of ['emitTags', 'emitEvents', 'filesystem', 'network', 'clock'] as const) {
    if (requested[flag] && !granted[flag]) throw new Error(`Permission ${flag} was requested but not granted.`);
  }
}
