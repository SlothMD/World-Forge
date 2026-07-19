import { describe, expect, it } from 'vitest';
import { resolveParchmentNavigation } from './parchmentNavigation';

describe('resolveParchmentNavigation', () => {
  it('uses the Parchment return origin supplied by the local handoff', () => {
    const navigation = resolveParchmentNavigation(
      'http://localhost:5173/?pwReturnUrl=http%3A%2F%2Flocalhost%3A5273%2Fprojects%2Fproject-123',
    );

    expect(navigation.landingUrl).toBe('http://localhost:5273/');
    expect(navigation.projectsUrl).toBe('http://localhost:5273/projects');
    expect(navigation.accountUrl).toBe('http://localhost:5273/login');
  });

  it('uses the configured fallback when no handoff is present', () => {
    const navigation = resolveParchmentNavigation('http://localhost:5173/', 'https://example.test');

    expect(navigation.landingUrl).toBe('https://example.test/');
  });
});
