import { describe, expect, it } from 'vitest';
import { detectSteamIdentity } from './accountProviders';

describe('account provider helpers', () => {
  it('detects a runtime Steam identity when the shell injects one', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __WORLD_FORGE_STEAM_IDENTITY__: {
          steamId: '76561198000000000',
          displayName: 'Steam Cartographer'
        }
      }
    });

    expect(detectSteamIdentity()).toEqual({
      provider: 'steam',
      externalId: '76561198000000000',
      displayName: 'Steam Cartographer'
    });

    delete (globalThis as { window?: Window }).window;
  });

  it('ignores missing Steam runtime identity', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {}
    });

    expect(detectSteamIdentity()).toBeNull();
    delete (globalThis as { window?: Window }).window;
  });
});
