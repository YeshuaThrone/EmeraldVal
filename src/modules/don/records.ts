export type CompanyDustRecord = {
  id: string;
  split_run_id: string;
  line_item_id: string;
  amount_cents: number;
  variance_account_id: string;
  created_at: string;
};

export type CreatorTaxProfile = {
  creator_id: string;
  tin_verified: number;
  w9_on_file: number;
  updated_at: string;
};

export type CreatorYtdEarnings = {
  creator_id: string;
  tax_year: number;
  gross_cents: number;
  withheld_cents: number;
  updated_at: string;
};

export type TaxEscrowRecord = {
  id: string;
  creator_id: string;
  tax_year: number;
  gross_cents: number;
  withheld_cents: number;
  net_cents: number;
  tin_verified: number;
  w9_on_file: number;
  requires_1099: number;
  crossed_1099_threshold: number;
  created_at: string;
};

export type SovereignVaultRecord = {
  payee_id: string;
  payee_name: string;
  available_balance: number;
  pending_balance: number;
  reserve_balance: number;
  updated_at: string;
};

export type PlaidProcessorTokenRecord = {
  id: string;
  creator_id: string;
  public_token: string;
  processor: "column" | "unit";
  processor_token: string;
  account_id: string;
  created_at: string;
};
