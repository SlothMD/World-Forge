import { buildCubedSphereTopology, clamp, type WorldProject } from '@world-forge/shared';
import { applyDeepTimeFoundation, type DeepTimeProgress, type DeepTimeProject } from './deepTimePipeline';

export type MutationPopulationSummary = {
  amount: number;
  operations: number;
  affectedCells: number;
  amountPerAffectedCell: number;
  amountPerOperation: number;
  operationsPerAffectedCell: number;
  affectedBaselineRelief: number;
  amountPerBaselineRelief: number;
  accumulatedOpportunity: number;
  amountPerAccumulatedOpportunity: number;
};

export type MutationProcessSummary = {
  totalAmount: number;
  operations: number;
  affectedCells: number;
  accumulatedOpportunity: number;
  amountPerOperation: number;
  amountPerAccumulatedOpportunity: number;
  craton: MutationPopulationSummary;
  nonCraton: MutationPopulationSummary;
  comparisonAvailable: boolean;
};

type DepositionCategory = 'basin' | 'river' | 'coastal' | 'shelf' | 'deepOcean';
type CategoryVolumes = Record<DepositionCategory, number>;

export type SedimentDepositionDiagnostics = {
  modelVersion: 'deep-time-sediment-budget-v2';
  erosionRemovedVolume: number;
  transportableSedimentVolume: number;
  nonTransportedVolume: number;
  depositedVolume: number;
  pendingVolume: number;
  deepOceanLossVolume: number;
  budgetError: number;
  basinAssignedVolume: number;
  riverAssignedVolume: number;
  coastalAssignedVolume: number;
  shelfAssignedVolume: number;
  deepOceanAssignedVolume: number;
  basinDepositedVolume: number;
  riverDepositedVolume: number;
  coastalDepositedVolume: number;
  shelfDepositedVolume: number;
  deepOceanDepositedVolume: number;
  depositionOperations: number;
  depositedCells: number;
};

export type DeepTimeMutationLedger = {
  modelVersion: 'deep-time-mutation-ledger-v4';
  tectonicGain: MutationProcessSummary;
  impactGain: MutationProcessSummary;
  impactLoss: MutationProcessSummary;
  weatheringLoss: MutationProcessSummary;
  glacialLoss: MutationProcessSummary;
  coastalLoss: MutationProcessSummary;
  sedimentGain: MutationProcessSummary;
  sediment: SedimentDepositionDiagnostics;
  unclassifiedElevationMutationAmount: number;
  unclassifiedElevationMutationOperations: number;
  notes: string[];
};

type ProcessKey = 'tectonicGain' | 'impactGain' | 'impactLoss' | 'weatheringLoss' | 'glacialLoss' | 'coastalLoss' | 'sedimentGain';
type Stage = 'tectonic' | 'impact' | 'weathering' | 'glacial';
type SamplePlan = { tectonicSets: number; weatheringSets: number; coastalSets: number };
type ProcessAccumulator = { amountByCell: Float64Array; operationsByCell: Uint32Array; opportunityByCell: Float64Array };
type SedimentState = {
  pendingByCell: Float64Array;
  depositedByCell: Float64Array;
  erosionRemovedVolume: number;
  transportableSedimentVolume: number;
  nonTransportedVolume: number;
  depositedVolume: number;
  deepOceanLossVolume: number;
  assignedVolume: CategoryVolumes;
  depositedVolumeByCategory: CategoryVolumes;
  depositedCells: Uint8Array;
};

function round(value: number, digits = 8): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function emptyCategoryVolumes(): CategoryVolumes {
  return { basin: 0, river: 0, coastal: 0, shelf: 0, deepOcean: 0 };
}

function buildSamplePlans(): SamplePlan[] {
  const fractions = [0.08, 0.12, 0.16, 0.2, 0.22, 0.22];
  return fractions.flatMap((_, index) => {
    const climateSamples = index < 2 ? 1 : 3;
    const plan: SamplePlan = {
      tectonicSets: index < 3 ? 3 : 2,
      weatheringSets: index < 2 ? 1 : 2,
      coastalSets: index < 4 ? 0 : 1
    };
    return Array.from({ length: climateSamples }, () => plan);
  });
}

