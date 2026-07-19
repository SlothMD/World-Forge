import { performance } from 'node:perf_hooks';
import type { StageExecutionContext, StageImplementation, StageResult } from './contracts';

export type SandboxPolicy = {
  timeoutMs: number;
  memoryLimitMb?: number;
  allowFilesystem: boolean;
  allowNetwork: boolean;
  allowClock: boolean;
};

export type SandboxRunRequest = {
  implementation: StageImplementation;
  context: StageExecutionContext;
  policy: SandboxPolicy;
};

export type SandboxRunResult = {
  result?: StageResult | void;
  durationMs: number;
  timedOut: boolean;
};

export interface StageSandboxAdapter {
  readonly id: string;
  run(request: SandboxRunRequest): Promise<SandboxRunResult>;
}

export const defaultDeveloperSandboxPolicy: SandboxPolicy = {
  timeoutMs: 30_000,
  allowFilesystem: false,
  allowNetwork: false,
  allowClock: false
};

export function assertSandboxPolicy(implementation: StageImplementation, policy: SandboxPolicy): void {
  const permissions = implementation.definition.permissions;
  if (permissions.filesystem && !policy.allowFilesystem) throw new Error(`Stage ${implementation.id} requests filesystem access, but the sandbox policy denies it.`);
  if (permissions.network && !policy.allowNetwork) throw new Error(`Stage ${implementation.id} requests network access, but the sandbox policy denies it.`);
  if (permissions.clock && !policy.allowClock) throw new Error(`Stage ${implementation.id} requests clock access, but the sandbox policy denies it.`);
  if (!Number.isFinite(policy.timeoutMs) || policy.timeoutMs < 1) throw new Error('Sandbox timeout must be a positive number of milliseconds.');
}

/**
 * Phase 0 adapter for trusted local developer scripts.
 *
 * This enforces the capability-shaped context and timeout policy, but it is not
 * a hostile-code security boundary. Public mods must move behind a worker,
 * child process, embedded isolate, or WebAssembly runtime using this same
 * adapter contract.
 */
export class TrustedDeveloperSandbox implements StageSandboxAdapter {
  readonly id = 'core.sandbox.trusted-developer';

  async run(request: SandboxRunRequest): Promise<SandboxRunResult> {
    assertSandboxPolicy(request.implementation, request.policy);
    const started = performance.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          reject(new Error(`Stage ${request.implementation.id} exceeded sandbox timeout of ${request.policy.timeoutMs} ms.`));
        }, request.policy.timeoutMs);
      });
      const result = await Promise.race([
        Promise.resolve(request.implementation.execute(request.context)),
        timeoutPromise
      ]);
      return { result, durationMs: Math.round((performance.now() - started) * 1000) / 1000, timedOut };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
