import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { creditVault, payoutFromVault } from "@/modules/vaults/engine";
import { ingestBaasWebhook, webhookEventId } from "./baas";

describe("ingestBaasWebhook", () => {
  it("returns transfer_not_found for an unknown transfer", () => {
    const store = new SqliteStore(":memory:");
    const result = ingestBaasWebhook(store, {
      event: "payout.settled",
      transfer_id: "missing",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("transfer_not_found");
  });

  it("settles an ACH hold and is idempotent on replay", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 800, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 800,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    const first = ingestBaasWebhook(store, {
      event: "payout.settled",
      transfer_id: paid.transfer.id,
      event_id: "evt_1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.vault?.pending_balance).toBe(0);
    expect(first.idempotent).toBe(false);
    const replay = ingestBaasWebhook(store, {
      event: "payout.settled",
      transfer_id: paid.transfer.id,
      event_id: "evt_1",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.idempotent).toBe(true);
  });

  it("reverses an in-flight payout on payout.failed", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 300, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 300,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    const failed = ingestBaasWebhook(store, {
      event: "payout.failed",
      transfer_id: paid.transfer.id,
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      return;
    }
    expect(failed.vault?.available_balance).toBe(300);
    expect(failed.reversal?.reason).toBe("payout.failed");
    expect(webhookEventId({ event: "payout.failed", transfer_id: paid.transfer.id })).toBe(
      `${paid.transfer.id}:payout.failed`,
    );
  });

  it("returns funds on payout.returned after settlement", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 150, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 150,
      rail: "rtp",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    const returned = ingestBaasWebhook(store, {
      event: "payout.returned",
      transfer_id: paid.transfer.id,
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) {
      return;
    }
    expect(returned.vault?.available_balance).toBe(150);
  });

  it("surfaces settle failures without recording the event", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 100,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    reverseVaultThenTamper(store, paid.transfer.id);
    const settled = ingestBaasWebhook(store, {
      event: "payout.settled",
      transfer_id: paid.transfer.id,
    });
    expect(settled.ok).toBe(false);
    expect(store.getWebhookEvent(`${paid.transfer.id}:payout.settled`)).toBeUndefined();
  });

  it("does not record a failed reversal webhook", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 100,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    store.upsertVault({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      available_balance: 0,
      pending_balance: 0,
      reserve_balance: 0,
      updated_at: new Date().toISOString(),
    });
    const failed = ingestBaasWebhook(store, {
      event: "payout.failed",
      transfer_id: paid.transfer.id,
    });
    expect(failed.ok).toBe(false);
    expect(store.getWebhookEvent(`${paid.transfer.id}:payout.failed`)).toBeUndefined();
  });

  it("builds an event id from a provided key", () => {
    expect(
      webhookEventId({
        event: "payout.settled",
        transfer_id: "t1",
        event_id: " custom ",
      }),
    ).toBe("custom");
  });
});

function reverseVaultThenTamper(
  store: SqliteStore,
  transferId: string,
): void {
  const hold = store.getPayoutHold(transferId);
  if (hold) {
    store.updatePayoutHoldStatus(transferId, "reversed");
  }
}
