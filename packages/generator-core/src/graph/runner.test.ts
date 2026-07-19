import { describe, expect, it } from 'vitest';
import { GenerationGraphRunner } from './runner';
import { GenerationNode } from './types';

describe('GenerationGraphRunner', () => {
  it('executes dependencies once and returns the target result', () => {
    const calls: string[] = [];
    const upstream: GenerationNode<number, number> = {
      id: 'upstream',
      version: '1',
      dependencies: [],
      execute(_context, input) {
        calls.push('upstream');
        return input * 2;
      }
    };
    const downstream: GenerationNode<number, number> = {
      id: 'downstream',
      version: '1',
      dependencies: ['upstream'],
      execute(_context, input, dependencies) {
        calls.push('downstream');
        return input + (dependencies.get('upstream') as number);
      }
    };

    const run = new GenerationGraphRunner([upstream, downstream]).run(
      'downstream',
      { rootSeed: 'test-seed' },
      new Map([
        ['upstream', 3],
        ['downstream', 4]
      ])
    );

    expect(calls).toEqual(['upstream', 'downstream']);
    expect(run.results.get('upstream')?.output).toBe(6);
    expect(run.results.get('downstream')?.output).toBe(10);
  });

  it('rejects duplicate node registration', () => {
    const node: GenerationNode<void, void> = {
      id: 'duplicate',
      version: '1',
      dependencies: [],
      execute() {}
    };

    expect(() => new GenerationGraphRunner([node, node])).toThrow('already registered');
  });

  it('rejects missing dependencies and cycles', () => {
    const missing: GenerationNode<void, void> = {
      id: 'missing-target',
      version: '1',
      dependencies: ['not-registered'],
      execute() {}
    };
    expect(() => new GenerationGraphRunner([missing]).run('missing-target', { rootSeed: 'seed' }, new Map([['missing-target', undefined]]))).toThrow('not registered');

    const a: GenerationNode<void, void> = {
      id: 'a',
      version: '1',
      dependencies: ['b'],
      execute() {}
    };
    const b: GenerationNode<void, void> = {
      id: 'b',
      version: '1',
      dependencies: ['a'],
      execute() {}
    };
    expect(() => new GenerationGraphRunner([a, b]).run('a', { rootSeed: 'seed' }, new Map([['a', undefined], ['b', undefined]]))).toThrow('cycle detected');
  });

  it('records validation results', () => {
    const node: GenerationNode<number, number> = {
      id: 'validated',
      version: '2',
      dependencies: [],
      execute(_context, input) {
        return input;
      },
      validate(_input, output) {
        return { valid: output > 0, issues: output > 0 ? [] : [{ severity: 'error', message: 'Must be positive.' }] };
      }
    };

    const run = new GenerationGraphRunner([node]).run('validated', { rootSeed: 'seed' }, new Map([['validated', -1]]));
    expect(run.results.get('validated')?.validation?.valid).toBe(false);
  });
});
