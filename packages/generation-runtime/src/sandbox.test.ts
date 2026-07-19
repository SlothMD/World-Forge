import { describe, expect, it } from 'vitest';
import type { StageImplementation, StagePermissionSet } from './contracts';
import { assertSandboxPolicy, defaultDeveloperSandboxPolicy } from './sandbox';

const permissions: StagePermissionSet = {
  readArtifacts: [],
  writeArtifacts: [],
  extendMetadata: [],
  emitTags: false,
  emitEvents: false,
  filesystem: false,
  network: false,
  clock: false
};

function implementation(overrides: Partial<StagePermissionSet> = {}): StageImplementation {
  return {
    id: 'com.example.test',
    version: '0.1.0',
    stageId: 'test.stage',
    sourceId: 'com.example',
    definition: {
      id: 'test.stage',
      version: '0.1.0',
      displayName: 'Test stage',
      bodyKinds: ['system'],
      inputs: [],
      outputs: [],
      supportedFidelity: ['preview'],
      deterministic: true,
      resumable: true,
      permissions: { ...permissions, ...overrides }
    },
    execute: () => ({ status: 'passed', artifacts: [], metrics: [], findings: [] })
  };
}

describe('developer sandbox policy', () => {
  it('allows capability-only stages', () => {
    expect(() => assertSandboxPolicy(implementation(), defaultDeveloperSandboxPolicy)).not.toThrow();
  });

  it('rejects undeclared host access', () => {
    expect(() => assertSandboxPolicy(implementation({ network: true }), defaultDeveloperSandboxPolicy)).toThrow(/network/i);
    expect(() => assertSandboxPolicy(implementation({ filesystem: true }), defaultDeveloperSandboxPolicy)).toThrow(/filesystem/i);
  });
});
