import {
  GenerationConfig,
  GenerationDiagnostics,
  PrimaryWorld,
  SelectedValues,
  SolarSystem,
  clamp
} from '@world-forge/shared';
import { runGenerationFoundation } from './graph/run-generation-foundation';
import { SeededRandom } from './random';
import type { GenerateProjectOptions } from './index';
import { buildFlatWorldHexOverlay } from './worldHexOverlay';
import { buildWorldRegions } from './worldRegions';

export type PrimaryWorldDiagnosticsRecorder = {
  measure<T>(name: string, fn: () => T): T;
  record(name: string, ms: number): void;
  recordGraph(graph: NonNullable<GenerationDiagnostics['graph']>): void;
  snapshot(): GenerationDiagnostics;
};

export type LegacyPrimaryWorldOperations = {
  emitTopologyPreview: (...args: any[]) => void;
  createTopologyPlates: (...args: any[]) => any;
  assignTopologyPlateLayer: (...args: any[]) => void;
  createTerrainPhases: (...args: any[]) => any;
  generateCrustFields: (...args: any[]) => any;
  findTopologySeaLevelForOceanTarget: (...args: any[]) => number;
  applyTopologyTerrainAging: (...args: any[]) => void;
  applyTopologyTerrainEnrichment: (...args: any[]) => void;
  assignTopologyWater: (...args: any[]) => void;
  assignTopologyVolcanism: (...args: any[]) => void;
  generateTopologyClimate: (...args: any[]) => void;
  generateTopologyClimateMoistureCandidate: (...args: any[]) => void;
  assignTopologyIce: (...args: any[]) => void;
  generateClimatePipelinePreview: (...args: any[]) => any;
  generateTopologyHydrology: (...args: any[]) => any[];
  assignTopologyBiomes: (...args: any[]) => void;
  projectTopologyToEquirectangular: (...args: any[]) => void;
  projectTopologyFlowToEquirectangular: (...args: any[]) => void;
  projectTopologyRiver: (...args: any[]) => any;
};

