export type GenerationGraphNodeDefinition = {
  id: string;
  stageId: string;
  implementationId: string;
  label: string;
  description: string;
  inputs: string[];
  outputs: string[];
  fidelity: string[];
};

export const coreGenerationGraph: GenerationGraphNodeDefinition[] = [
  {
    id: 'system.orbit',
    stageId: 'system.orbit',
    implementationId: 'generator-core.generateProject.system-orbit',
    label: 'System and orbit',
    description: 'Resolve selected values, stellar system, orbit, primary world body, moons, and tide influence inputs.',
    inputs: ['core.generation-config@1.0.0'],
    outputs: ['core.selected-values@1.0.0', 'core.solar-system@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'topology.construct',
    stageId: 'topology.construct',
    implementationId: 'generator-core.graph.topology-construction-node',
    label: 'Topology construction',
    description: 'Build the authoritative cubed-sphere topology used by downstream world facts.',
    inputs: ['core.generation-config@1.0.0'],
    outputs: ['core.topology@1.0.0', 'core.topology-resolution@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'terrain.primordial',
    stageId: 'terrain.primordial',
    implementationId: 'generator-core.graph.primordial-terrain-node',
    label: 'Primordial terrain',
    description: 'Seed pre-plate elevation, crust age, crust thickness, basin structure, and impact fields.',
    inputs: ['core.topology@1.0.0', 'core.selected-values@1.0.0'],
    outputs: ['core.primordial-terrain@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'plates.construct',
    stageId: 'plates.construct',
    implementationId: 'generator-core.graph.plate-construction-node',
    label: 'Plate construction',
    description: 'Choose plate centers, classify plate kind, compute motion vectors, and assign topology cells to plates.',
    inputs: ['core.topology@1.0.0', 'core.primordial-terrain@1.0.0'],
    outputs: ['core.plates@1.0.0', 'core.plate-layer@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'terrain.crust-fields',
    stageId: 'terrain.crust-fields',
    implementationId: 'generator-core.graph.crust-fields-node',
    label: 'Crust fields',
    description: 'Resolve continent phase seeds and topology-native continental, thickness, and shelf fields.',
    inputs: ['core.topology@1.0.0', 'core.plates@1.0.0', 'core.selected-values@1.0.0'],
    outputs: ['core.crust-fields@1.0.0', 'core.terrain-phases@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'terrain.topology-elevation',
    stageId: 'terrain.topology-elevation',
    implementationId: 'generator-core.graph.topology-elevation-node',
    label: 'Topology elevation',
    description: 'Combine primordial terrain, plates, crust fields, and boundary uplift into source elevation.',
    inputs: ['core.topology@1.0.0', 'core.primordial-terrain@1.0.0', 'core.plates@1.0.0', 'core.crust-fields@1.0.0'],
    outputs: ['core.topology-elevation@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'terrain.finalization',
    stageId: 'terrain.finalization',
    implementationId: 'generator-core.graph.terrain-finalization-node',
    label: 'Terrain finalization',
    description: 'Resolve pre-aging sea level, run aging and enrichment, and resolve final sea level.',
    inputs: ['core.topology@1.0.0', 'core.topology-elevation@1.0.0'],
    outputs: ['core.final-terrain@1.0.0', 'core.sea-level@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'terrain.water-geology',
    stageId: 'terrain.water-geology',
    implementationId: 'generator-core.graph.water-geology-node',
    label: 'Water and geology',
    description: 'Assign final topology water masks and volcanism from terrain and plate context.',
    inputs: ['core.final-terrain@1.0.0', 'core.plates@1.0.0'],
    outputs: ['core.water-mask@1.0.0', 'core.volcanism@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'climate.glaciation',
    stageId: 'climate.glaciation',
    implementationId: 'generator-core.graph.climate-glaciation-node',
    label: 'Climate and glaciation',
    description: 'Generate topology climate, moisture candidate layers, ice, wind/current fields, and climate preview diagnostics.',
    inputs: ['core.final-terrain@1.0.0', 'core.water-mask@1.0.0', 'core.selected-values@1.0.0'],
    outputs: ['core.climate-model@1.0.0', 'core.ice@1.0.0', 'core.flow-fields@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'ecology.hydrology-biomes',
    stageId: 'ecology.hydrology-biomes',
    implementationId: 'generator-core.graph.hydrology-biomes-node',
    label: 'Hydrology and biomes',
    description: 'Generate topology rivers, lakes, and data-backed biome classification from terrain and climate.',
    inputs: ['core.final-terrain@1.0.0', 'core.water-mask@1.0.0', 'core.climate-model@1.0.0'],
    outputs: ['core.hydrology@1.0.0', 'core.biomes@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'projection.equirectangular-assembly',
    stageId: 'projection.equirectangular-assembly',
    implementationId: 'generator-core.graph.projection-assembly-node',
    label: 'Projection assembly',
    description: 'Project authoritative topology layers and topology river paths into equirectangular preview/export layers.',
    inputs: ['core.topology@1.0.0', 'core.final-terrain@1.0.0', 'core.water-mask@1.0.0', 'core.climate-model@1.0.0', 'core.hydrology@1.0.0', 'core.biomes@1.0.0'],
    outputs: ['core.projected-layers@1.0.0', 'core.projected-rivers@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'world.motion-coupling',
    stageId: 'world.motion-coupling',
    implementationId: 'generator-core.plateMotionPipeline.motion-coupling',
    label: 'Motion coupling',
    description: 'Apply deterministic plate-motion magnitudes and motion-driven terrain coupling before deep-time aging.',
    inputs: ['core.world-project@1.0.0', 'core.plates@1.0.0'],
    outputs: ['core.motion-coupled-world@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'world.deep-time-aging',
    stageId: 'world.deep-time-aging',
    implementationId: 'generator-core.deepTimePipeline.deep-time-foundation',
    label: 'Deep-time aging',
    description: 'Run bounded aging epochs and reconcile final terrain, water, climate, hydrology, biomes, and projection layers.',
    inputs: ['core.motion-coupled-world@1.0.0'],
    outputs: ['core.aged-world@1.0.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  },
  {
    id: 'world.outputs-validation',
    stageId: 'world.outputs-validation',
    implementationId: 'generator-core.nativeStagePipeline.outputs-validation',
    label: 'Outputs and validation',
    description: 'Attach final diagnostics, biome cohesion, metrics, and consistency findings to the generated project.',
    inputs: ['core.aged-world@1.0.0'],
    outputs: ['core.world-project@1.1.0'],
    fidelity: ['preview', 'standard', 'high', 'diagnostic']
  }
];

const legacyNativeStageToGraphNode: Record<string, string> = {
  'world.system-orbit': 'system.orbit',
  'world.primordial-crust': 'terrain.primordial',
  'world.tectonics-cratons': 'plates.construct',
  'world.initial-terrain': 'terrain.topology-elevation',
  'world.deep-time-aging': 'world.deep-time-aging',
  'world.final-water': 'terrain.water-geology',
  'world.present-climate': 'climate.glaciation',
  'world.hydrology': 'ecology.hydrology-biomes',
  'world.biomes-features': 'ecology.hydrology-biomes',
  'world.outputs-validation': 'world.outputs-validation'
};

export function generationGraphNodeForStageId(stageId: string): GenerationGraphNodeDefinition | undefined {
  const graphNodeId = legacyNativeStageToGraphNode[stageId] ?? stageId;
  return coreGenerationGraph.find((node) => node.id === graphNodeId || node.stageId === graphNodeId);
}
