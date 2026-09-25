import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { CovenantMcpRegistry } from "@/covenant-sdk/mcp-registry";
import { CovenantMasterEngineFacade } from "@/covenant-sdk/facade";
import { MCP_HTTP_BINDINGS, COVENANT_MCP_HTTP, DON_MCP_HTTP } from "./catalog";
import { DON_MCP_TOOLS } from "./don-tools";
import { COVENANT_MCP_TOOLS } from "@/covenant-sdk/mcp-tools";
import { EmeraldValMcpToolHost } from "./host";

const SPLIT_BODY = {
  source: "spotify",
  period: "2026-08",
  line_items: [
    {
      work_id: "trk_01",
      work_title: "Midnight On 6th",
      amount_cents: 10_000,
      splits: [
        {
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          role: "creator",
          share_percent: 70,
        },
        {
          payee_id: "l1",
          payee_name: "Throne Records",
          role: "label",
          share_percent: 30,
        },
      ],
    },
  ],
};

const WORK = {
  workId: "WORK_CHAMPION_001",
  title: "STATE OF THE ART",
  identifiers: { isrc: "USXX12600001", iswc: "T1234567890" },
  splits: [
    {
      partyId: "WRITER_01",
      name: "Yeshua Throne",
      role: "COMPOSER",
      sharePercentage: 50,
      payoutWalletOrBank: "acct_writer",
    },
    {
      partyId: "PUBLISHER_01",
      name: "Covenant Publishing",
      role: "PUBLISHER",
      sharePercentage: 50,
      payoutWalletOrBank: "acct_pub",
    },
  ],
};

const DSR = [
  "AS01\tBLOCK_01\tSTATE OF THE ART\tSTATE OF THE ART\tUSXX12600001\tT1234567890",
  "SU02\tBLOCK_01\t\t\t\t\t\t\tUS\tUSD\t10.00\t\tUNMATCHED_HOLD",
].join("\n");

function host() {
  return new EmeraldValMcpToolHost({
    store: new SqliteStore(":memory:"),
    registry: new CovenantMcpRegistry(),
    engine: new CovenantMasterEngineFacade({
      clock: () => new Date("2026-09-25T00:00:00.000Z"),
    }),
  });
}

describe("MCP catalog covers every /api/v1 route", () => {
  it("binds one MCP tool to each Don Engine and Covenant HTTP method", () => {
    const keys = MCP_HTTP_BINDINGS.map((row) => `${row.method} ${row.path}`).sort();
    expect(keys).toEqual(
      [
        "POST /api/v1/auth/plaid-kyc",
        "POST /api/v1/auth/plaid-exchange",
        "POST /api/v1/splits/calculate",
        "POST /api/v1/splits/recoupment",
        "GET /api/v1/splits/recoupment",
        "POST /api/v1/splits/reverse",
        "POST /api/v1/webhooks",
        "POST /api/v1/webhooks/baas",
        "POST /api/v1/webhooks/dsp",
        "GET /api/v1/vaults",
        "POST /api/v1/vaults",
        "POST /api/v1/vaults/payout",
        "POST /api/v1/vaults/dispute/lock",
        "GET /api/v1/ledger",
        "GET /api/v1/ledger/audit",
        "POST /api/v1/baas/ach",
        "POST /api/v1/baas/rtp",
        "POST /api/v1/compliance/withholding",
        "GET /api/v1/compliance/withholding",
        "POST /api/v1/works",
        "GET /api/v1/works",
        "POST /api/v1/sweeper",
        "POST /api/v1/sweeper/async",
        "POST /api/v1/sweeper/luminate",
      ].sort(),
    );
    expect(DON_MCP_TOOLS).toHaveLength(DON_MCP_HTTP.length);
    expect(
      COVENANT_MCP_TOOLS.filter((tool) =>
        [
          "register_work_manifest",
          "list_work_manifests",
          "trigger_blackbox_sweep",
          "trigger_blackbox_sweep_async",
          "trigger_luminate_sweep",
        ].includes(tool.name),
      ),
    ).toHaveLength(COVENANT_MCP_HTTP.length);
  });
});

