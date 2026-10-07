/**
 * Sandbox BaaS webhook ingestor — payout.settled / returned / failed.
 */

import type { Store } from "@/lib/server/store";
import type { BaasWebhookEvent } from "@/modules/don/constants";
import type { BaasWebhookEventRecord } from "@/modules/don/records";
import { reverseVaultPayout, settleVaultPayout } from "@/modules/vaults/engine";

export type BaasWebhookInput = {
  event: BaasWebhookEvent;
  transfer_id: string;
  event_id?: string;
};

export function webhookEventId(input: BaasWebhookInput): string {
  return input.event_id?.trim() || `${input.transfer_id}:${input.event}`;
}

export function ingestBaasWebhook(
  store: Store,
  input: BaasWebhookInput,
  now: Date = new Date(),
) {
  const transfer = store.getBaasTransfer(input.transfer_id);
  if (transfer === undefined) {
    return {
      ok: false as const,
      status: 404,
      code: "transfer_not_found",
      message: "No BaaS transfer matches that id.",
    };
  }

  const eventId = webhookEventId(input);
  const prior = store.getWebhookEvent(eventId);
  if (prior !== undefined) {
    return {
      ok: true as const,
      idempotent: true,
      event: prior,
      transfer,
    };
  }

  if (input.event === "payout.settled") {
    const settled = settleVaultPayout(store, input.transfer_id, now);
    if (!settled.ok) {
      return settled;
    }
    const event = store.insertWebhookEvent({
      event_id: eventId,
      event: input.event,
      transfer_id: input.transfer_id,
      payload_json: JSON.stringify(input),
      reversal_id: null,
      created_at: now.toISOString(),
    });
    return {
      ok: true as const,
      idempotent: settled.idempotent,
      event,
      transfer: settled.transfer,
      vault: settled.vault,
      reversal: null,
    };
  }

  const reversed = reverseVaultPayout(store, input.transfer_id, input.event, now);
  if (!reversed.ok) {
    return reversed;
  }
  const event: BaasWebhookEventRecord = store.insertWebhookEvent({
    event_id: eventId,
    event: input.event,
    transfer_id: input.transfer_id,
    payload_json: JSON.stringify(input),
    reversal_id: reversed.reversal.id,
    created_at: now.toISOString(),
  });
  return {
    ok: true as const,
    idempotent: reversed.idempotent,
    event,
    transfer: reversed.transfer,
    vault: reversed.vault,
    reversal: reversed.reversal,
  };
}