function baselineRelief(elevation: Float32Array, resolution: number): Float32Array {
  const topology = buildCubedSphereTopology(resolution);
  const relief = new Float32Array(elevation.length);
  for (let cell = 0; cell < elevation.length; cell += 1) {
    let maximum = 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = topology.neighbors[cell * 4 + direction];
      if (neighbor >= 0) maximum = Math.max(maximum, Math.abs(elevation[cell] - elevation[neighbor]));
    }
    relief[cell] = maximum;
  }
  return relief;
}

function currentPositiveRelief(elevation: Float32Array, neighbors: Int32Array | Uint32Array, cell: number): number {
  let mean = 0;
  let count = 0;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    mean += elevation[neighbor];
    count += 1;
  }
  return count ? Math.max(0, elevation[cell] - mean / count) : 0;
}

function currentCoastalOpportunity(elevation: Float32Array, water: Uint8Array, neighbors: Int32Array | Uint32Array, cell: number): number {
  let waterNeighbors = 0;
  let mean = 0;
  let count = 0;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    waterNeighbors += water[neighbor] ? 1 : 0;
    mean += elevation[neighbor];
    count += 1;
  }
  if (!waterNeighbors || !count) return 0;
  return clamp(1 - Math.abs(elevation[cell] - mean / count) * 2.5, 0.08, 1) * waterNeighbors;
}

function emptyAccumulator(cellCount: number): ProcessAccumulator {
  return { amountByCell: new Float64Array(cellCount), operationsByCell: new Uint32Array(cellCount), opportunityByCell: new Float64Array(cellCount) };
}

function addMutation(accumulator: ProcessAccumulator, cell: number, amount: number, opportunity: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  accumulator.amountByCell[cell] += amount;
  accumulator.operationsByCell[cell] += 1;
  accumulator.opportunityByCell[cell] += Number.isFinite(opportunity) && opportunity > 0 ? opportunity : 1;
}

function populationSummary(accumulator: ProcessAccumulator, predicate: (cell: number) => boolean, relief: Float32Array): MutationPopulationSummary {
  let amount = 0;
  let operations = 0;
  let affectedCells = 0;
  let affectedBaselineRelief = 0;
  let accumulatedOpportunity = 0;
  for (let cell = 0; cell < accumulator.amountByCell.length; cell += 1) {
    if (!predicate(cell)) continue;
    const cellAmount = accumulator.amountByCell[cell];
    const cellOperations = accumulator.operationsByCell[cell];
    if (cellAmount <= 0 && cellOperations <= 0) continue;
    amount += cellAmount;
    operations += cellOperations;
    affectedCells += 1;
    affectedBaselineRelief += relief[cell];
    accumulatedOpportunity += accumulator.opportunityByCell[cell];
  }
  return {
    amount: round(amount), operations, affectedCells,
    amountPerAffectedCell: round(amount / Math.max(1, affectedCells)),
    amountPerOperation: round(amount / Math.max(1, operations)),
    operationsPerAffectedCell: round(operations / Math.max(1, affectedCells)),
    affectedBaselineRelief: round(affectedBaselineRelief),
    amountPerBaselineRelief: round(amount / Math.max(1e-9, affectedBaselineRelief)),
    accumulatedOpportunity: round(accumulatedOpportunity),
    amountPerAccumulatedOpportunity: round(amount / Math.max(1e-9, accumulatedOpportunity))
  };
}

