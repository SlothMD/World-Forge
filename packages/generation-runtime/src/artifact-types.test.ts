import { describe, expect, it } from 'vitest';
import { ArtifactTypeRegistry } from './artifact-types';

describe('artifact type registry', () => {
  it('allows core registrations and rejects mod ownership of core schemas', () => {
    const registry = new ArtifactTypeRegistry();
    registry.register({ type: 'core.star', version: '1.0.0', sourceId: 'core', core: true });
    expect(registry.get('core.star', '1.0.0')?.sourceId).toBe('core');
    expect(() => registry.register({ type: 'core.planet', version: '1.0.0', sourceId: 'com.example.mod', core: true })).toThrow(/only the core runtime/i);
  });

  it('prevents duplicate artifact type registrations', () => {
    const registry = new ArtifactTypeRegistry();
    registry.register({ type: 'mod.example.layer', version: '1.0.0', sourceId: 'com.example.mod', core: false });
    expect(() => registry.register({ type: 'mod.example.layer', version: '1.0.0', sourceId: 'com.other.mod', core: false })).toThrow(/already registered/i);
  });

  it('projects volatile runtime metadata out of deterministic hash content', () => {
    const registry = new ArtifactTypeRegistry();
    registry.register<{ value: number; diagnostics: { durationMs: number } }>({
      type: 'core.example',
      version: '1.0.0',
      sourceId: 'core',
      core: true,
      hashContent: ({ diagnostics: _diagnostics, ...stable }) => stable
    });

    expect(registry.projectHashContent('core.example', '1.0.0', { value: 7, diagnostics: { durationMs: 10 } }))
      .toEqual(registry.projectHashContent('core.example', '1.0.0', { value: 7, diagnostics: { durationMs: 999 } }));
  });
});
