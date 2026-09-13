import type { ImmutableAuditProofPackage } from "./audit-proof";
import type { UniversalWorkManifest } from "./types";
import type { SystemSweepResult } from "./facade";
import type { MatchingResult, RoyaltyChannelSource } from "./universal-blackbox-sweeper";
import { ROYALTY_CHANNEL_SOURCES } from "./universal-blackbox-sweeper";

export type ChannelUnclaimedMetric = {
  sourceChannel: RoyaltyChannelSource;
  recoveredAmountCents: number;
  matchCount: number;
};

/**
 * Sandbox stand-in for Prisma workManifest / auditProof / matchingRecord.
 * Process-local only. No live database.
 */
export class CovenantMcpRegistry {
  private readonly works = new Map<string, UniversalWorkManifest>();
  private readonly proofs: ImmutableAuditProofPackage[] = [];
  private readonly matches: MatchingResult[] = [];

  public getWork(workId: string): UniversalWorkManifest | undefined {
    return this.works.get(workId);
  }

  public hasWork(workId: string): boolean {
    return this.works.has(workId);
  }

  public occupiedWorkIds(): Set<string> {
    return new Set(this.works.keys());
  }

  public registerWork(manifest: UniversalWorkManifest): void {
    this.works.set(manifest.workId, manifest);
  }

  public listWorks(): UniversalWorkManifest[] {
    return [...this.works.values()];
  }

  public proofsForWork(matchedWorkId: string): ImmutableAuditProofPackage[] {
    return this.proofs.filter((proof) => proof.matchedWorkId === matchedWorkId);
  }

  public recordSweep(result: SystemSweepResult): void {
    this.matches.push(...result.sweeperSummary.matches);
    this.proofs.push(...result.auditProofs);
  }

  public channelMetrics(): ChannelUnclaimedMetric[] {
    const byChannel = new Map<RoyaltyChannelSource, ChannelUnclaimedMetric>();
    for (const channel of ROYALTY_CHANNEL_SOURCES) {
      byChannel.set(channel, {
        sourceChannel: channel,
        recoveredAmountCents: 0,
        matchCount: 0,
      });
    }
    for (const match of this.matches) {
      const row = byChannel.get(match.sourceChannel);
      if (!row) {
        continue;
      }
      row.recoveredAmountCents += match.recoveredAmountCents;
      row.matchCount += 1;
    }
    return [...byChannel.values()];
  }
}
