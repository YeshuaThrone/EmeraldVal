/**
 * UDR split controller — ingest DSP royalty line items, allocate cents
 * with a Primary Company Variance Sweep, persist the ledger + dust,
 * credit sovereign vaults, apply backup withholding for unverified
 * creators, sweep active recoupment advances, post a balanced GL
 * journal, and optionally settle through the BaaS adapter.
 */

import { allocateLineItems } from "@/lib/don/splitEngine";
import type {
  AllocatedLineItem,
  LedgerTransactionRecord,
  SplitCalculateInput,
  SplitRunRecord,
} from "@/lib/don/types";
import type { Store } from "@/lib/server/store";
import {
  getBaasAdapter,
  settleLedgerThroughBaas,
  type BaasTransferResult,
} from "@/services/baas";
import {
  COMPANY_VARIANCE_PAYEE_ID,
  COMPANY_VARIANCE_PAYEE_NAME,
} from "@/modules/don/constants";
import { zeroBalanceHolds } from "@/modules/don/dust";
import { applyWithholding } from "@/modules/compliance/engine";
import { postJournal } from "@/modules/ledger/engine";
import {
  fboCredit,
  fboDebit,
  vaultCredit,
  type GlLeg,
} from "@/modules/ledger/journal";
import {
  applyRecoupmentSweep,
  type RecoupmentApplyResult,
} from "@/modules/recoupment/engine";
import { creditVault } from "@/modules/vaults/engine";
import { isIncomingFrozen } from "@/modules/vaults/dispute";
import type { CompanyDustRecord, TaxEscrowRecord } from "@/modules/don/records";
import type { VaultCreditTarget } from "@/modules/vaults/balances";

export type SplitCalculateSuccess = {
  ok: true;
  value: {
    split_run: SplitRunRecord;
    line_items: Array<AllocatedLineItem & { id: string }>;
    ledger: LedgerTransactionRecord[];
    company_dust_ledger: CompanyDustRecord[];
    variance_account_cents: number;
    zero_balance: true;
    withholding: TaxEscrowRecord[];
    recoupment: Array<RecoupmentApplyResult & { payee_id: string }>;
    settlement: {
      rail: SplitCalculateInput["rail"];
      transfers: Array<Extract<BaasTransferResult, { ok: true }>["transfer"]>;
    } | null;
  };
};

