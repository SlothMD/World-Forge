import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export type ExternalAccountIdentity = {
  provider: 'google' | 'steam';
  externalId: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  idToken?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleJwtPayload = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
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
  return Boolean(firebaseClientConfig()) || Boolean(googleClientId());
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
  const firebaseConfig = firebaseClientConfig();
  if (firebaseConfig) return signInWithFirebaseGoogle(firebaseConfig);

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
          displayName: payload.name || payload.email || undefined,
          email: payload.email || undefined,
          avatarUrl: payload.picture || undefined,
          idToken: response.credential
        });
      }
    });
    googleId.prompt();
  });
}

async function signInWithFirebaseGoogle(firebaseConfig: FirebaseClientConfig): Promise<ExternalAccountIdentity> {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  const idToken = await result.user.getIdToken();
  return {
    provider: 'google',
    externalId: result.user.uid,
    displayName: result.user.displayName || result.user.email || undefined,
    email: result.user.email || undefined,
    avatarUrl: result.user.photoURL || undefined,
    idToken
  };
}

function googleClientId(): string {
  return (import.meta as { env?: { VITE_GOOGLE_CLIENT_ID?: string } }).env?.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
}

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
};

function firebaseClientConfig(): FirebaseClientConfig | null {
  const env = (import.meta as {
    env?: {
      VITE_FIREBASE_API_KEY?: string;
      VITE_FIREBASE_AUTH_DOMAIN?: string;
      VITE_FIREBASE_PROJECT_ID?: string;
      VITE_FIREBASE_STORAGE_BUCKET?: string;
      VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
      VITE_FIREBASE_APP_ID?: string;
    };
  }).env;
  const apiKey = env?.VITE_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = env?.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
  const projectId = env?.VITE_FIREBASE_PROJECT_ID?.trim() ?? '';
  const appId = env?.VITE_FIREBASE_APP_ID?.trim() ?? '';
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId
  };
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
