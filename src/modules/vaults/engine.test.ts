import { afterEach, describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { ColumnAdapter, setBaasAdapter } from "@/services/baas";
import { creditVault, payoutFromVault, releaseVaultPending } from "./engine";

afterEach(() => {
  setBaasAdapter(null);
});

describe("creditVault / releaseVaultPending", () => {
  it("credits pending then releases into available", () => {
    const store = new SqliteStore(":memory:");
    const pending = creditVault(store, "c1", "Yeshua Throne", 7000, "pending");
    expect(pending.pending_balance).toBe(7000);
    creditVault(store, "c1", "Yeshua Throne", 50, "reserve");
    expect(store.getVault("c1")?.reserve_balance).toBe(50);
    const released = releaseVaultPending(store, "c1", undefined);
    expect(released.ok).toBe(true);
    if (!released.ok) {
      return;
    }
    expect(released.vault.available_balance).toBe(7000);
    expect(released.vault.pending_balance).toBe(0);
  });

  it("returns vault_not_found for an unknown payee", () => {
    const store = new SqliteStore(":memory:");
    const result = releaseVaultPending(store, "missing", 1);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("vault_not_found");
  });

  it("rejects releasing more than pending", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "pending");
    const result = releaseVaultPending(store, "c1", 50);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_pending");
  });
});

describe("payoutFromVault", () => {
  it("debits available and records a sandbox RTP transfer", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 5000, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 2000,
      rail: "rtp",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.vault.available_balance).toBe(3000);
    expect(result.transfer.rail).toBe("rtp");
    expect(store.listBaasTransfers()).toHaveLength(1);
  });

  it("submits ACH from available_balance", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 900, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 900,
      rail: "ach",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.transfer.rail).toBe("ach");
    expect(result.transfer.status).toBe("submitted");
  });

  it("rejects a payout above available_balance", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 200,
      rail: "ach",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_available");
  });

  it("returns vault_not_found when payout hits a missing vault", async () => {
    const store = new SqliteStore(":memory:");
    const result = await payoutFromVault(store, {
      payee_id: "ghost",
      amount_cents: 1,
      rail: "rtp",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("vault_not_found");
  });

  it("rolls available back when the BaaS adapter fails", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 1000, "available");
    setBaasAdapter(new ColumnAdapter({ store, mode: "live" }));
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 400,
      rail: "ach",
    });
    expect(result.ok).toBe(false);
    expect(store.getVault("c1")?.available_balance).toBe(1000);
  });
});