export function orchestratePrimaryWorld(
  config: GenerationConfig,
  values: SelectedValues,
  solarSystem: SolarSystem,
  rng: SeededRandom,
  diagnostics: PrimaryWorldDiagnosticsRecorder,
  options: GenerateProjectOptions,
  operations: LegacyPrimaryWorldOperations
): PrimaryWorld {
  const primaryBody = solarSystem.bodies.find((body) => body.isPrimaryWorld);
  const moons = primaryBody?.moons ?? [];
  const tideInfluence = round(clamp(moons.reduce((sum, moon) => sum + moon.tideInfluence, 0), 0, 2), 2);

  const foundation = runGenerationFoundation(config.seed, {
    topology: {
      outputResolution: config.outputResolution,
      topologyResolution: config.topologyResolution
    },
    values,
    rng,
    terrainFinalization: {
      values,
      rng,
      diagnostics,
      operations: {
        findTopologySeaLevelForOceanTarget: operations.findTopologySeaLevelForOceanTarget,
        applyTopologyTerrainAging: operations.applyTopologyTerrainAging,
        applyTopologyTerrainEnrichment: operations.applyTopologyTerrainEnrichment
      }
    },
    waterGeology: {
      diagnostics,
      operations: {
        assignTopologyWater: operations.assignTopologyWater,
        assignTopologyVolcanism: operations.assignTopologyVolcanism
      }
    },
    climateGlaciation: {
      config,
      values,
      tideInfluence,
      diagnostics,
      operations: {
        generateTopologyClimate: operations.generateTopologyClimate,
        generateTopologyClimateMoistureCandidate: operations.generateTopologyClimateMoistureCandidate,
        assignTopologyIce: operations.assignTopologyIce,
        generateClimatePipelinePreview: operations.generateClimatePipelinePreview
      }
    },
    hydrologyBiomes: {
      values,
      biomeRules: config.biomeRules,
      diagnostics,
      operations: {
        generateTopologyHydrology: operations.generateTopologyHydrology,
        assignTopologyBiomes: operations.assignTopologyBiomes
      }
    },
    projectionAssembly: {
      outputResolution: config.outputResolution,
      diagnostics,
      operations: {
        projectTopologyToEquirectangular: operations.projectTopologyToEquirectangular,
        projectTopologyFlowToEquirectangular: operations.projectTopologyFlowToEquirectangular,
        projectTopologyRiver: operations.projectTopologyRiver
      }
    },
    onNodeEvent: options.onGraphNodeEvent
  });
  diagnostics.recordGraph(foundation.graph);
  diagnostics.record('topology.build', foundation.timings.topologyMs);
  diagnostics.record('topology.terrain.primordial', foundation.timings.primordialMs);
  diagnostics.record('topology.plates.create', foundation.timings.plateConstructionMs);
  diagnostics.record('topology.plates.assign', 0);
  diagnostics.record('topology.terrain.phases', foundation.timings.terrainPhasesMs);
  diagnostics.record('topology.terrain.crust-fields', foundation.timings.crustFieldsMs);
  diagnostics.record('topology.terrain.elevation', foundation.timings.topologyElevationMs);
  if (foundation.timings.terrainFinalizationMs !== undefined) {
    diagnostics.record('topology.terrain.finalization-node', foundation.timings.terrainFinalizationMs);
  }
  if (foundation.timings.waterGeologyMs !== undefined) {
    diagnostics.record('topology.water-geology-node', foundation.timings.waterGeologyMs);
  }
  if (foundation.timings.climateGlaciationMs !== undefined) {
    diagnostics.record('topology.climate-glaciation-node', foundation.timings.climateGlaciationMs);
  }
  if (foundation.timings.hydrologyBiomesMs !== undefined) {
    diagnostics.record('topology.hydrology-biomes-node', foundation.timings.hydrologyBiomesMs);
  }
  if (foundation.timings.projectionAssemblyMs !== undefined) {
    diagnostics.record('projection.assembly-node', foundation.timings.projectionAssemblyMs);
  }

  const topology = foundation.topology.topology;
  if (!foundation.terrain) throw new Error('Generation foundation did not produce finalized terrain.');
  if (!foundation.waterGeology) throw new Error('Generation foundation did not produce water/geology layers.');
  if (!foundation.climateGlaciation) throw new Error('Generation foundation did not produce climate/glaciation layers.');
  if (!foundation.hydrologyBiomes) throw new Error('Generation foundation did not produce hydrology/biome layers.');
  if (!foundation.projectionAssembly) throw new Error('Generation foundation did not produce projected layers.');
  const topologyElevation = foundation.terrain.elevation;
  const topologyPlates = foundation.plates.plateLayer;
  const topologyWater = foundation.waterGeology.water;
  const topologyTemperature = foundation.climateGlaciation.temperature;
  const topologyWetness = foundation.climateGlaciation.wetness;
  const topologyClimateMoisture = foundation.climateGlaciation.climateMoisture;
  const topologyClimatePrecipitation = foundation.climateGlaciation.climatePrecipitation;
  const topologyClimateWetnessDelta = foundation.climateGlaciation.climateWetnessDelta;
  const topologyBiomes = foundation.hydrologyBiomes.biomes;
  const topologyIce = foundation.climateGlaciation.ice;
  const topologyRiver = foundation.hydrologyBiomes.river;
  const topologyLakes = foundation.hydrologyBiomes.lakes;
  const topologyVolcanism = foundation.waterGeology.volcanism;
  const topologyWindX = foundation.climateGlaciation.windX;
  const topologyWindY = foundation.climateGlaciation.windY;
  const topologyCurrentX = foundation.climateGlaciation.currentX;
  const topologyCurrentY = foundation.climateGlaciation.currentY;
  const primordial = foundation.primordial;
  const topologyPlateData = foundation.plates.plates;
  const terrainPhases = foundation.crust.phases;
  const topologyCrust = foundation.crust.crust;

  operations.emitTopologyPreview(options, 'primordial', 'Primordial terrain', 0.08, topology, primordial.elevation);
  operations.emitTopologyPreview(options, 'plates', 'Plate layout', 0.18, topology, primordial.elevation, undefined, undefined, topologyPlates);
  operations.emitTopologyPreview(options, 'elevation', 'Tectonic uplift', 0.38, topology, foundation.elevation.elevation);

  operations.emitTopologyPreview(options, 'aged', 'Aging terrain', 0.52, topology, topologyElevation);

  const seaLevel = foundation.terrain.seaLevel;
  operations.emitTopologyPreview(options, 'water', 'Sea level and basins', 0.62, topology, topologyElevation, topologyWater, seaLevel);

  operations.emitTopologyPreview(options, 'climate', 'Climate and rainfall', 0.74, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness);
  const climate = foundation.climateGlaciation.climate;

  operations.emitTopologyPreview(options, 'hydrology', 'Hydrology and rivers', 0.86, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness, topologyRiver);
  operations.emitTopologyPreview(options, 'biomes', 'Biomes settling', 0.93, topology, topologyElevation, topologyWater, seaLevel, undefined, topologyWetness, topologyRiver, topologyBiomes, topologyIce);

  const { layers, rivers } = foundation.projectionAssembly;
  const hexOverlay = buildFlatWorldHexOverlay(values.sizeClass, config.projection);
  const topologyLayers = {
    elevation: topologyElevation,
    plates: topologyPlates,
    water: topologyWater,
    temperature: topologyTemperature,
    wetness: topologyWetness,
    climateMoisture: topologyClimateMoisture,
    climatePrecipitation: topologyClimatePrecipitation,
    climateWetnessDelta: topologyClimateWetnessDelta,
    biomes: topologyBiomes,
    ice: topologyIce,
    river: topologyRiver,
    lakes: topologyLakes,
    volcanism: topologyVolcanism
  };

  return {
    id: 'primary-world',
    name: `World ${config.seed}`,
    sizeClass: values.sizeClass,
    massClass: round(values.sizeClass * 1.05, 2),
    oceanPercentage: values.oceanPercentage,
    seaLevel,
    axialTiltDeg: values.axialTiltDeg,
    orbitalEccentricity: values.orbitalEccentricity,
    averageTemperatureC: values.averageTemperatureC,
    aridity: values.aridity,
    tideInfluence,
    mapModel: {
      resolution: config.outputResolution,
      projection: config.projection,
      wrapMode: config.wrapMode
    },
    topology: {
      kind: topology.kind,
      resolution: topology.resolution,
      cellCount: topology.cellCount
    },
    topologyLayers,
    hexOverlay,
    regions: buildWorldRegions(topology, topologyLayers, undefined, undefined, hexOverlay),
    climate,
    plates: topologyPlateData.map((plate) => ({
      id: plate.id,
      kind: plate.kind,
      centerX: plate.centerX,
      centerY: plate.centerY,
      motionX: plate.motionX,
      motionY: plate.motionY
    })),
    rivers,
    layers: {
      elevation: layers.elevation,
      water: layers.water,
      plates: layers.plates,
      temperature: layers.temperature,
      wetness: layers.wetness,
      climateMoisture: layers.climateMoisture,
      climatePrecipitation: layers.climatePrecipitation,
      climateWetnessDelta: layers.climateWetnessDelta,
      biomes: layers.biomes,
      ice: layers.ice,
      river: layers.river,
      lakes: layers.lakes,
      windX: layers.windX,
      windY: layers.windY,
      currentX: layers.currentX,
      currentY: layers.currentY
    }
  };
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