describe("EmeraldValMcpToolHost", () => {
  it("lists every Don Engine and Covenant tool", () => {
    const listed = host().listTools().map((tool) => tool.name);
    expect(listed).toEqual([
      ...DON_MCP_TOOLS.map((tool) => tool.name),
      ...COVENANT_MCP_TOOLS.map((tool) => tool.name),
    ]);
  });

  it("rejects an unknown tool", async () => {
    const result = await host().callTool("not_a_tool", {});
    expect(result.isError).toBe(true);
    expect(result.payload).toEqual({
      ok: false,
      code: "unknown_tool",
      message: "Unknown tool: not_a_tool",
    });
  });

  it("covers Don Engine tax, split, vault, BaaS, webhook, and ledger tools", async () => {
    const mcp = host();

    const kyc = await mcp.callTool("plaid_kyc", {
      action: "create_link_token",
      creator_id: "c1",
    });
    expect(kyc.isError).toBe(false);
    const session = kyc.payload as { public_token: string };
    expect(session.public_token).toMatch(/^public-sandbox-/);

    const exchanged = await mcp.callTool("plaid_exchange", {
      creator_id: "c1",
      public_token: session.public_token,
    });
    expect(exchanged.isError).toBe(false);

    const tax = await mcp.callTool("withholding_apply", {
      creator_id: "c1",
      gross_cents: 10_000,
      tax_year: 2026,
    });
    expect(tax.isError).toBe(false);
    expect(tax.payload).toEqual(
      expect.objectContaining({
        withheld_cents: 2_400,
        net_cents: 7_600,
        requires_1099: false,
      }),
    );

    const ytd = await mcp.callTool("withholding_get", {
      creator_id: "c1",
      tax_year: 2026,
    });
    expect(ytd.isError).toBe(false);
    expect(ytd.payload).toEqual(
      expect.objectContaining({ ytd_gross_cents: 10_000, ytd_withheld_cents: 2_400 }),
    );

    const advance = await mcp.callTool("recoupment_upsert", {
      creator_id: "c1",
      recoupment_target_cents: 5_000,
    });
    expect(advance.isError).toBe(false);
    const snapshot = await mcp.callTool("recoupment_get", { creator_id: "c1" });
    expect(snapshot.payload).toEqual(
      expect.objectContaining({ recoupment_target_cents: 5_000, active: true }),
    );

    const split = await mcp.callTool("splits_calculate", SPLIT_BODY);
    expect(split.isError).toBe(false);
    const splitPayload = split.payload as {
      split_run: { id: string; gross_cents: number };
    };
    expect(splitPayload.split_run.gross_cents).toBe(10_000);

    const vaults = await mcp.callTool("vaults_list", {});
    expect(vaults.isError).toBe(false);
    const listed = vaults.payload as { vaults: { payee_id: string }[] };
    expect(listed.vaults.some((row) => row.payee_id === "c1")).toBe(true);

    const oneVault = await mcp.callTool("vaults_list", { payee_id: "c1" });
    expect(oneVault.isError).toBe(false);

    const missingVault = await mcp.callTool("vaults_list", {
      payee_id: "nobody",
    });
    expect(missingVault).toEqual({
      isError: true,
      payload: {
        ok: false,
        code: "vault_not_found",
        message: "No sovereign vault exists for that payee.",
      },
    });

    const released = await mcp.callTool("vaults_release", {
      action: "release",
      payee_id: "l1",
    });
    expect(released.isError).toBe(false);

    const payout = await mcp.callTool("vaults_payout", {
      payee_id: "l1",
      amount_cents: 100,
      rail: "rtp",
    });
    expect(payout.isError).toBe(false);
    const payoutTransfer = (payout.payload as { transfer: { id: string } })
      .transfer;

    const lock = await mcp.callTool("vaults_dispute_lock", {
      payee_id: "c1",
      locked: true,
    });
    expect(lock.isError).toBe(false);

    const ach = await mcp.callTool("baas_ach", {
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 250,
    });
    expect(ach.isError).toBe(false);
    expect((ach.payload as { rail: string }).rail).toBe("ach");

    const rtp = await mcp.callTool("baas_rtp", {
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 50,
    });
    expect(rtp.isError).toBe(false);

    const baasHook = await mcp.callTool("webhooks_baas", {
      event: "payout.settled",
      transfer_id: payoutTransfer.id,
    });
    expect(baasHook.isError).toBe(false);

    const dsp = await mcp.callTool("webhooks_dsp", {
      event: "royalty.report",
      source: "spotify",
      line_items: SPLIT_BODY.line_items,
    });
    expect(dsp.isError).toBe(false);
    const dspRunId = (
      dsp.payload as { split: { split_run: { id: string } } }
    ).split.split_run.id;

    const secondPayout = await mcp.callTool("vaults_payout", {
      payee_id: "l1",
      amount_cents: 50,
      rail: "ach",
    });
    expect(secondPayout.isError).toBe(false);
    const unified = await mcp.callTool("webhooks_ingest", {
      event: "payout.failed",
      transfer_id: (secondPayout.payload as { transfer: { id: string } })
        .transfer.id,
    });
    expect(unified.isError).toBe(false);

    const reversed = await mcp.callTool("splits_reverse", {
      split_run_id: dspRunId,
    });
    expect(reversed.isError).toBe(false);

    const log = await mcp.callTool("ledger_log", {});
    expect(log.isError).toBe(false);
    const audit = await mcp.callTool("ledger_audit", {});
    expect(audit.isError).toBe(false);
    expect(audit.payload).toEqual(
      expect.objectContaining({ books_reconcile: expect.any(Boolean) }),
    );
  });

  it("returns store_failure when the Don store throws", async () => {
    const mcp = new EmeraldValMcpToolHost({
      store: {
        listVaults: () => {
          throw new Error("db down");
        },
      } as never,
      registry: new CovenantMcpRegistry(),
    });
    const result = await mcp.callTool("vaults_list", {});
    expect(result).toEqual({
      isError: true,
      payload: { ok: false, code: "store_failure", message: "db down" },
    });
  });

  it("returns validation errors without throwing", async () => {
    const mcp = host();
    const badTax = await mcp.callTool("withholding_apply", { creator_id: "c1" });
    expect(badTax.isError).toBe(true);
    expect(badTax.payload).toEqual(
      expect.objectContaining({ ok: false, code: "invalid_amount" }),
    );
    const badYear = await mcp.callTool("withholding_get", {
      creator_id: "c1",
      tax_year: 12,
    });
    expect(badYear.isError).toBe(true);
    const missingCreator = await mcp.callTool("withholding_get", {});
    expect(missingCreator.payload).toEqual(
      expect.objectContaining({ code: "missing_creator_id" }),
    );
    const missingAdvance = await mcp.callTool("recoupment_get", {});
    expect(missingAdvance.payload).toEqual(
      expect.objectContaining({ code: "missing_creator_id" }),
    );
  });

  it("covers every Covenant HTTP mount plus audit/metrics tools", async () => {
    const mcp = host();
    const registered = await mcp.callTool("register_work_manifest", {
      manifest: WORK,
    });
    expect(registered).toEqual({
      isError: false,
      payload: { ok: true, workId: "WORK_CHAMPION_001", codeCount: 2 },
    });

    const listed = await mcp.callTool("list_work_manifests", {});
    expect(listed.isError).toBe(false);
    expect(
      (listed.payload as { works: { workId: string }[] }).works[0]?.workId,
    ).toBe("WORK_CHAMPION_001");

    const emptySweep = await mcp.callTool("trigger_blackbox_sweep", {});
    expect(emptySweep.payload).toEqual(
      expect.objectContaining({ code: "missing_feed" }),
    );

    const sweep = await mcp.callTool("trigger_blackbox_sweep", {
      dsrRawFeed: DSR,
    });
    expect(sweep.isError).toBe(false);
    expect(sweep.payload).toEqual(
      expect.objectContaining({
        ok: true,
        recoveredRevenueCents: 1_000,
        matchesFound: 1,
      }),
    );

    const asyncSweep = await mcp.callTool("trigger_blackbox_sweep_async", {
      jobId: "job_async_1",
      dsrRawFeed: DSR,
    });
    expect(asyncSweep.isError).toBe(false);
    expect(asyncSweep.payload).toEqual(
      expect.objectContaining({ jobId: "job_async_1", status: "drained" }),
    );

    const luminate = await mcp.callTool("trigger_luminate_sweep", {
      payloads: [
        {
          luminateId: "lum_1",
          isrc: "USXX12600001",
          songTitle: "STATE OF THE ART",
          artistName: "Yeshua Throne",
          onDemandAudioStreams: 1_000,
          periodStartDate: "2026-01-01",
          periodEndDate: "2026-01-31",
          marketTerritory: "US",
        },
      ],
    });
    expect(luminate.isError).toBe(false);
    expect(luminate.payload).toEqual(
      expect.objectContaining({ ok: true, recordsIngested: 1 }),
    );

    const proofs = await mcp.callTool("query_audit_proof", {
      matchedWorkId: "WORK_CHAMPION_001",
    });
    expect(proofs.isError).toBe(false);
    const metrics = await mcp.callTool("get_channel_unclaimed_metrics", {});
    expect(metrics.isError).toBe(false);
  });
});
