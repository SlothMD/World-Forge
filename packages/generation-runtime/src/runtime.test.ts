import { describe, expect, it } from 'vitest';
import { ArtifactStore, createArtifact, extendArtifact, tagArtifact } from './artifacts';
import type { StageImplementation, StagePermissionSet } from './contracts';
import { WorkflowExecutor } from './executor';
import { assertPermissionSubset, resolveModOrder } from './mods';
import { createStageRandom } from './random';
import { StageRegistry } from './registry';
import { resolveWorkflow, validateWorkflow, type GenerationWorkflow } from './workflow';

const basePermissions: StagePermissionSet = {
  readArtifacts: [],
  writeArtifacts: [],
  extendMetadata: [],
  emitTags: false,
  emitEvents: false,
  filesystem: false,
  network: false,
  clock: false
};

function stage(input: {
  id: string;
  stageId: string;
  inputs?: string[];
  output?: string;
  execute?: StageImplementation['execute'];
}): StageImplementation {
  return {
    id: input.id,
    version: '0.1.0',
    stageId: input.stageId,
    sourceId: 'core',
    definition: {
      id: input.stageId,
      version: '0.1.0',
      displayName: input.stageId,
      bodyKinds: ['system'],
      inputs: (input.inputs ?? []).map((type) => ({ type })),
      outputs: input.output ? [{ type: input.output, version: '1.0.0', core: true }] : [],
      supportedFidelity: ['preview', 'standard', 'high', 'diagnostic'],
      deterministic: true,
      resumable: true,
      permissions: {
        ...basePermissions,
        readArtifacts: input.inputs ?? [],
        writeArtifacts: input.output ? [input.output] : []
      }
    },
    execute: input.execute ?? (() => ({ status: 'passed', artifacts: [], metrics: [], findings: [] }))
  };
}

describe('deterministic random streams', () => {
  it('keeps stage streams stable and isolated', () => {
    const first = createStageRandom('root', 'workflow', 'star', 'core.star', 'star-primary');
    const second = createStageRandom('root', 'workflow', 'star', 'core.star', 'star-primary');
    const other = createStageRandom('root', 'workflow', 'orbits', 'core.orbits', 'system');
    expect([first.next(), first.next(), first.int(1, 10)]).toEqual([second.next(), second.next(), second.int(1, 10)]);
    expect(other.next()).not.toBe(second.next());
  });
});

describe('artifact boundaries', () => {
  it('allows additive namespaced extensions without changing core data', () => {
    const artifact = createArtifact({ id: 'star-1', type: 'core.star', version: '1.0.0', core: { mass: 1 }, stageId: 'star', implementationId: 'core.star' });
    const extended = extendArtifact(artifact, 'com.example.mod', { flareIndex: 0.3 });
    const tagged = tagArtifact(extended, 'com.example.mod', 'active');
    expect(tagged.core).toEqual({ mass: 1 });
    expect(tagged.extensions['com.example.mod']).toEqual({ flareIndex: 0.3 });
    expect(tagged.tags).toContain('com.example.mod:active');
    expect(tagged.hash).not.toBe(artifact.hash);
  });

  it('stores the latest artifact by type while preserving earlier versions', () => {
    const store = new ArtifactStore();
    store.put(createArtifact({ id: 'a', type: 'core.star', version: '1', core: { mass: 1 }, stageId: 'one', implementationId: 'one' }));
    store.put(createArtifact({ id: 'b', type: 'core.star', version: '1', core: { mass: 2 }, stageId: 'two', implementationId: 'two' }));
    expect(store.require<{ mass: number }>('core.star').core.mass).toBe(2);
    expect(store.getAll('core.star')).toHaveLength(2);
  });
});

