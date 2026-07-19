import type { WorldProject } from '@world-forge/shared';
export type DeepTimeLedgerFingerprint = Record<string, number | string>;
export declare function fingerprintDeepTimeLedger(project: WorldProject): DeepTimeLedgerFingerprint;
