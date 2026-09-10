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
