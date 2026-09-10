/**
 * Don Engine module constants — the platform is the Primary Shareholder
 * dust sink. Fractional leftover cents never accrue to a creator or label.
 */

export const BPS_DENOMINATOR = 10_000;

/** Platform variance / dust sink — the Primary Company account. */
export const COMPANY_VARIANCE_PAYEE_ID = "platform";
export const COMPANY_VARIANCE_PAYEE_NAME = "Don Engine Variance";

/** IRS backup withholding on missing TIN / W-9 (24%). */
export const BACKUP_WITHHOLDING_BPS = 2_400;

/** 1099-MISC threshold: $600 YTD gross. */
export const FORM_1099_THRESHOLD_CENTS = 60_000;

export const PLAID_TOKEN_ENC_PREFIX = "enc:v1:";

/** Default recoupment sweep: 100% of incoming net toward an active advance. */
export const DEFAULT_RECOUPMENT_BPS = 10_000;

export const BAAS_WEBHOOK_EVENTS = [
  "payout.settled",
  "payout.returned",
  "payout.failed",
] as const;
export type BaasWebhookEvent = (typeof BAAS_WEBHOOK_EVENTS)[number];

export const GL_ACCOUNT_FBO_CASH = "fbo_cash";

export const JOURNAL_KINDS = [
  "royalty_ingest",
  "pending_release",
  "payout_hold",
  "payout_settled",
  "payout_failed_reversal",
  "dispute_lock",
  "dispute_unlock",
] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

export const VAULT_BUCKETS = ["available", "pending", "reserve"] as const;
export type VaultBucket = (typeof VAULT_BUCKETS)[number];

export function vaultGlAccount(
  payeeId: string,
  bucket: VaultBucket,
): string {
  return `vault:${payeeId}:${bucket}`;
}
