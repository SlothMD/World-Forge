import { describe, expect, it } from 'vitest';
import {
  BiomeRuleInput,
  HexFeatureRuleInput,
  classifyBiomeFromRules,
  classifyHexBiomeFromRules,
  classifyHexFeatureDetailsFromRules,
  classifyHexFeaturesFromRules,
  classifyHexMorphologyFromRules,
  defaultBiomeClassificationRules,
  defaultContentLibrary,
  defaultHexFeatureDetailRules,
  defaultHexTileClassificationRules,
  defaultHexTileFeatureRules,
  hexTerrainTypeNameFromRules,
  hexTileColorRampFromRules
} from './index';

describe('shared source-of-truth classification rules', () => {
  it('classifies generated biome semantics from shared rule data', () => {
    expect(defaultBiomeClassificationRules.map((rule) => rule.biome)).toContain('wetland');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ water: true }))).toBe('ocean');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ ice: true, temperatureC: -12 }))).toBe('ice_cap');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ temperatureC: -2 }))).toBe('tundra');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ elevationAboveSeaLevel: 0.7 }))).toBe('grassland');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ river: 0.8 }))).toBe('wetland');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ wetness: 0.1 }))).toBe('desert');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ wetness: 0.8, temperatureC: 24 }))).toBe('rainforest');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ wetness: 0.5, temperatureC: 14 }))).toBe('forest');
    expect(classifyBiomeFromRules(baseBiomeRuleInput({ wetness: 0.32, temperatureC: 14 }))).toBe('grassland');
  });

  it('classifies hex terrain semantics from shared rule data', () => {
    expect(classifyHexBiomeFromRules({ sourceBiome: 'ocean', water: true, lake: false, ice: false, temperatureC: 14, wetness: 0.4 })).toBe('marine');
    expect(classifyHexBiomeFromRules({ sourceBiome: 'rainforest', water: false, lake: false, ice: false, temperatureC: 23, wetness: 0.7 })).toBe('tropical');
    expect(classifyHexBiomeFromRules({ sourceBiome: 'forest', water: false, lake: false, ice: false, temperatureC: 13, wetness: 0.38 })).toBe('plains');
    expect(classifyHexMorphologyFromRules({ biome: 'marine', water: true, lake: true, depthBelowSeaLevel: 0, elevationAboveSeaLevel: -0.04, slope: 0 })).toBe('lake');
    expect(classifyHexMorphologyFromRules({ biome: 'grassland', water: false, lake: false, depthBelowSeaLevel: 0, elevationAboveSeaLevel: 0.42, slope: 0.02 })).toBe('mountainous');
    expect(classifyHexFeaturesFromRules(baseHexFeatureRuleInput({ river: 0.45, wetness: 0.7, elevationAboveSeaLevel: 0.08 }))).toEqual(expect.arrayContaining(['minor-river', 'floodplain', 'wet']));
  });

  it('classifies hex feature details and display metadata from shared rule data', () => {
    expect(defaultHexFeatureDetailRules.map((rule) => rule.detail)).toContain('volcano');
    expect(defaultHexTileFeatureRules.map((rule) => rule.feature)).toContain('navigable-river');
    expect(classifyHexFeatureDetailsFromRules(baseHexFeatureRuleInput({ river: 0.4, wetness: 0.7, elevationAboveSeaLevel: 0.08 }))).toContain('floodplain');
    expect(classifyHexFeatureDetailsFromRules(baseHexFeatureRuleInput({ biome: 'desert', river: 0.2 }))).toContain('oasis');
    expect(classifyHexFeatureDetailsFromRules(baseHexFeatureRuleInput({ morphology: 'rough', volcanism: 0.8, elevationAboveSeaLevel: 0.2 }))).toContain('volcano');
    expect(classifyHexFeatureDetailsFromRules(baseHexFeatureRuleInput({ water: true, temperatureC: -8 }))).toEqual(expect.arrayContaining(['aquatic', 'ice']));
    expect(hexTerrainTypeNameFromRules('marine', 'lake')).toBe('Lake');
    expect(hexTerrainTypeNameFromRules('desert', 'rough')).toBe('Rough Desert');
    expect(hexTileColorRampFromRules(defaultHexTileClassificationRules).desert).toBe('#e3c76b');
  });

  it('keeps the neutral PW Base ontology separate from target adapter copies', () => {
    expect(defaultContentLibrary.biomes.sets.map((set) => set.label)).toEqual(['PW Base Biomes']);
    expect(defaultContentLibrary.tiles.sets.map((set) => set.label)).toEqual(['PW Base Tiles']);
    expect(defaultContentLibrary.features.sets.map((set) => set.label)).toEqual(['PW Base Features']);
    expect(defaultContentLibrary.resources.sets.map((set) => set.label)).toEqual(['PW Base Resources']);

    const biomeMembers = new Map(defaultContentLibrary.biomes.members.map((member) => [member.id, member]));
    expect(biomeMembers.has('mountain')).toBe(false);
    for (const id of ['open-ocean', 'coastal-marine', 'freshwater-lake', 'riverine', 'temperate-rainforest', 'tropical-seasonal-forest', 'steppe', 'semi-arid-scrub', 'alpine']) {
      expect(biomeMembers.get(id)?.kind).toMatch(/biome/);
    }

    const tileMembers = new Map(defaultContentLibrary.tiles.members.map((member) => [member.id, member]));
    for (const id of ['desert-biome', 'grassland-biome', 'marine-biome', 'plains-biome', 'tropical-biome', 'tundra-biome']) {
      expect(tileMembers.get(id)?.kind).toBe('tile-biome');
    }
    for (const id of ['flat-terrain', 'rolling-terrain', 'ridge-terrain', 'plateau-terrain', 'valley-terrain', 'volcanic-highland-terrain', 'deep-ocean-terrain', 'river-channel-terrain', 'delta-terrain', 'estuary-terrain']) {
      expect(tileMembers.get(id)?.kind).toBe('terrain');
    }

    const featureMembers = new Map(defaultContentLibrary.features.members.map((member) => [member.id, member]));
    for (const id of ['vegetated-class', 'wet-class', 'aquatic-class', 'floodplain-class', 'glacial-class', 'volcanic-class', 'geologic-class', 'arid-class', 'coastal-class', 'riverine-class']) {
      expect(featureMembers.get(id)?.kind).toBe('feature-class');
    }
    for (const id of ['rainforest', 'temperate-rainforest-feature', 'mangrove', 'swamp', 'reef', 'kelp-forest', 'delta-feature', 'glacier', 'volcano', 'hot-springs', 'dune-sea']) {
      expect(featureMembers.get(id)?.kind).toBe('feature');
    }
    expect(featureMembers.get('rainforest')?.classIds).toContain('vegetated-class');
    expect(featureMembers.get('rainforest')?.compatibleWith?.biomes).toContain('tropical-rainforest');
  });
});

function baseBiomeRuleInput(overrides: Partial<BiomeRuleInput>): BiomeRuleInput {
  return {
    water: false,
    ice: false,
    temperatureC: 14,
    elevationAboveSeaLevel: 0.1,
    lake: false,
    river: 0,
    wetness: 0.38,
    polarLatitude: 0.25,
    ...overrides
  };
}

function baseHexFeatureRuleInput(overrides: Partial<HexFeatureRuleInput>): HexFeatureRuleInput {
  return {
    biome: 'grassland',
    morphology: 'flat',
    water: false,
    river: 0,
    lake: false,
    ice: false,
    wetness: 0.4,
    temperatureC: 14,
    elevationAboveSeaLevel: 0.12,
    volcanism: 0,
    ...overrides
  };
}
