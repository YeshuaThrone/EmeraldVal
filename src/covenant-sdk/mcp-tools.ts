import { CovenantMasterEngineFacade } from "./facade";
import { CovenantMcpRegistry } from "./mcp-registry";
import { parseWorkRegistration } from "./manifest-parse";

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

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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
      const parsed = parseWorkRegistration(
        args?.manifest,
        this.registry.occupiedWorkIds(),
      );
      if (!parsed.ok) {
        return {
          isError: true,
          payload: {
            ok: false,
            code: parsed.code,
            message: parsed.message,
          },
        };
      }
      this.registry.registerWork(parsed.manifest);
      return {
        isError: false,
        payload: { ok: true, workId: parsed.manifest.workId },
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
