import { describe, expect, it } from "vitest";
import {
  compactLegs,
  credit,
  debit,
  expandDebitCreditPairs,
  fboCredit,
  fboDebit,
  invertLegs,
  isVaultAccount,
  journalIsBalanced,
  netDebit,
  parseVaultAccount,
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

  it("parses vault accounts, inverts legs, and expands debit/credit pairs", () => {
    expect(parseVaultAccount("vault:c1:pending")).toEqual({
      payeeId: "c1",
      bucket: "pending",
    });
    expect(parseVaultAccount("vault:c1:available")).toEqual({
      payeeId: "c1",
      bucket: "available",
    });
    expect(parseVaultAccount("vault:c1:reserve")).toEqual({
      payeeId: "c1",
      bucket: "reserve",
    });
    expect(parseVaultAccount("fbo_cash")).toBeNull();
    expect(parseVaultAccount("vault:c1")).toBeNull();
    expect(parseVaultAccount("vault:c1:other")).toBeNull();

    expect(invertLegs([fboDebit(8), vaultCredit("c1", "pending", 8)])).toEqual([
      { account: "fbo_cash", debit_cents: 0, credit_cents: 8 },
      { account: "vault:c1:pending", debit_cents: 8, credit_cents: 0 },
    ]);

    expect(
      expandDebitCreditPairs([
        fboDebit(10),
        vaultCredit("c1", "pending", 6),
        vaultCredit("l1", "pending", 4),
      ]),
    ).toEqual([
      {
        debit_account: "fbo_cash",
        credit_account: "vault:c1:pending",
        amount_cents: 6,
      },
      {
        debit_account: "fbo_cash",
        credit_account: "vault:l1:pending",
        amount_cents: 4,
      },
    ]);
    expect(
      expandDebitCreditPairs([
        debit("a", 3),
        debit("b", 7),
        credit("c", 10),
      ]),
    ).toEqual([
      { debit_account: "a", credit_account: "c", amount_cents: 3 },
      { debit_account: "b", credit_account: "c", amount_cents: 7 },
    ]);
    expect(expandDebitCreditPairs([fboDebit(1)])).toEqual([]);
  });
});