export type SplitCalculateFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export async function calculateUdrSplits(
  store: Store,
  input: SplitCalculateInput,
  now: Date = new Date(),
): Promise<SplitCalculateSuccess | SplitCalculateFailure> {
  const allocated = allocateLineItems(input.line_items);
  if (!allocated.ok) {
    return {
      ok: false,
      status: 422,
      code: allocated.code,
      message: allocated.message,
    };
  }

  const createdAt = now.toISOString();
  const splitRun = store.insertSplitRun({
    source: input.source,
    period: input.period,
    currency: input.currency,
    gross_cents: allocated.grossCents,
    line_item_count: allocated.items.length,
    variance_account_cents: allocated.varianceAccountCents,
    created_at: createdAt,
  });

  const lineItems: Array<AllocatedLineItem & { id: string }> = [];
  const ledger: LedgerTransactionRecord[] = [];
  const dustLedger: CompanyDustRecord[] = [];
  const withholding: TaxEscrowRecord[] = [];
  const recoupment: Array<RecoupmentApplyResult & { payee_id: string }> = [];
  const glLegs: GlLeg[] = [fboDebit(allocated.grossCents)];
  const skipBaas = new Set<string>();
  let baasDirectCents = 0;

  for (const item of allocated.items) {
    if (
      !zeroBalanceHolds(
        item.amount_cents,
        item.splits,
        item.company_dust_cents,
      )
    ) {
      return {
        ok: false,
        status: 500,
        code: "zero_balance_violation",
        message: "sum(creator_allocations) + company_dust !== gross_line_item.",
      };
    }
    const storedItem = store.insertRoyaltyLineItem({
      split_run_id: splitRun.id,
      work_id: item.work_id,
      work_title: item.work_title,
      amount_cents: item.amount_cents,
      splits_json: JSON.stringify(item.splits),
      created_at: createdAt,
    });
    lineItems.push({ ...item, id: storedItem.id });
    for (const party of item.splits) {
      ledger.push(
        store.insertLedgerTransaction({
          split_run_id: splitRun.id,
          line_item_id: storedItem.id,
          payee_id: party.payee_id,
          payee_name: party.payee_name,
          role: party.role,
          share_bps: party.share_bps,
          amount_cents: party.amount_cents,
          currency: input.currency,
          status: "pending_settlement",
          rail: null,
          baas_provider: null,
          baas_transfer_id: null,
          created_at: createdAt,
          settled_at: null,
        }),
      );

      let creditAmount = party.amount_cents;
      if (party.role === "creator" && party.amount_cents > 0) {
        const taxed = applyWithholding(store, {
          creator_id: party.payee_id,
          gross_cents: party.amount_cents,
          tax_year: now.getUTCFullYear(),
        });
        withholding.push(taxed.value.escrow);
        creditAmount = taxed.value.net_cents;
        if (taxed.value.withheld_cents > 0) {
          creditVault(
            store,
            party.payee_id,
            party.payee_name,
            taxed.value.withheld_cents,
            "reserve",
            now,
          );
          glLegs.push(
            vaultCredit(party.payee_id, "reserve", taxed.value.withheld_cents),
          );
        }
      }
      const incomingFrozen = isIncomingFrozen(
        store,
        party.payee_id,
        item.work_id,
      );
      const excessBucket: VaultCreditTarget = incomingFrozen
        ? "reserve"
        : "available";
      const recouped = applyRecoupmentSweep(
        store,
        party.payee_id,
        party.payee_name,
        creditAmount,
        now,
        {
          split_run_id: splitRun.id,
          excess_target: excessBucket,
        },
      );
      if (recouped.applied) {
        recoupment.push({ ...recouped, payee_id: party.payee_id });
        skipBaas.add(ledger[ledger.length - 1]!.id);
        if (recouped.recouped_cents > 0) {
          glLegs.push(
            vaultCredit(
              COMPANY_VARIANCE_PAYEE_ID,
              "available",
              recouped.recouped_cents,
            ),
          );
        }
        if (recouped.excess_cents > 0) {
          glLegs.push(
            vaultCredit(party.payee_id, excessBucket, recouped.excess_cents),
          );
        }
      } else if (incomingFrozen && creditAmount > 0) {
        skipBaas.add(ledger[ledger.length - 1]!.id);
        creditVault(
          store,
          party.payee_id,
          party.payee_name,
          creditAmount,
          "reserve",
          now,
        );
        glLegs.push(vaultCredit(party.payee_id, "reserve", creditAmount));
      } else if (!input.settle && creditAmount > 0) {
        creditVault(
          store,
          party.payee_id,
          party.payee_name,
          creditAmount,
          "pending",
          now,
        );
        glLegs.push(vaultCredit(party.payee_id, "pending", creditAmount));
      } else if (input.settle && creditAmount > 0) {
        baasDirectCents += creditAmount;
      }
    }
    if (item.company_dust_cents > 0) {
      dustLedger.push(
        store.insertCompanyDust({
          split_run_id: splitRun.id,
          line_item_id: storedItem.id,
          amount_cents: item.company_dust_cents,
          variance_account_id: COMPANY_VARIANCE_PAYEE_ID,
          created_at: createdAt,
        }),
      );
      creditVault(
        store,
        COMPANY_VARIANCE_PAYEE_ID,
        COMPANY_VARIANCE_PAYEE_NAME,
        item.company_dust_cents,
        "pending",
        now,
      );
      glLegs.push(
        vaultCredit(
          COMPANY_VARIANCE_PAYEE_ID,
          "pending",
          item.company_dust_cents,
        ),
      );
    }
  }

  if (baasDirectCents > 0) {
    glLegs.push(fboCredit(baasDirectCents));
  }
  const journal = postJournal(
    store,
    {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: splitRun.id,
      legs: glLegs,
    },
    now,
  );
  if (!journal.ok) {
    return {
      ok: false,
      status: 500,
      code: journal.code,
      message: journal.message,
    };
  }

  if (!input.settle) {
    return {
      ok: true,
      value: {
        split_run: splitRun,
        line_items: lineItems,
        ledger,
        company_dust_ledger: dustLedger,
        variance_account_cents: allocated.varianceAccountCents,
        zero_balance: true,
        withholding,
        recoupment,
        settlement: null,
      },
    };
  }

  const adapter = getBaasAdapter(store);
  const transfers: Array<Extract<BaasTransferResult, { ok: true }>["transfer"]> =
    [];
  const settledLedger: LedgerTransactionRecord[] = [];
  for (const row of ledger) {
    if (skipBaas.has(row.id)) {
      settledLedger.push(row);
      continue;
    }
    const result = await settleLedgerThroughBaas(
      store,
      adapter,
      row.id,
      input.rail,
    );
    if (!result.ok) {
      return result;
    }
    transfers.push(result.transfer);
    const updated = store.getLedgerTransaction(row.id);
    if (updated) {
      settledLedger.push(updated);
    }
  }

  return {
    ok: true,
    value: {
      split_run: splitRun,
      line_items: lineItems,
      ledger: settledLedger,
      company_dust_ledger: dustLedger,
      variance_account_cents: allocated.varianceAccountCents,
      zero_balance: true,
      withholding,
      recoupment,
      settlement: { rail: input.rail, transfers },
    },
  };
}
