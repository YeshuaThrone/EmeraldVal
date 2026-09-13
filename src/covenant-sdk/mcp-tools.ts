import { CovenantMasterEngineFacade } from "./facade";
import { CovenantMcpRegistry } from "./mcp-registry";
import {
  ASSET_CATEGORIES,
  isSplitPartyRole,
  type AssetCategory,
  type SplitParty,
  type UniversalWorkManifest,
} from "./types";
import { UNIVERSAL_20_IDENTIFIER_KEYS } from "./identifiers";
import type { Universal20Identifiers } from "./types";

export const COVENANT_MCP_TOOLS = [
  {
    name: "register_work_manifest",
    description:
      "Register a sandbox work manifest (replaces Prisma workManifest). Required before a sweep can match.",
    inputSchema: {
      type: "object",
      properties: {
        manifest: { type: "object", description: "UniversalWorkManifest JSON" },
      },
      required: ["manifest"],
    },
  },
  {
    name: "trigger_blackbox_sweep",
    description:
      "Run the universal cross-channel black box sweeper engine against raw CWR or DSR feeds.",
    inputSchema: {
      type: "object",
      properties: {
        cwrRawFeed: { type: "string", description: "Raw CWR file string" },
        dsrRawFeed: { type: "string", description: "Raw DDEX DSR file string" },
      },
    },
  },
  {
    name: "query_audit_proof",
    description:
      "Retrieve an immutable audit proof package by work ID or proof signature.",
    inputSchema: {
      type: "object",
      properties: {
        matchedWorkId: {
          type: "string",
          description: "The registered Work ID",
        },
      },
      required: ["matchedWorkId"],
    },
  },
  {
    name: "get_channel_unclaimed_metrics",
    description:
      "Fetch breakdown of unmatched funds sitting across all 6 royalty channels.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
] as const;

export type CovenantMcpToolName = (typeof COVENANT_MCP_TOOLS)[number]["name"];

export type CovenantMcpToolResult = {
  isError: boolean;
  payload: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseIdentifiers(value: unknown): Universal20Identifiers {
  const record = asRecord(value) ?? {};
  const identifiers: Universal20Identifiers = {};
  for (const key of UNIVERSAL_20_IDENTIFIER_KEYS) {
    const item = record[key];
    if (typeof item === "string" && item.trim() !== "") {
      identifiers[key] = item;
    }
  }
  return identifiers;
}

function parseSplits(value: unknown): SplitParty[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const splits: SplitParty[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row) {
      return undefined;
    }
    const partyId = asString(row.partyId);
    const name = asString(row.name) ?? asString(row.partyName);
    const roleRaw = asString(row.role);
    const payoutWalletOrBank =
      asString(row.payoutWalletOrBank) ?? asString(row.payoutWalletOrAccount);
    if (!partyId || !name || !roleRaw || !isSplitPartyRole(roleRaw) || !payoutWalletOrBank) {
      return undefined;
    }
    const shareBps = row.shareBps;
    const sharePercentage = row.sharePercentage;
    splits.push({
      partyId,
      name,
      role: roleRaw,
      payoutWalletOrBank,
      ipi: asString(row.ipi) ?? asString(row.ipiNumber),
      isni: asString(row.isni),
      ...(typeof shareBps === "number" ? { shareBps } : {}),
      ...(typeof sharePercentage === "number" ? { sharePercentage } : {}),
    });
  }
  return splits;
}

function isAssetCategory(value: string): value is AssetCategory {
  return (ASSET_CATEGORIES as readonly string[]).includes(value);
}

function parseManifest(value: unknown): UniversalWorkManifest | undefined {
  const row = asRecord(value);
  if (!row) {
    return undefined;
  }
  const workId = asString(row.workId);
  const title = asString(row.title);
  const splits = parseSplits(row.splits);
  if (!workId || !title || !splits) {
    return undefined;
  }
  const categoryRaw = asString(row.category) ?? "AUDIO";
  if (!isAssetCategory(categoryRaw)) {
    return undefined;
  }
  const territories = Array.isArray(row.registeredTerritories)
    ? row.registeredTerritories.filter((item): item is string => typeof item === "string")
    : undefined;
  return {
    workId,
    title,
    category: categoryRaw,
    identifiers: parseIdentifiers(row.identifiers),
    splits,
    mulCertificateId: asString(row.mulCertificateId) ?? `mul_${workId}`,
    metadataHash: asString(row.metadataHash) ?? `hash_${workId}`,
    primaryMediaUrl: asString(row.primaryMediaUrl),
    registeredTerritories: territories,
  };
}

export class CovenantMcpToolHost {
  constructor(
    private readonly registry: CovenantMcpRegistry,
    private readonly engine: CovenantMasterEngineFacade,
  ) {}

  public listTools(): typeof COVENANT_MCP_TOOLS {
    return COVENANT_MCP_TOOLS;
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<CovenantMcpToolResult> {
    if (name === "register_work_manifest") {
      const manifest = parseManifest(args?.manifest);
      if (!manifest) {
        return {
          isError: true,
          payload: {
            ok: false,
            code: "invalid_manifest",
            message: "manifest must be a UniversalWorkManifest object.",
          },
        };
      }
      this.registry.registerWork(manifest);
      return {
        isError: false,
        payload: { ok: true, workId: manifest.workId },
      };
    }

    if (name === "trigger_blackbox_sweep") {
      const cwrRawFeed = asString(args?.cwrRawFeed) ?? "";
      const dsrRawFeed = asString(args?.dsrRawFeed) ?? "";
      const results = await this.engine.executeSystemSweep(
        cwrRawFeed,
        dsrRawFeed,
        this.registry.listWorks(),
      );
      this.registry.recordSweep(results);
      return {
        isError: false,
        payload: {
          ok: true,
          status: "SUCCESS",
          recoveredRevenueCents:
            results.sweeperSummary.totalRecoveredRevenueCents,
          matchesFound: results.sweeperSummary.matches.length,
          disputes: results.disputesEncountered.length,
          channelBreakdownCents: results.sweeperSummary.channelBreakdownCents,
        },
      };
    }

    if (name === "query_audit_proof") {
      const workId = asString(args?.matchedWorkId);
      if (!workId) {
        return {
          isError: true,
          payload: {
            ok: false,
            code: "invalid_work_id",
            message: "matchedWorkId is required.",
          },
        };
      }
      return {
        isError: false,
        payload: { ok: true, proofs: this.registry.proofsForWork(workId) },
      };
    }

    if (name === "get_channel_unclaimed_metrics") {
      return {
        isError: false,
        payload: { ok: true, metrics: this.registry.channelMetrics() },
      };
    }

    return {
      isError: true,
      payload: {
        ok: false,
        code: "unknown_tool",
        message: `Unknown tool: ${name}`,
      },
    };
  }
}
