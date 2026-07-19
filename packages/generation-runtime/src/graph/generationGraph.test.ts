import { describe, expect, it } from 'vitest';
import { coreGenerationGraph, generationGraphNodeForStageId } from './generationGraph';

describe('core generation graph', () => {
  it('uses stable unique node and stage identifiers', () => {
    expect(coreGenerationGraph).toHaveLength(14);
    expect(new Set(coreGenerationGraph.map((node) => node.id)).size).toBe(coreGenerationGraph.length);
    expect(new Set(coreGenerationGraph.map((node) => node.stageId)).size).toBe(coreGenerationGraph.length);
  });

  it('matches the authoritative generator-core execution order', () => {
    expect(coreGenerationGraph.map((node) => node.stageId)).toEqual([
      'system.orbit',
      'topology.construct',
      'terrain.primordial',
      'plates.construct',
      'terrain.crust-fields',
      'terrain.topology-elevation',
      'terrain.finalization',
      'terrain.water-geology',
      'climate.glaciation',
      'ecology.hydrology-biomes',
      'projection.equirectangular-assembly',
      'world.motion-coupling',
      'world.deep-time-aging',
      'world.outputs-validation'
    ]);
  });

  it('resolves graph node identifiers and legacy native stage aliases without label inference', () => {
    expect(generationGraphNodeForStageId('terrain.finalization')?.id).toBe('terrain.finalization');
    expect(generationGraphNodeForStageId('world.system-orbit')?.id).toBe('system.orbit');
    expect(generationGraphNodeForStageId('world.present-climate')?.id).toBe('climate.glaciation');
    expect(generationGraphNodeForStageId('world.outputs-validation')?.id).toBe('world.outputs-validation');
    expect(generationGraphNodeForStageId('world.unknown')).toBeUndefined();
  });
});
