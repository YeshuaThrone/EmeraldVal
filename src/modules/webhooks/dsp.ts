/**
 * DSP / catalog royalty webhook ingestor — royalty.report and
 * royalty.adjusted auto-trigger UDR splits; royalty.reversed inverts
 * the original split run through the reversal ledger.
 */

import type { RoyaltyLineItemInput, SettlementRail } from "@/lib/don/types";
import type { Store } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import type { DspWebhookEvent } from "@/modules/don/constants";
import type { DspWebhookEventRecord } from "@/modules/don/records";
import { reverseSplitRun } from "@/modules/ledger/reversal";

export type DspWebhookInput = {
  event: DspWebhookEvent;
  event_id?: string;
  source: string;
  period?: string | null;
  currency?: string;
  rail?: SettlementRail;
  split_run_id?: string;
  line_items?: RoyaltyLineItemInput[];
};

export function dspWebhookEventId(input: DspWebhookInput): string {
  if (input.event_id !== undefined && input.event_id.trim() !== "") {
    return input.event_id.trim();
  }
  return [
    input.source,
    input.event,
    input.period ?? "",
    input.split_run_id ?? "",
    JSON.stringify(input.line_items ?? []),
  ].join(":");
}

export async function ingestDspWebhook(
  store: Store,
  input: DspWebhookInput,
  now: Date = new Date(),
) {
  const eventId = dspWebhookEventId(input);
  const prior = store.getDspWebhookEvent(eventId);
  if (prior !== undefined) {
    return {
      ok: true as const,
      idempotent: true,
      event: prior,
    };
  }

  if (input.event === "royalty.reversed") {
    const splitRunId = input.split_run_id?.trim() ?? "";
    if (splitRunId === "") {
      return {
        ok: false as const,
        status: 422,
        code: "missing_split_run_id",
        message: "split_run_id is required to reverse a royalty report.",
      };
    }
    const reversed = reverseSplitRun(store, splitRunId, now);
    if (!reversed.ok) {
      return reversed;
    }
    const event: DspWebhookEventRecord = store.insertDspWebhookEvent({
      event_id: eventId,
      event: input.event,
      source: input.source,
      split_run_id: splitRunId,
      payload_json: JSON.stringify(input),
      created_at: now.toISOString(),
    });
    return {
      ok: true as const,
      idempotent: reversed.idempotent,
      event,
      split_run: reversed.split_run,
      reversal: reversed.reversal,
    };
  }

  const split = await calculateUdrSplits(
    store,
    {
      source: input.source,
      period: input.period ?? null,
      currency: input.currency ?? "USD",
      settle: false,
      rail: input.rail ?? "rtp",
      line_items: input.line_items ?? [],
    },
    now,
  );
  if (!split.ok) {
    return split;
  }
  const event: DspWebhookEventRecord = store.insertDspWebhookEvent({
    event_id: eventId,
    event: input.event,
    source: input.source,
    split_run_id: split.value.split_run.id,
    payload_json: JSON.stringify(input),
    created_at: now.toISOString(),
  });
  return {
    ok: true as const,
    idempotent: false,
    event,
    split: split.value,
  };
}
