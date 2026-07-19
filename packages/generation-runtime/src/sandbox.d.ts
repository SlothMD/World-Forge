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
export declare const defaultDeveloperSandboxPolicy: SandboxPolicy;
export declare function assertSandboxPolicy(implementation: StageImplementation, policy: SandboxPolicy): void;
/**
 * Phase 0 adapter for trusted local developer scripts.
 *
 * This enforces the capability-shaped context and timeout policy, but it is not
 * a hostile-code security boundary. Public mods must move behind a worker,
 * child process, embedded isolate, or WebAssembly runtime using this same
 * adapter contract.
 */
export declare class TrustedDeveloperSandbox implements StageSandboxAdapter {
    readonly id = "core.sandbox.trusted-developer";
    run(request: SandboxRunRequest): Promise<SandboxRunResult>;
}
//# sourceMappingURL=sandbox.d.ts.map