function processSummary(accumulator: ProcessAccumulator, plates: Uint16Array | Uint32Array | Int32Array, cratons: Set<number>, relief: Float32Array): MutationProcessSummary {
  const craton = populationSummary(accumulator, (cell) => cratons.has(plates[cell]), relief);
  const nonCraton = populationSummary(accumulator, (cell) => !cratons.has(plates[cell]), relief);
  const totalAmount = craton.amount + nonCraton.amount;
  const operations = craton.operations + nonCraton.operations;
  const accumulatedOpportunity = craton.accumulatedOpportunity + nonCraton.accumulatedOpportunity;
  return {
    totalAmount: round(totalAmount), operations, affectedCells: craton.affectedCells + nonCraton.affectedCells,
    accumulatedOpportunity: round(accumulatedOpportunity),
    amountPerOperation: round(totalAmount / Math.max(1, operations)),
    amountPerAccumulatedOpportunity: round(totalAmount / Math.max(1e-9, accumulatedOpportunity)),
    craton, nonCraton,
    comparisonAvailable: craton.affectedCells > 0 && nonCraton.affectedCells > 0 && craton.accumulatedOpportunity > 1e-9 && nonCraton.accumulatedOpportunity > 1e-9
  };
}

function neighborCounts(cell: number, water: Uint8Array, neighbors: Int32Array | Uint32Array): { waterNeighbors: number; landNeighbors: number } {
  let waterNeighbors = 0;
  let landNeighbors = 0;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor < 0) continue;
    if (water[neighbor]) waterNeighbors += 1;
    else landNeighbors += 1;
  }
  return { waterNeighbors, landNeighbors };
}

function routeSediment(sourceCell: number, elevation: Float32Array, water: Uint8Array, river: Float32Array, neighbors: Int32Array | Uint32Array, seaLevel: number): { cell: number; category: DepositionCategory; retainedFraction: number } {
  let cell = sourceCell;
  const visited = new Set<number>();
  for (let step = 0; step < 16; step += 1) {
    if (visited.has(cell)) break;
    visited.add(cell);
    const altitude = elevation[cell] - seaLevel;
    const counts = neighborCounts(cell, water, neighbors);
    if (water[cell] || altitude <= 0) {
      const depth = Math.max(0, -altitude);
      if (depth <= 0.1 && counts.landNeighbors > 0) return { cell, category: 'shelf', retainedFraction: 0.82 };
      return { cell, category: 'deepOcean', retainedFraction: 0.12 };
    }
    if (river[cell] > 0.3 && altitude <= 0.12) return { cell, category: 'river', retainedFraction: 0.96 };
    if (counts.waterNeighbors >= 3 && altitude <= 0.018) return { cell, category: 'coastal', retainedFraction: 0.72 };
    let next = -1;
    let nextElevation = elevation[cell];
    for (let direction = 0; direction < 4; direction += 1) {
      const neighbor = neighbors[cell * 4 + direction];
      if (neighbor < 0 || visited.has(neighbor)) continue;
      if (elevation[neighbor] < nextElevation - 0.00001) {
        nextElevation = elevation[neighbor];
        next = neighbor;
      }
    }
    if (next < 0) return { cell, category: 'basin', retainedFraction: 0.97 };
    cell = next;
  }
  return { cell, category: 'basin', retainedFraction: 0.92 };
}

function totalDepositionCapacity(category: DepositionCategory, cell: number, elevation: Float32Array, neighbors: Int32Array | Uint32Array, seaLevel: number): number {
  if (category === 'deepOcean') return 0.0008;
  if (category === 'shelf') return Math.max(0.0001, Math.min(0.002, seaLevel - 0.004 - elevation[cell]));
  if (category === 'coastal') return Math.max(0, Math.min(0.001, seaLevel + 0.012 - elevation[cell]));
  if (category === 'river') return 0.007;
  let lowestNeighbor = Number.POSITIVE_INFINITY;
  for (let direction = 0; direction < 4; direction += 1) {
    const neighbor = neighbors[cell * 4 + direction];
    if (neighbor >= 0) lowestNeighbor = Math.min(lowestNeighbor, elevation[neighbor]);
  }
  const fillToSpill = Number.isFinite(lowestNeighbor) ? Math.max(0.0003, (lowestNeighbor - elevation[cell]) * 0.7) : 0.003;
  return Math.min(0.012, fillToSpill);
}

