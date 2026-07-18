export type ParchmentContext = {
  contractVersion: string;
  projectId: string;
  projectName: string;
  revision: string;
};

export function readParchmentContext(search: string): ParchmentContext {
  const params = new URLSearchParams(search);

  return {
    contractVersion: params.get('contract') || 'world-forge-embed-v1',
    projectId: params.get('projectId') || 'standalone',
    projectName: params.get('projectName') || 'Standalone World Forge',
    revision: params.get('revision') || '0',
  };
}
