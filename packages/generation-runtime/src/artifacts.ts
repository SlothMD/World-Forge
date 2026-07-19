import type { ArtifactEnvelope, ArtifactExtensions, ReadonlyArtifactAccess } from './contracts';

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (ArrayBuffer.isView(value)) return stableSerialize(Array.from(value as unknown as ArrayLike<number>));
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function freezeValue<T>(value: T): Readonly<T> {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) return Object.freeze(value) as Readonly<T>;
  return value as Readonly<T>;
}

export function hashArtifact(type: string, version: string, hashContent: unknown, extensions: ArtifactExtensions = {}, tags: readonly string[] = []): string {
  const source = stableSerialize({ type, version, core: hashContent, extensions, tags: [...tags].sort() });
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export class ArtifactStore implements ReadonlyArtifactAccess {
  private readonly byId = new Map<string, ArtifactEnvelope>();
  private readonly byType = new Map<string, string[]>();

  put<T>(artifact: ArtifactEnvelope<T>): ArtifactEnvelope<T> {
    if (this.byId.has(artifact.id)) throw new Error(`Artifact ${artifact.id} already exists.`);
    this.byId.set(artifact.id, artifact as ArtifactEnvelope);
    this.byType.set(artifact.type, [...(this.byType.get(artifact.type) ?? []), artifact.id]);
    return artifact;
  }

  replace<T>(artifact: ArtifactEnvelope<T>): ArtifactEnvelope<T> {
    const prior = this.byId.get(artifact.id);
    if (!prior) return this.put(artifact);
    if (prior.type !== artifact.type) throw new Error(`Artifact ${artifact.id} cannot change type from ${prior.type} to ${artifact.type}.`);
    this.byId.set(artifact.id, artifact as ArtifactEnvelope);
    return artifact;
  }

  get<T = unknown>(type: string): ArtifactEnvelope<T> | undefined {
    const ids = this.byType.get(type);
    return ids?.length ? this.byId.get(ids[ids.length - 1]) as ArtifactEnvelope<T> : undefined;
  }

  getById<T = unknown>(id: string): ArtifactEnvelope<T> | undefined {
    return this.byId.get(id) as ArtifactEnvelope<T> | undefined;
  }

  getAll<T = unknown>(type: string): ArtifactEnvelope<T>[] {
    return (this.byType.get(type) ?? []).map((id) => this.byId.get(id) as ArtifactEnvelope<T>);
  }

  require<T = unknown>(type: string): ArtifactEnvelope<T> {
    const artifact = this.get<T>(type);
    if (!artifact) throw new Error(`Required artifact ${type} is missing.`);
    return artifact;
  }

  values(): ArtifactEnvelope[] {
    return [...this.byId.values()];
  }
}

export function createArtifact<T>(input: {
  id: string;
  type: string;
  version: string;
  core: T;
  hashContent?: unknown;
  stageId: string;
  implementationId: string;
  extensions?: ArtifactExtensions;
  tags?: string[];
}): ArtifactEnvelope<T> {
  const extensions = Object.freeze({ ...(input.extensions ?? {}) });
  const tags = Object.freeze([...(input.tags ?? [])]);
  const hashContent = input.hashContent ?? input.core;
  return Object.freeze({
    id: input.id,
    type: input.type,
    version: input.version,
    core: freezeValue(input.core),
    extensions,
    tags,
    hash: hashArtifact(input.type, input.version, hashContent, extensions, tags),
    createdBy: Object.freeze({ stageId: input.stageId, implementationId: input.implementationId })
  });
}

export function extendArtifact<T>(artifact: ArtifactEnvelope<T>, namespace: string, value: Record<string, unknown>, hashContent: unknown = artifact.core): ArtifactEnvelope<T> {
  if (!namespace.includes('.')) throw new Error(`Extension namespace ${namespace} must use a globally unique mod ID.`);
  if (artifact.extensions[namespace]) throw new Error(`Extension namespace ${namespace} already exists on ${artifact.id}.`);
  const extensions = { ...artifact.extensions, [namespace]: Object.freeze({ ...value }) };
  return Object.freeze({ ...artifact, extensions: Object.freeze(extensions), hash: hashArtifact(artifact.type, artifact.version, hashContent, extensions, artifact.tags) });
}

export function tagArtifact<T>(artifact: ArtifactEnvelope<T>, namespace: string, tag: string, hashContent: unknown = artifact.core): ArtifactEnvelope<T> {
  if (!namespace.includes('.')) throw new Error(`Tag namespace ${namespace} must use a globally unique mod ID.`);
  const qualified = `${namespace}:${tag}`;
  if (artifact.tags.includes(qualified)) return artifact;
  const tags = Object.freeze([...artifact.tags, qualified]);
  return Object.freeze({ ...artifact, tags, hash: hashArtifact(artifact.type, artifact.version, hashContent, artifact.extensions, tags) });
}
