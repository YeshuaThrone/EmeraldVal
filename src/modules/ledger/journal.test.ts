import { describe, expect, it } from "vitest";
import {
  compactLegs,
  credit,
  debit,
  fboCredit,
  fboDebit,
  isVaultAccount,
  journalIsBalanced,
  netDebit,
  sumCredits,
  sumDebits,
  validateJournal,
  vaultCredit,
  vaultDebit,
} from "./journal";
import { GL_ACCOUNT_FBO_CASH } from "@/modules/don/constants";

describe("journal helpers", () => {
  it("builds debit and credit legs", () => {
    expect(debit("a", 10)).toEqual({
      account: "a",
      debit_cents: 10,
      credit_cents: 0,
    });
    expect(credit("a", 10)).toEqual({
      account: "a",
      debit_cents: 0,
      credit_cents: 10,
    });
    expect(fboDebit(5).account).toBe(GL_ACCOUNT_FBO_CASH);
    expect(fboCredit(5).credit_cents).toBe(5);
    expect(vaultDebit("c1", "pending", 1).account).toBe("vault:c1:pending");
    expect(vaultCredit("c1", "available", 1).account).toBe("vault:c1:available");
  });

  it("sums, nets, and detects vault accounts", () => {
    const legs = [fboDebit(100), vaultCredit("c1", "pending", 60), vaultCredit("l1", "pending", 40)];
    expect(sumDebits(legs)).toBe(100);
    expect(sumCredits(legs)).toBe(100);
    expect(journalIsBalanced(legs)).toBe(true);
    expect(journalIsBalanced([fboDebit(1)])).toBe(false);
    expect(netDebit(legs, GL_ACCOUNT_FBO_CASH)).toBe(100);
    expect(netDebit(legs, "vault:c1:pending")).toBe(-60);
    expect(isVaultAccount("vault:c1:pending")).toBe(true);
    expect(isVaultAccount(GL_ACCOUNT_FBO_CASH)).toBe(false);
  });

  it("validates empty, mixed, negative, and unbalanced journals", () => {
    expect(compactLegs([fboDebit(0), fboCredit(0)])).toEqual([]);
    expect(validateJournal([]).ok).toBe(false);
    expect(validateJournal([fboDebit(0)]).ok).toBe(false);
    expect(
      validateJournal([{ account: "a", debit_cents: 0, credit_cents: -1 }]).ok,
    ).toBe(false);
    expect(
      validateJournal([{ account: "a", debit_cents: -1, credit_cents: 0 }]).ok,
    ).toBe(false);
    expect(
      validateJournal([{ account: "a", debit_cents: 1, credit_cents: 1 }]).ok,
    ).toBe(false);
    expect(validateJournal([fboDebit(5), vaultCredit("c1", "pending", 4)]).ok).toBe(
      false,
    );
    const ok = validateJournal([fboDebit(5), vaultCredit("c1", "pending", 5)]);
    expect(ok.ok).toBe(true);
  });
});
