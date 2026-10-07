import { createStudioWorker } from "../src/sdk/studio-queue";

const worker = createStudioWorker();

worker.on("completed", (job) => {
  console.log(`[Studio Worker] completed ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[Studio Worker] failed ${job?.id}:`, error);
});

console.log("[Studio Worker] listening on AnimationStudioEngineQueue");
