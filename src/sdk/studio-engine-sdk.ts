/**
 * WURFI Animation Studio Engine SDK
 * Staff-gated worker pipeline, audio alignment, FFmpeg stitching (spawn argv).
 * Does not mount on the public WURFI broadcast server.
 */
export {
  applyLipSync,
  buildStudioConcatArgs,
  buildStudioHlsArgs,
  compileAndPackageEpisode,
  generateSceneMotion,
  packageEpisodeHls,
  parseAudioPhonemes,
  parseMasterAudioTrack,
  type JobProgressPayload,
  type PipelineStage,
  type PipelineState,
  type ShotCard,
  type StudioRenderJobData,
  type WordTimestamp,
} from "./studio-engine";

export {
  authorizeStaffAccess,
  studioStaffAllowlist,
  STUDIO_OWNER_EMAIL,
  type StaffSession,
} from "./studio-staff";

export {
  createStudioWorker,
  enqueueStudioPipeline,
  enqueueStudioPipelineJob,
  getStudioQueue,
  processStudioRenderJob,
  studioRedisConnection,
  STUDIO_RENDER_JOB_NAME,
  STUDIO_RENDER_QUEUE,
} from "./studio-queue";

export {
  encodeStudioProgressEvent,
  isTerminalPipelineStage,
  readStudioJobProgress,
  streamStudioJobEvents,
  toJobProgressPayload,
} from "./studio-progress";