export function applyDeepTimeFoundationWithMutationLedger(project: WorldProject, onProgress?: (progress: DeepTimeProgress) => void): DeepTimeProject {
  const world = project.primaryWorld;
  const topology = buildCubedSphereTopology(world.topology.resolution);
  const originalElevation = world.topologyLayers.elevation;
  const water = world.topologyLayers.water;
  const river = world.topologyLayers.river;
  const preAgingElevation = new Float32Array(originalElevation);
  const relief = baselineRelief(preAgingElevation, world.topology.resolution);
  const plans = buildSamplePlans();
  const accumulators: Record<ProcessKey, ProcessAccumulator> = {
    tectonicGain: emptyAccumulator(originalElevation.length), impactGain: emptyAccumulator(originalElevation.length), impactLoss: emptyAccumulator(originalElevation.length),
    weatheringLoss: emptyAccumulator(originalElevation.length), glacialLoss: emptyAccumulator(originalElevation.length), coastalLoss: emptyAccumulator(originalElevation.length), sedimentGain: emptyAccumulator(originalElevation.length)
  };
  const sediment: SedimentState = {
    pendingByCell: new Float64Array(originalElevation.length), depositedByCell: new Float64Array(originalElevation.length),
    erosionRemovedVolume: 0, transportableSedimentVolume: 0, nonTransportedVolume: 0, depositedVolume: 0, deepOceanLossVolume: 0,
    assignedVolume: emptyCategoryVolumes(), depositedVolumeByCategory: emptyCategoryVolumes(), depositedCells: new Uint8Array(originalElevation.length)
  };
  let unclassifiedAmount = 0;
  let unclassifiedOperations = 0;
  let sampleIndex = 0;
  let stage: Stage = 'tectonic';
  let tectonicSetsRemaining = plans[0]?.tectonicSets ?? 0;
  let weatheringSetsRemaining = plans[0]?.weatheringSets ?? 0;

  const queueSediment = (sourceCell: number, removed: number, transportFraction: number): void => {
    sediment.erosionRemovedVolume += removed;
    const transportable = removed * transportFraction;
    sediment.transportableSedimentVolume += transportable;
    sediment.nonTransportedVolume += removed - transportable;
    const destination = routeSediment(sourceCell, originalElevation, water, river, topology.neighbors, world.seaLevel);
    const retained = transportable * destination.retainedFraction;
    sediment.pendingByCell[destination.cell] += retained;
    sediment.deepOceanLossVolume += transportable - retained;
    sediment.assignedVolume[destination.category] += retained;
  };

  const applyPendingSediment = (adjusted: Float32Array, offset: number, limit: number): void => {
    const nextPending = new Float64Array(sediment.pendingByCell.length);
    const remainingCapacity = new Float64Array(sediment.pendingByCell.length);
    for (let source = 0; source < sediment.pendingByCell.length; source += 1) {
      const pending = sediment.pendingByCell[source];
      if (pending <= 1e-12) continue;
      const destination = routeSediment(source, originalElevation, water, river, topology.neighbors, world.seaLevel);
      const cell = destination.cell;
      if (remainingCapacity[cell] === 0) {
        remainingCapacity[cell] = Math.max(0, totalDepositionCapacity(destination.category, cell, originalElevation, topology.neighbors, world.seaLevel) - sediment.depositedByCell[cell]);
      }
      const deposited = Math.min(pending, remainingCapacity[cell]);
      if (deposited > 1e-12 && cell >= offset && cell < offset + limit) {
        adjusted[cell - offset] += deposited;
        remainingCapacity[cell] -= deposited;
        sediment.depositedByCell[cell] += deposited;
        sediment.depositedVolume += deposited;
        sediment.depositedVolumeByCategory[destination.category] += deposited;
        sediment.depositedCells[cell] = 1;
        addMutation(accumulators.sedimentGain, cell, deposited, pending);
      }
      const unresolved = pending - deposited;
      if (unresolved > 1e-12) nextPending[cell] += unresolved;
    }
    sediment.pendingByCell = nextPending;
  };

  const beginSample = (index: number): void => {
    sampleIndex = index; stage = 'tectonic'; tectonicSetsRemaining = plans[index]?.tectonicSets ?? 0; weatheringSetsRemaining = plans[index]?.weatheringSets ?? 0;
  };
  const advanceSample = (): void => { if (sampleIndex + 1 < plans.length) beginSample(sampleIndex + 1); };
  const classifySet = (): 'tectonic' | 'weathering' | 'coastal' | 'unclassified' => {
    const plan = plans[sampleIndex];
    if (!plan) return 'unclassified';
    if (stage === 'tectonic') { tectonicSetsRemaining -= 1; if (tectonicSetsRemaining <= 0) stage = 'impact'; return 'tectonic'; }
    if (stage === 'impact') { stage = 'weathering'; weatheringSetsRemaining -= 1; if (weatheringSetsRemaining <= 0) stage = 'glacial'; return 'weathering'; }
    if (stage === 'weathering') { weatheringSetsRemaining -= 1; if (weatheringSetsRemaining <= 0) stage = 'glacial'; return 'weathering'; }
    if (stage === 'glacial' && plan.coastalSets > 0) { advanceSample(); return 'coastal'; }
    if (stage === 'glacial' && plan.coastalSets === 0 && sampleIndex + 1 < plans.length) { advanceSample(); return classifySet(); }
    return 'unclassified';
  };

  const proxy = new Proxy(originalElevation, {
    get(target, property) {
      if (property === 'set') {
        return (source: ArrayLike<number>, offset = 0): void => {
          const classification = classifySet();
          const limit = Math.min(source.length, target.length - offset);
          const adjusted = new Float32Array(limit);
          for (let index = 0; index < limit; index += 1) adjusted[index] = Number(source[index]);
          for (let index = 0; index < limit; index += 1) {
            const cell = index + offset;
            const delta = adjusted[index] - target[cell];
            if (Math.abs(delta) <= 1e-12) continue;
            if (classification === 'tectonic' && delta > 0) addMutation(accumulators.tectonicGain, cell, delta, 1);
            else if (classification === 'weathering' && delta < 0) { addMutation(accumulators.weatheringLoss, cell, -delta, currentPositiveRelief(target, topology.neighbors, cell)); queueSediment(cell, -delta, 0.78); }
            else if (classification === 'coastal' && delta < 0) { addMutation(accumulators.coastalLoss, cell, -delta, currentCoastalOpportunity(target, water, topology.neighbors, cell)); queueSediment(cell, -delta, 0.88); }
            else { unclassifiedAmount += Math.abs(delta); unclassifiedOperations += 1; }
          }
          applyPendingSediment(adjusted, offset, limit);
          Float32Array.prototype.set.call(target, adjusted, offset);
        };
      }
      if (property === Symbol.iterator) return target[Symbol.iterator].bind(target);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        const cell = Number(property);
        const before = target[cell];
        const after = Number(value);
        const delta = after - before;
        if (Math.abs(delta) > 1e-12) {
          if (stage === 'impact') { if (delta > 0) addMutation(accumulators.impactGain, cell, delta, 1); else addMutation(accumulators.impactLoss, cell, -delta, 1); }
          else if (stage === 'glacial' && delta < 0) { addMutation(accumulators.glacialLoss, cell, -delta, Math.max(0, before - world.seaLevel)); queueSediment(cell, -delta, 0.84); }
          else { unclassifiedAmount += Math.abs(delta); unclassifiedOperations += 1; }
        }
        target[cell] = after;
        return true;
      }
      return Reflect.set(target, property, value, target);
    }
  });

  world.topologyLayers.elevation = proxy as Float32Array;
  let result: DeepTimeProject;
  try { result = applyDeepTimeFoundation(project, onProgress); }
  finally { world.topologyLayers.elevation = originalElevation; }

  let pendingVolume = 0;
  for (let cell = 0; cell < sediment.pendingByCell.length; cell += 1) pendingVolume += sediment.pendingByCell[cell];
  sediment.deepOceanLossVolume += pendingVolume;
  pendingVolume = 0;
  const accounted = sediment.nonTransportedVolume + sediment.depositedVolume + sediment.deepOceanLossVolume;
  const sedimentDiagnostics: SedimentDepositionDiagnostics = {
    modelVersion: 'deep-time-sediment-budget-v2',
    erosionRemovedVolume: round(sediment.erosionRemovedVolume), transportableSedimentVolume: round(sediment.transportableSedimentVolume),
    nonTransportedVolume: round(sediment.nonTransportedVolume), depositedVolume: round(sediment.depositedVolume), pendingVolume,
    deepOceanLossVolume: round(sediment.deepOceanLossVolume), budgetError: round(sediment.erosionRemovedVolume - accounted),
    basinAssignedVolume: round(sediment.assignedVolume.basin), riverAssignedVolume: round(sediment.assignedVolume.river), coastalAssignedVolume: round(sediment.assignedVolume.coastal), shelfAssignedVolume: round(sediment.assignedVolume.shelf), deepOceanAssignedVolume: round(sediment.assignedVolume.deepOcean),
    basinDepositedVolume: round(sediment.depositedVolumeByCategory.basin), riverDepositedVolume: round(sediment.depositedVolumeByCategory.river), coastalDepositedVolume: round(sediment.depositedVolumeByCategory.coastal), shelfDepositedVolume: round(sediment.depositedVolumeByCategory.shelf), deepOceanDepositedVolume: round(sediment.depositedVolumeByCategory.deepOcean),
    depositionOperations: accumulators.sedimentGain.operationsByCell.reduce((sum, value) => sum + value, 0),
    depositedCells: sediment.depositedCells.reduce((sum, value) => sum + value, 0)
  };

  const cratonPlateIds = new Set(result.primaryWorld.deepTime.cratons.map((craton) => craton.plateId));
  const plates = result.primaryWorld.topologyLayers.plates;
  const ledger: DeepTimeMutationLedger = {
    modelVersion: 'deep-time-mutation-ledger-v4',
    tectonicGain: processSummary(accumulators.tectonicGain, plates, cratonPlateIds, relief), impactGain: processSummary(accumulators.impactGain, plates, cratonPlateIds, relief), impactLoss: processSummary(accumulators.impactLoss, plates, cratonPlateIds, relief),
    weatheringLoss: processSummary(accumulators.weatheringLoss, plates, cratonPlateIds, relief), glacialLoss: processSummary(accumulators.glacialLoss, plates, cratonPlateIds, relief), coastalLoss: processSummary(accumulators.coastalLoss, plates, cratonPlateIds, relief), sedimentGain: processSummary(accumulators.sedimentGain, plates, cratonPlateIds, relief),
    sediment: sedimentDiagnostics,
    unclassifiedElevationMutationAmount: round(unclassifiedAmount), unclassifiedElevationMutationOperations: unclassifiedOperations,
    notes: [
      'Elevation mutations are captured from the actual topology array writes performed by deep-time aging.',
      'Sediment is carried between aging samples, rerouted to the actual destination cell, and constrained by cumulative per-cell deposition capacity.',
      'Near-sea coastal deposition is capped tightly, shelf deposition remains below sea level, and inland basin and river capacity receive priority.',
      'Assigned sink volume and actual deposited sink volume are reported separately; unresolved end-of-run sediment is exported to the deep-ocean loss budget.'
    ]
  };
  const extended = result.primaryWorld.deepTime as typeof result.primaryWorld.deepTime & { mutationLedger?: DeepTimeMutationLedger };
  extended.mutationLedger = ledger;
  result.primaryWorld.deepTime.notes.push('Exact mutation totals and sediment budget v2 are retained in deepTime.mutationLedger.');
  return result;
}
