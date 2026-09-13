import { describe, expect, it } from "vitest";
import { CovenantMasterEngineFacade } from "@/covenant-sdk/facade";
import { CovenantMcpRegistry } from "@/covenant-sdk/mcp-registry";
import type { UniversalWorkManifest } from "@/covenant-sdk/types";
import { processSweepJob, SandboxSweepQueue } from "./sweepQueue";

const FIXED_NOW = new Date("2026-09-13T12:00:00.000Z");

const work: UniversalWorkManifest = {
  workId: "work_audio_1",
  title: "Sandbox Track",
  category: "AUDIO",
  identifiers: { isrc: "USAAA0000001" },
  splits: [
    {
      partyId: "writer-1",
      name: "Ada Writer",
      role: "COMPOSER",
      sharePercentage: 70,
      payoutWalletOrBank: "acct_writer",
    },
    {
      partyId: "pub-1",
      name: "Pub",
      role: "PUBLISHER",
      sharePercentage: 30,
      payoutWalletOrBank: "acct_pub",
    },
  ],
  mulCertificateId: "mul_1",
  metadataHash: "hash_1",
};

const dsr = [
  [
    "SU02",
    "",
    "",
    "Sandbox Track",
    "USAAA0000001",
    "",
    "",
    "",
    "US",
    "USD",
    "10.00",
    "",
    "UNMATCHED_HOLD",
  ].join("\t"),
].join("\n");

describe("processSweepJob", () => {
  it("sweeps DSR holds and upserts matches into the sandbox registry", async () => {
    const registry = new CovenantMcpRegistry();
    registry.registerWork(work);
    const result = await processSweepJob(
      { jobId: "job_1", dsrRawFeed: dsr },
      {
        registry,
        engine: new CovenantMasterEngineFacade({ clock: () => FIXED_NOW }),
        attempts: 1,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected sweep");
    }
    expect(result.recoveredRevenueCents).toBe(1_000);
    expect(result.matchesFound).toBe(1);
    expect(registry.listMatches()).toHaveLength(1);
    expect(registry.listPayouts().length).toBeGreaterThan(0);
    expect(registry.listClearances()).toHaveLength(1);
    expect(registry.proofsForWork("work_audio_1")).toHaveLength(1);

    const again = await processSweepJob(
      { jobId: "job_1", dsrRawFeed: dsr },
      {
        registry,
        engine: new CovenantMasterEngineFacade({ clock: () => FIXED_NOW }),
        attempts: 1,
      },
    );
    expect(again.ok).toBe(true);
    expect(registry.listMatches()).toHaveLength(1);
  });
});

describe("SandboxSweepQueue", () => {
  it("drains queued jobs without Redis", async () => {
    const registry = new CovenantMcpRegistry();
    registry.registerWork(work);
    const queue = new SandboxSweepQueue();
    const added = await queue.add("blackbox-sweeps", {
      jobId: "job_q",
      dsrRawFeed: dsr,
    });
    expect(added.id).toBe("job_q");
    const drained = await queue.drain({
      registry,
      engine: new CovenantMasterEngineFacade({ clock: () => FIXED_NOW }),
      attempts: 1,
    });
    expect(drained[0]?.ok).toBe(true);
  });
});
