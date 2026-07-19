import type { RandomStream } from './contracts';

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export function deriveSeedPath(rootSeed: string, ...parts: Array<string | number | undefined>): string {
  return [rootSeed, ...parts.filter((part) => part !== undefined).map(String)].join('::');
}

export class DeterministicRandomStream implements RandomStream {
  readonly seedPath: string;
  private state: number;

  constructor(seedPath: string) {
    this.seedPath = seedPath;
    this.state = hash32(seedPath) || 0x6d2b79f5;
  }

  next(): number {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error(`Invalid integer range ${min}..${max}.`);
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  range(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new Error(`Invalid numeric range ${min}..${max}.`);
    return min + (max - min) * this.next();
  }

  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new Error('Cannot pick from an empty collection.');
    return values[this.int(0, values.length - 1)];
  }

  child(name: string): RandomStream {
    return new DeterministicRandomStream(deriveSeedPath(this.seedPath, name));
  }
}

export function createStageRandom(rootSeed: string, workflowId: string, stageId: string, implementationId: string, bodyId?: string, iteration?: number): RandomStream {
  return new DeterministicRandomStream(deriveSeedPath(rootSeed, workflowId, stageId, implementationId, bodyId, iteration));
}
