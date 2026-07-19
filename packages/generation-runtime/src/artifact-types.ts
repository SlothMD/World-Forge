import type { ArtifactDeclaration, ArtifactRequirement } from './contracts';

export type ArtifactTypeDefinition<T = unknown> = {
  type: string;
  version: string;
  sourceId: string;
  core: boolean;
  description?: string;
  /**
   * Projects an artifact payload to the deterministic content used for hashing.
   * Runtime telemetry, timestamps, and other volatile metadata should be omitted.
   */
  hashContent?: (value: T) => unknown;
};

export class ArtifactTypeRegistry {
  private readonly definitions = new Map<string, ArtifactTypeDefinition>();

  register<T>(definition: ArtifactTypeDefinition<T>): void {
    const key = this.key(definition.type, definition.version);
    const existing = this.definitions.get(key);
    if (existing) {
      throw new Error(`Artifact type ${definition.type}@${definition.version} is already registered by ${existing.sourceId}.`);
    }
    if (definition.core && definition.sourceId !== 'core') {
      throw new Error(`Only the core runtime may register core artifact type ${definition.type}@${definition.version}.`);
    }
    this.definitions.set(key, Object.freeze({ ...definition }) as ArtifactTypeDefinition);
  }

  get<T = unknown>(type: string, version: string): ArtifactTypeDefinition<T> | undefined {
    return this.definitions.get(this.key(type, version)) as ArtifactTypeDefinition<T> | undefined;
  }

  list(type?: string): ArtifactTypeDefinition[] {
    const values = [...this.definitions.values()];
    return type ? values.filter((definition) => definition.type === type) : values;
  }

  projectHashContent<T>(type: string, version: string, value: T): unknown {
    const definition = this.get<T>(type, version);
    if (!definition) throw new Error(`Artifact type ${type}@${version} is not registered.`);
    return definition.hashContent ? definition.hashContent(value) : value;
  }

  validateDeclaration(declaration: ArtifactDeclaration, sourceId: string): void {
    const definition = this.get(declaration.type, declaration.version);
    if (!definition) throw new Error(`Artifact output ${declaration.type}@${declaration.version} is not registered.`);
    if (definition.core && definition.sourceId !== sourceId && declaration.core === false) {
      throw new Error(`Source ${sourceId} cannot redefine core artifact ${declaration.type}@${declaration.version}.`);
    }
  }

  validateRequirement(requirement: ArtifactRequirement): void {
    if (requirement.version) {
      if (!this.get(requirement.type, requirement.version)) throw new Error(`Artifact input ${requirement.type}@${requirement.version} is not registered.`);
      return;
    }
    if (!this.list(requirement.type).length) throw new Error(`Artifact input ${requirement.type} is not registered.`);
  }

  private key(type: string, version: string): string {
    return `${type}@${version}`;
  }
}
