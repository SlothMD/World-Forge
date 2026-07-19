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
export declare function googleSignInAvailable(): boolean;
export declare function detectSteamIdentity(): ExternalAccountIdentity | null;
export declare function signInWithGoogle(): Promise<ExternalAccountIdentity>;
export {};
