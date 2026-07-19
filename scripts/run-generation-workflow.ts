import { createCoreStageRegistry, legacyWorldWorkflow, resolveWorkflow, WorkflowExecutor } from '../packages/generation-runtime/src/index';

const seed = process.argv[2] ?? '1001001';
const resolution = process.argv[3]?.split('x').map(Number);
const outputResolution = resolution?.length === 2 && resolution.every(Number.isFinite)
  ? { width: resolution[0], height: resolution[1] }
  : { width: 256, height: 128 };

const registry = createCoreStageRegistry();
const workflow = {
  ...legacyWorldWorkflow,
  stages: legacyWorldWorkflow.stages.map((stage) => ({
    ...stage,
    parameters: { seed, outputResolution }
  }))
};
const plan = resolveWorkflow(workflow, registry);
const result = await new WorkflowExecutor(registry).run(plan, { seed, runId: `smoke:${seed}` });

console.log(JSON.stringify({
  runId: result.runId,
  workflowId: result.workflowId,
  status: result.status,
  durationMs: result.durationMs,
  stages: result.stages.map((stage) => ({
    nodeId: stage.nodeId,
    stageId: stage.stageId,
    implementationId: stage.implementationId,
    status: stage.status,
    durationMs: stage.provenance?.durationMs,
    error: stage.error
  })),
  artifacts: result.artifacts.map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    version: artifact.version,
    hash: artifact.hash
  }))
}, null, 2));

if (result.status === 'failed' || result.status === 'cancelled') process.exitCode = 1;