describe('mod resolution', () => {
  it('honors dependencies, ordering hints, and stable priority', () => {
    const result = resolveModOrder([
      { id: 'com.example.c', version: '1', priority: 20, loadsAfter: ['com.example.b'], permissions: basePermissions },
      { id: 'com.example.a', version: '1', priority: 5, permissions: basePermissions },
      { id: 'com.example.b', version: '1', dependsOn: [{ id: 'com.example.a' }], permissions: basePermissions }
    ]);
    expect(result.ordered.map((mod) => mod.id)).toEqual(['com.example.a', 'com.example.b', 'com.example.c']);
  });

  it('rejects dependency cycles and permission escalation', () => {
    expect(() => resolveModOrder([
      { id: 'com.example.a', version: '1', dependsOn: [{ id: 'com.example.b' }], permissions: basePermissions },
      { id: 'com.example.b', version: '1', dependsOn: [{ id: 'com.example.a' }], permissions: basePermissions }
    ])).toThrow(/cycle/i);
    expect(() => assertPermissionSubset({ ...basePermissions, network: true }, basePermissions)).toThrow(/network/i);
  });
});

describe('workflow registry and executor', () => {
  it('resolves registered stages and passes artifacts through the graph', async () => {
    const registry = new StageRegistry();
    const star = stage({
      id: 'core.star.basic',
      stageId: 'stellar.generate',
      output: 'core.star',
      execute(context) {
        const artifact = context.output.writeCore('core.star', '1.0.0', { mass: context.random.range(0.8, 1.2) }, { id: 'star-primary' });
        context.diagnostics.metric({ id: 'star.mass', value: (artifact.core as { mass: number }).mass });
        return { status: 'passed', artifacts: [artifact], metrics: [], findings: [] };
      }
    });
    const lanes = stage({
      id: 'core.orbits.basic',
      stageId: 'system.orbital-lanes',
      inputs: ['core.star'],
      output: 'core.orbital-lanes',
      execute(context) {
        const starArtifact = context.artifacts.require<{ mass: number }>('core.star');
        const artifact = context.output.writeCore('core.orbital-lanes', '1.0.0', { count: Math.round(starArtifact.core.mass * 8) }, { id: 'orbital-lanes' });
        return { status: 'passed', artifacts: [artifact], metrics: [], findings: [] };
      }
    });
    registry.register(star, { id: 'core', version: '0.1.0', kind: 'core' });
    registry.register(lanes, { id: 'core', version: '0.1.0', kind: 'core' });

    const workflow: GenerationWorkflow = {
      schemaVersion: '0.1.0',
      id: 'core.basic-system',
      version: '0.1.0',
      displayName: 'Basic system',
      defaultFidelity: 'preview',
      stages: [
        { id: 'star', stageId: 'stellar.generate', bodyKind: 'system' },
        { id: 'lanes', stageId: 'system.orbital-lanes', bodyKind: 'system', dependsOn: ['star'] }
      ]
    };
    expect(validateWorkflow(workflow).valid).toBe(true);
    const plan = resolveWorkflow(workflow, registry);
    expect(plan.stages.map((node) => node.id)).toEqual(['star', 'lanes']);

    const first = await new WorkflowExecutor(registry).run(plan, { seed: 'baseline-1', runId: 'run-1' });
    const second = await new WorkflowExecutor(registry).run(plan, { seed: 'baseline-1', runId: 'run-2' });
    expect(first.status).toBe('passed');
    expect(first.artifacts.map((artifact) => artifact.hash)).toEqual(second.artifacts.map((artifact) => artifact.hash));
    expect(first.artifacts.some((artifact) => artifact.type === 'core.orbital-lanes')).toBe(true);
    expect(first.stages.every((record) => record.provenance?.seedPath)).toBe(true);
  });

  it('rejects undeclared cycles', () => {
    const workflow: GenerationWorkflow = {
      schemaVersion: '0.1.0',
      id: 'bad',
      version: '1',
      displayName: 'Bad workflow',
      defaultFidelity: 'preview',
      stages: [
        { id: 'a', stageId: 'a', dependsOn: ['b'] },
        { id: 'b', stageId: 'b', dependsOn: ['a'] }
      ]
    };
    expect(validateWorkflow(workflow).errors.join(' ')).toMatch(/cycle/i);
  });
});
