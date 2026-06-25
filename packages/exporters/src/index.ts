import JSZip from 'jszip';
import {
  MapLayers,
  SerializableLayer,
  SerializableTopologyLayer,
  TopologyLayers,
  WorldProject,
  biomeNames
} from '@world-forge/shared';
import { worldToSvg } from '@world-forge/renderer';

export function projectToJson(project: WorldProject): string {
  return JSON.stringify(serializeProject(project), null, 2);
}

export function exportSvg(project: WorldProject): string {
  return worldToSvg(project);
}

export async function exportWforge(project: WorldProject): Promise<Blob> {
  const zip = new JSZip();
  const serialized = serializeProject(project);
  zip.file('manifest.json', JSON.stringify({
    format: 'world-forge-project',
    formatVersion: 1,
    projectId: project.projectId,
    projectName: project.projectName,
    seed: project.seed,
    appVersion: project.appVersion,
    generatorVersion: project.generatorVersion,
    schemaVersion: 1,
    layerFiles: Object.keys(project.primaryWorld.layers).map((name) => `layers/${name}.json`),
    topologyLayerFiles: Object.keys(project.primaryWorld.topologyLayers ?? {}).map((name) => `topology-layers/${name}.json`)
  }, null, 2));
  zip.file('project.json', JSON.stringify(serialized, null, 2));
  for (const layer of serialized.primaryWorld.layers) {
    zip.file(`layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  for (const layer of serialized.primaryWorld.topologyLayers ?? []) {
    zip.file(`topology-layers/${layer.layerType}.json`, JSON.stringify(layer));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importWforge(file: File): Promise<WorldProject> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wforge package: missing project.json');
  return deserializeProject(JSON.parse(await projectFile.async('string')));
}

export function serializeProject(project: WorldProject) {
  const { diagnostics, ...serializableProject } = project;
  return {
    ...serializableProject,
    primaryWorld: {
      ...project.primaryWorld,
      layers: serializeLayers(project.primaryWorld.layers, project.primaryWorld.mapModel.resolution, project.primaryWorld.mapModel.projection),
      topologyLayers: serializeTopologyLayers(project.primaryWorld.topologyLayers, project.primaryWorld.topology),
      biomeLegend: biomeNames
    }
  };
}

export function deserializeProject(serialized: any): WorldProject {
  const layerEntries = serialized.primaryWorld.layers as SerializableLayer[];
  const layers = {} as MapLayers;
  for (const layer of layerEntries) {
    if (layer.dataEncoding === 'float32-array') {
      layers[layer.layerType] = new Float32Array(layer.data) as never;
    } else if (layer.dataEncoding === 'uint16-array') {
      layers[layer.layerType] = new Uint16Array(layer.data) as never;
    } else {
      layers[layer.layerType] = new Uint8Array(layer.data) as never;
    }
  }
  const topologyLayerEntries = (serialized.primaryWorld.topologyLayers ?? []) as SerializableTopologyLayer[];
  const topologyLayers = {} as TopologyLayers;
  for (const layer of topologyLayerEntries) {
    if (layer.dataEncoding === 'float32-array') {
      topologyLayers[layer.layerType] = new Float32Array(layer.data) as never;
    } else {
      topologyLayers[layer.layerType] = layer.dataEncoding === 'uint16-array' ? new Uint16Array(layer.data) as never : new Uint8Array(layer.data) as never;
    }
  }
  return {
    ...serialized,
    primaryWorld: {
      ...serialized.primaryWorld,
      layers,
      topologyLayers
    }
  } as WorldProject;
}

function serializeLayers(layers: MapLayers, resolution: WorldProject['primaryWorld']['mapModel']['resolution'], projection: WorldProject['primaryWorld']['mapModel']['projection']): SerializableLayer[] {
  return Object.entries(layers).map(([layerType, data]) => {
    const values = Array.from(data as Float32Array | Uint8Array | Uint16Array);
    const [minValue, maxValue] = minMax(values);
    return {
      layerId: `primary-${layerType}`,
      layerType: layerType as keyof MapLayers,
      resolution,
      projection,
      dataEncoding: data instanceof Float32Array ? 'float32-array' : data instanceof Uint16Array ? 'uint16-array' : 'uint8-array',
      minValue,
      maxValue,
      units: unitsForLayer(layerType),
      data: values
    };
  });
}

function serializeTopologyLayers(layers: TopologyLayers, topology: WorldProject['primaryWorld']['topology']): SerializableTopologyLayer[] {
  if (!layers) return [];
  return Object.entries(layers).map(([layerType, data]) => {
    const values = Array.from(data as Float32Array | Uint16Array);
    const [minValue, maxValue] = minMax(values);
    return {
      layerId: `primary-topology-${layerType}`,
      layerType: layerType as keyof TopologyLayers,
      topologyKind: topology.kind,
      topologyResolution: topology.resolution,
      dataEncoding: data instanceof Float32Array ? 'float32-array' : data instanceof Uint16Array ? 'uint16-array' : 'uint8-array',
      minValue,
      maxValue,
      units: unitsForLayer(layerType),
      data: values
    };
  });
}

function minMax(values: number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function unitsForLayer(layerType: string): string | undefined {
  if (layerType === 'temperature') return 'C';
  if (layerType === 'wetness') return '0-1';
  if (layerType === 'windX' || layerType === 'windY' || layerType === 'currentX' || layerType === 'currentY') return '-1..1 vector component';
  return undefined;
}
