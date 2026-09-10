/**
 * UDR split controller — ingest DSP royalty line items, allocate cents
 * across creators/labels, persist the ledger, and optionally settle each
 * row through the BaaS adapter (sandbox ACH/RTP).
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

export type SplitCalculateSuccess = {
  ok: true;
  value: {
    split_run: SplitRunRecord;
    line_items: Array<AllocatedLineItem & { id: string }>;
    ledger: LedgerTransactionRecord[];
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
    created_at: createdAt,
  });

  const lineItems: Array<AllocatedLineItem & { id: string }> = [];
  const ledger: LedgerTransactionRecord[] = [];

  for (const item of allocated.items) {
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
    }
  }

  if (!input.settle) {
    return {
      ok: true,
      value: {
        split_run: splitRun,
        line_items: lineItems,
        ledger,
        settlement: null,
      },
    };
  }

  const adapter = getBaasAdapter(store);
  const transfers: Array<Extract<BaasTransferResult, { ok: true }>["transfer"]> =
    [];
  const settledLedger: LedgerTransactionRecord[] = [];
  for (const row of ledger) {
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
      settlement: { rail: input.rail, transfers },
    },
  };
}
