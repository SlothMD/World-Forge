import type { GenerationModManifest } from './mods';
import type { GenerationWorkflow } from './workflow';
import { validateWorkflow } from './workflow';

function parseObject(source: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${detail}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must contain a JSON object.`);
  return parsed as Record<string, unknown>;
}

export function parseWorkflowJson(source: string): GenerationWorkflow {
  const workflow = parseObject(source, 'Workflow') as unknown as GenerationWorkflow;
  const validation = validateWorkflow(workflow);
  if (!validation.valid) throw new Error(`Workflow validation failed:\n${validation.errors.join('\n')}`);
  return workflow;
}

export function parseModManifestJson(source: string): GenerationModManifest {
  const manifest = parseObject(source, 'Mod manifest') as unknown as GenerationModManifest;
  if (!manifest.id || typeof manifest.id !== 'string') throw new Error('Mod manifest ID is required.');
  if (!manifest.version || typeof manifest.version !== 'string') throw new Error(`Mod ${manifest.id} is missing a version.`);
  if (!manifest.permissions || typeof manifest.permissions !== 'object') throw new Error(`Mod ${manifest.id} is missing permissions.`);
  return manifest;
}
