export type ExternalAccountIdentity = {
  provider: 'google' | 'steam';
  externalId: string;
  displayName?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleJwtPayload = {
  sub?: string;
  name?: string;
  email?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: () => void;
        };
      };
    };
    __WORLD_FORGE_STEAM_IDENTITY__?: {
      steamId?: string;
      displayName?: string;
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

export function googleSignInAvailable(): boolean {
  return Boolean(googleClientId());
}

export function detectSteamIdentity(): ExternalAccountIdentity | null {
  const runtimeIdentity = globalThis.window?.__WORLD_FORGE_STEAM_IDENTITY__;
  const steamId = runtimeIdentity?.steamId?.trim();
  if (!steamId) return null;
  return {
    provider: 'steam',
    externalId: steamId,
    displayName: runtimeIdentity?.displayName?.trim() || undefined
  };
}

export async function signInWithGoogle(): Promise<ExternalAccountIdentity> {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Google sign-in is not configured for this build.');
  await loadGoogleIdentityServices();
  const googleId = globalThis.window?.google?.accounts?.id;
  if (!googleId) throw new Error('Google sign-in failed to load.');

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = window.setTimeout(() => {
      if (!resolved) reject(new Error('Google sign-in was not completed.'));
    }, 120000);

    googleId.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        const payload = response.credential ? decodeGoogleCredential(response.credential) : null;
        if (!payload?.sub) {
          window.clearTimeout(timeout);
          reject(new Error('Google sign-in did not return a usable account id.'));
          return;
        }
        resolved = true;
        window.clearTimeout(timeout);
        resolve({
          provider: 'google',
          externalId: payload.sub,
          displayName: payload.name || payload.email || undefined
        });
      }
    });
    googleId.prompt();
  });
}

function googleClientId(): string {
  return (import.meta as { env?: { VITE_GOOGLE_CLIENT_ID?: string } }).env?.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
}

function loadGoogleIdentityServices(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    if (globalThis.window?.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Google sign-in.'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function decodeGoogleCredential(credential: string): GoogleJwtPayload | null {
  const [, payload] = credential.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as GoogleJwtPayload;
  } catch {
    return null;
  }
}
