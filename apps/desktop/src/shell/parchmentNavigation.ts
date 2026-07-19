export type ParchmentNavigation = {
  landingUrl: string;
  projectsUrl: string;
  accountUrl: string;
};

const DEFAULT_PARCHMENT_ORIGIN = 'https://parchmentworlds.theanaloggamingsociety.org';

export function resolveParchmentNavigation(
  currentUrl: string,
  fallbackOrigin = DEFAULT_PARCHMENT_ORIGIN,
): ParchmentNavigation {
  const current = new URL(currentUrl);
  const returnUrl = current.searchParams.get('pwReturnUrl');
  const origin = safeOrigin(returnUrl) ?? safeOrigin(fallbackOrigin) ?? DEFAULT_PARCHMENT_ORIGIN;

  return {
    landingUrl: new URL('/', origin).toString(),
    projectsUrl: new URL('/projects', origin).toString(),
    accountUrl: new URL('/login', origin).toString(),
  };
}

function safeOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
