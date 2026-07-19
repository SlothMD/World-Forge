export type ParchmentNavigation = {
    landingUrl: string;
    projectsUrl: string;
    accountUrl: string;
};
export declare function resolveParchmentNavigation(currentUrl: string, fallbackOrigin?: string): ParchmentNavigation;
