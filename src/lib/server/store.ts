import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  ValidLivePingPayload,
  ValidShowPayload,
} from "@/lib/validation";
import type {
  BaasTransferRecord,
  KycVerificationRecord,
  LedgerTransactionRecord,
  PlaidLinkTokenRecord,
  RoyaltyLineItemRecord,
  SplitRunRecord,
} from "@/lib/don/types";
import type {
  CompanyDustRecord,
  CreatorTaxProfile,
  CreatorYtdEarnings,
  PlaidProcessorTokenRecord,
  SovereignVaultRecord,
  TaxEscrowRecord,
} from "@/modules/don/records";

/**
 * SQLite persistence for ATXLive — the round's one new dependency
 * (better-sqlite3) behind a swappable interface. The spec's locked
 * decision: SQLite now, a serverless-compatible store (Vercel KV/Postgres)
 * is a one-file swap when real hosting lands — callers only ever see the
 * `Store` interface, never better-sqlite3 types.
 *
 * better-sqlite3 is synchronous, which is fine for these low-volume write
 * endpoints and keeps the store methods trivially testable.
 *
 * The `artists` table carries the PR 23 API-key credentials: the raw key
 * is shown to the artist once at registration and only its SHA-256 hash
 * (key_hash) plus a display prefix (key_prefix) are ever stored.
 */

/** A stored show — the validated wire payload plus its generated id. */
export type ShowRecord = ValidShowPayload & { id: string };

/** A stored live ping — the validated wire payload plus its generated id. */
export type LivePingRecord = ValidLivePingPayload & { id: string };

/** A registered artist — the identity a Bearer API key resolves to. */
export type ArtistRecord = {
  id: string;
  name: string;
  created_at: string;
  /** SHA-256 hex digest of the artist's API key — never the raw key. */
  key_hash: string;
  /** Display prefix, e.g. `atxlive_abc12345` — safe to show in the UI. */
  key_prefix: string;
};

/** Cap for GET /api/shows — sane default, overridable per call. */
export const DEFAULT_LIST_SHOWS_LIMIT = 200;

/**
 * Outcome of recording one completed checkout session (PR 24 capacity
 * accounting). `recorded` is the first confirmation — capacity was
 * decremented; `already_recorded` is a repeat confirm of the same session
 * (poll-safe: the redirect may hit the endpoint more than once) — capacity
 * is left alone; `insufficient_capacity` means payment succeeded but the
 * show sold out before confirmation.
 */
export type CheckoutPurchaseResult =
  | { outcome: "recorded"; remaining: number }
  | { outcome: "already_recorded"; remaining: number }
  | { outcome: "insufficient_capacity"; remaining: number };

export interface Store {
  insertShow(show: ValidShowPayload): ShowRecord;
  /** Newest first (created_at DESC, insertion order as tiebreak). */
  listShows(limit?: number): ShowRecord[];
  getShow(id: string): ShowRecord | undefined;
  /**
   * Idempotently records a completed checkout session and decrements the
   * show's remaining capacity by the purchased quantity. The
   * checkout_sessions table's primary key makes a repeated confirm a no-op
   * (poll-safe success-redirect handling — see src/lib/server/checkout.ts).
   * Returns null when the show doesn't exist or isn't native ticketing.
   */
  recordCheckoutPurchase(
    sessionId: string,
    showId: string,
    quantity: number,
  ): CheckoutPurchaseResult | null;
  insertLivePing(ping: ValidLivePingPayload): LivePingRecord;
  /** Newest first (timestamp DESC, insertion order as tiebreak). */
  listLivePings(limit?: number): LivePingRecord[];
  insertArtist(
    name: string,
    keyHash: string,
    keyPrefix: string,
    createdAt?: string,
  ): ArtistRecord;
  getArtist(id: string): ArtistRecord | undefined;
  /** Resolves a presented API key's stored hash to its artist row. */
  getArtistByKeyHash(keyHash: string): ArtistRecord | undefined;

  insertPlaidLinkToken(
    token: Omit<PlaidLinkTokenRecord, "id" | "created_at">,
  ): PlaidLinkTokenRecord;
  getPlaidLinkTokenByLinkToken(
    linkToken: string,
  ): PlaidLinkTokenRecord | undefined;
  getPlaidLinkTokenByPublicToken(
    publicToken: string,
  ): PlaidLinkTokenRecord | undefined;
  insertKycVerification(
    row: Omit<KycVerificationRecord, "id">,
  ): KycVerificationRecord;
  listKycVerificationsByCreator(creatorId: string): KycVerificationRecord[];
  insertSplitRun(row: Omit<SplitRunRecord, "id">): SplitRunRecord;
  insertRoyaltyLineItem(
    row: Omit<RoyaltyLineItemRecord, "id">,
  ): RoyaltyLineItemRecord;
  insertLedgerTransaction(
    row: Omit<LedgerTransactionRecord, "id">,
  ): LedgerTransactionRecord;
  getLedgerTransaction(id: string): LedgerTransactionRecord | undefined;
  listLedgerTransactionsByRun(splitRunId: string): LedgerTransactionRecord[];
  updateLedgerSettlement(
    id: string,
    patch: Pick<
      LedgerTransactionRecord,
      "status" | "rail" | "baas_provider" | "baas_transfer_id" | "settled_at"
    >,
  ): LedgerTransactionRecord | undefined;
  insertBaasTransfer(row: Omit<BaasTransferRecord, "id">): BaasTransferRecord;
  listBaasTransfers(limit?: number): BaasTransferRecord[];
  insertCompanyDust(row: Omit<CompanyDustRecord, "id">): CompanyDustRecord;
  listCompanyDustByRun(splitRunId: string): CompanyDustRecord[];
  getCreatorTaxProfile(creatorId: string): CreatorTaxProfile | undefined;
  upsertCreatorTaxProfile(row: CreatorTaxProfile): CreatorTaxProfile;
  getCreatorYtd(
    creatorId: string,
    taxYear: number,
  ): CreatorYtdEarnings | undefined;
  upsertCreatorYtd(row: CreatorYtdEarnings): CreatorYtdEarnings;
  insertTaxEscrow(row: Omit<TaxEscrowRecord, "id">): TaxEscrowRecord;
  listTaxEscrowByCreator(
    creatorId: string,
    taxYear: number,
  ): TaxEscrowRecord[];
  getVault(payeeId: string): SovereignVaultRecord | undefined;
  listVaults(): SovereignVaultRecord[];
  upsertVault(row: SovereignVaultRecord): SovereignVaultRecord;
  updatePlaidAccessToken(
    publicToken: string,
    accessToken: string,
  ): PlaidLinkTokenRecord | undefined;
  insertProcessorToken(
    row: Omit<PlaidProcessorTokenRecord, "id">,
  ): PlaidProcessorTokenRecord;
  getProcessorToken(
    publicToken: string,
    processor: PlaidProcessorTokenRecord["processor"],
  ): PlaidProcessorTokenRecord | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL,
  set_time TEXT NOT NULL,
  ticket_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  ticketing_type TEXT NOT NULL DEFAULT '',
  native_ticket_price REAL,
  native_ticket_capacity INTEGER,
  latitude REAL,
  longitude REAL,
  council_district TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS live_pings (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL DEFAULT ''
);

-- PR 24 capacity accounting: one row per completed checkout session. The
-- primary key is the idempotency guard — a repeated success-redirect
-- confirm (or a future webhook + redirect race) inserts nothing and
-- therefore never double-decrements capacity.
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Don Engine sandbox: Plaid Link tokens, KYC outcomes, UDR ledger, BaaS rails.
CREATE TABLE IF NOT EXISTS plaid_link_tokens (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  link_token TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  expiration TEXT NOT NULL,
  products TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  plaid_link_token TEXT,
  plaid_public_token TEXT,
  status TEXT NOT NULL,
  identity_json TEXT NOT NULL,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS split_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  period TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  gross_cents INTEGER NOT NULL,
  line_item_count INTEGER NOT NULL,
  variance_account_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS royalty_line_items (
  id TEXT PRIMARY KEY,
  split_run_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  work_title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  splits_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  split_run_id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  payee_name TEXT NOT NULL,
  role TEXT NOT NULL,
  share_bps INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  rail TEXT,
  baas_provider TEXT,
  baas_transfer_id TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS baas_transfers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  rail TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  payee_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  ledger_transaction_id TEXT,
  created_at TEXT NOT NULL,
  estimated_settlement TEXT
);

CREATE TABLE IF NOT EXISTS company_dust_ledger (
  id TEXT PRIMARY KEY,
  split_run_id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  variance_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_tax_profiles (
  creator_id TEXT PRIMARY KEY,
  tin_verified INTEGER NOT NULL DEFAULT 0,
  w9_on_file INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_ytd_earnings (
  creator_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  withheld_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (creator_id, tax_year)
);

CREATE TABLE IF NOT EXISTS tax_escrow_ledger (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  gross_cents INTEGER NOT NULL,
  withheld_cents INTEGER NOT NULL,
  net_cents INTEGER NOT NULL,
  tin_verified INTEGER NOT NULL,
  w9_on_file INTEGER NOT NULL,
  requires_1099 INTEGER NOT NULL,
  crossed_1099_threshold INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sovereign_vaults (
  payee_id TEXT PRIMARY KEY,
  payee_name TEXT NOT NULL,
  available_balance INTEGER NOT NULL DEFAULT 0,
  pending_balance INTEGER NOT NULL DEFAULT 0,
  reserve_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plaid_processor_tokens (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  public_token TEXT NOT NULL,
  processor TEXT NOT NULL,
  processor_token TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (public_token, processor)
);
`;

export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.migrate();
  }

  /**
   * In-place column additions for databases created before PR 22 (the dev
   * DB at data/atxlive.db predates the show coordinate columns) and before
   * PR 23 (the artists table predates the key columns). SQLite's CREATE
   * TABLE IF NOT EXISTS never alters an existing table, so missing columns
   * are added here; fresh databases already have them.
   */
  private migrate(): void {
    const columnsOf = (table: string) =>
      new Set(
        (
          this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
            name: string;
          }>
        ).map((column) => column.name),
      );

    const showColumns = columnsOf("shows");
    if (!showColumns.has("latitude")) {
      this.db.exec(`ALTER TABLE shows ADD COLUMN latitude REAL`);
    }
    if (!showColumns.has("longitude")) {
      this.db.exec(`ALTER TABLE shows ADD COLUMN longitude REAL`);
    }
    if (!showColumns.has("council_district")) {
      this.db.exec(
        `ALTER TABLE shows ADD COLUMN council_district TEXT NOT NULL DEFAULT ''`,
      );
    }

    // PR 23: pre-23 databases have an artists table without key columns.
    // Existing rows (PR 21/22 stubs) had no credentials; a NOT NULL backfill
    // is impossible for them, so the migration adds nullable columns and
    // fresh registrations always populate them.
    const artistColumns = columnsOf("artists");
    if (!artistColumns.has("key_hash")) {
      this.db.exec(`ALTER TABLE artists ADD COLUMN key_hash TEXT`);
    }
    if (!artistColumns.has("key_prefix")) {
      this.db.exec(
        `ALTER TABLE artists ADD COLUMN key_prefix TEXT NOT NULL DEFAULT ''`,
      );
    }

    const splitRunColumns = columnsOf("split_runs");
    if (!splitRunColumns.has("variance_account_cents")) {
      this.db.exec(
        `ALTER TABLE split_runs ADD COLUMN variance_account_cents INTEGER NOT NULL DEFAULT 0`,
      );
    }
  }

  insertShow(show: ValidShowPayload): ShowRecord {
    const record: ShowRecord = { ...show, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO shows (
           id, artist_id, artist_name, venue_name, address, district,
           set_time, ticket_url, created_at, ticketing_type,
           native_ticket_price, native_ticket_capacity,
           latitude, longitude, council_district
         ) VALUES (
           @id, @artist_id, @artist_name, @venue_name, @address, @district,
           @set_time, @ticket_url, @created_at, @ticketing_type,
           @native_ticket_price, @native_ticket_capacity,
           @latitude, @longitude, @council_district
         )`,
      )
      .run(record);
    return record;
  }

  listShows(limit: number = DEFAULT_LIST_SHOWS_LIMIT): ShowRecord[] {
    // rowid DESC breaks created_at ties so the most recently inserted row
    // still leads when two shows share a timestamp.
    return this.db
      .prepare(
        `SELECT * FROM shows
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limit) as ShowRecord[];
  }

  getShow(id: string): ShowRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM shows WHERE id = ?`)
      .get(id) as ShowRecord | undefined;
  }

  recordCheckoutPurchase(
    sessionId: string,
    showId: string,
    quantity: number,
  ): CheckoutPurchaseResult | null {
    const show = this.getShow(showId);
    if (
      show === undefined ||
      show.ticketing_type !== "native" ||
      show.native_ticket_capacity === null
    ) {
      return null;
    }
    const remainingAfter = (): number =>
      this.getShow(showId)?.native_ticket_capacity ?? 0;

    // Single synchronous transaction: the INSERT OR IGNORE is the
    // idempotency gate, the guarded UPDATE the capacity decrement.
    const txn = this.db.transaction((): CheckoutPurchaseResult => {
      const inserted = this.db
        .prepare(
          `INSERT OR IGNORE INTO checkout_sessions (id, show_id, quantity, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(sessionId, showId, quantity, new Date().toISOString());
      if (inserted.changes === 0) {
        return { outcome: "already_recorded", remaining: remainingAfter() };
      }
      const updated = this.db
        .prepare(
          `UPDATE shows
           SET native_ticket_capacity = native_ticket_capacity - ?
           WHERE id = ? AND native_ticket_capacity >= ?`,
        )
        .run(quantity, showId, quantity);
      if (updated.changes === 0) {
        // Sold out between session creation and confirmation — the row is
        // recorded so retries stay no-ops; the caller surfaces the conflict.
        return { outcome: "insufficient_capacity", remaining: remainingAfter() };
      }
      return { outcome: "recorded", remaining: remainingAfter() };
    });
    return txn();
  }

  insertLivePing(ping: ValidLivePingPayload): LivePingRecord {
    const record: LivePingRecord = { ...ping, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO live_pings (id, artist_id, latitude, longitude, timestamp, status)
         VALUES (@id, @artist_id, @latitude, @longitude, @timestamp, @status)`,
      )
      .run(record);
    return record;
  }

  listLivePings(limit: number = DEFAULT_LIST_SHOWS_LIMIT): LivePingRecord[] {
    // rowid DESC breaks timestamp ties so the most recently inserted ping
    // still leads when two pings share a timestamp.
    return this.db
      .prepare(
        `SELECT * FROM live_pings
         ORDER BY timestamp DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limit) as LivePingRecord[];
  }

  insertArtist(
    name: string,
    keyHash: string,
    keyPrefix: string,
    createdAt: string = new Date().toISOString(),
  ): ArtistRecord {
    const record: ArtistRecord = {
      id: randomUUID(),
      name: name.trim(),
      created_at: createdAt,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    };
    this.db
      .prepare(
        `INSERT INTO artists (id, name, created_at, key_hash, key_prefix)
         VALUES (@id, @name, @created_at, @key_hash, @key_prefix)`,
      )
      .run(record);
    return record;
  }

  getArtist(id: string): ArtistRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM artists WHERE id = ?`)
      .get(id) as ArtistRecord | undefined;
  }

  getArtistByKeyHash(keyHash: string): ArtistRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM artists WHERE key_hash = ?`)
      .get(keyHash) as ArtistRecord | undefined;
  }

  insertPlaidLinkToken(
    token: Omit<PlaidLinkTokenRecord, "id" | "created_at">,
  ): PlaidLinkTokenRecord {
    const record: PlaidLinkTokenRecord = {
      ...token,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO plaid_link_tokens (
           id, creator_id, link_token, public_token, access_token,
           expiration, products, created_at
         ) VALUES (
           @id, @creator_id, @link_token, @public_token, @access_token,
           @expiration, @products, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  getPlaidLinkTokenByLinkToken(
    linkToken: string,
  ): PlaidLinkTokenRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM plaid_link_tokens WHERE link_token = ?`)
      .get(linkToken) as PlaidLinkTokenRecord | undefined;
  }

  getPlaidLinkTokenByPublicToken(
    publicToken: string,
  ): PlaidLinkTokenRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM plaid_link_tokens WHERE public_token = ?`)
      .get(publicToken) as PlaidLinkTokenRecord | undefined;
  }

  insertKycVerification(
    row: Omit<KycVerificationRecord, "id">,
  ): KycVerificationRecord {
    const record: KycVerificationRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO kyc_verifications (
           id, creator_id, plaid_link_token, plaid_public_token, status,
           identity_json, failure_reason, created_at, verified_at
         ) VALUES (
           @id, @creator_id, @plaid_link_token, @plaid_public_token, @status,
           @identity_json, @failure_reason, @created_at, @verified_at
         )`,
      )
      .run(record);
    return record;
  }

  listKycVerificationsByCreator(creatorId: string): KycVerificationRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM kyc_verifications
         WHERE creator_id = ?
         ORDER BY created_at DESC, rowid DESC`,
      )
      .all(creatorId) as KycVerificationRecord[];
  }

  insertSplitRun(row: Omit<SplitRunRecord, "id">): SplitRunRecord {
    const record: SplitRunRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO split_runs (
           id, source, period, currency, gross_cents, line_item_count,
           variance_account_cents, created_at
         ) VALUES (
           @id, @source, @period, @currency, @gross_cents, @line_item_count,
           @variance_account_cents, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  insertRoyaltyLineItem(
    row: Omit<RoyaltyLineItemRecord, "id">,
  ): RoyaltyLineItemRecord {
    const record: RoyaltyLineItemRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO royalty_line_items (
           id, split_run_id, work_id, work_title, amount_cents, splits_json, created_at
         ) VALUES (
           @id, @split_run_id, @work_id, @work_title, @amount_cents, @splits_json, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  insertLedgerTransaction(
    row: Omit<LedgerTransactionRecord, "id">,
  ): LedgerTransactionRecord {
    const record: LedgerTransactionRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO ledger_transactions (
           id, split_run_id, line_item_id, payee_id, payee_name, role,
           share_bps, amount_cents, currency, status, rail, baas_provider,
           baas_transfer_id, created_at, settled_at
         ) VALUES (
           @id, @split_run_id, @line_item_id, @payee_id, @payee_name, @role,
           @share_bps, @amount_cents, @currency, @status, @rail, @baas_provider,
           @baas_transfer_id, @created_at, @settled_at
         )`,
      )
      .run(record);
    return record;
  }

  getLedgerTransaction(id: string): LedgerTransactionRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM ledger_transactions WHERE id = ?`)
      .get(id) as LedgerTransactionRecord | undefined;
  }

  listLedgerTransactionsByRun(splitRunId: string): LedgerTransactionRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM ledger_transactions
         WHERE split_run_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(splitRunId) as LedgerTransactionRecord[];
  }

  updateLedgerSettlement(
    id: string,
    patch: Pick<
      LedgerTransactionRecord,
      "status" | "rail" | "baas_provider" | "baas_transfer_id" | "settled_at"
    >,
  ): LedgerTransactionRecord | undefined {
    this.db
      .prepare(
        `UPDATE ledger_transactions
         SET status = @status,
             rail = @rail,
             baas_provider = @baas_provider,
             baas_transfer_id = @baas_transfer_id,
             settled_at = @settled_at
         WHERE id = @id`,
      )
      .run({ id, ...patch });
    return this.getLedgerTransaction(id);
  }

  insertBaasTransfer(row: Omit<BaasTransferRecord, "id">): BaasTransferRecord {
    const record: BaasTransferRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO baas_transfers (
           id, provider, rail, payee_id, payee_name, amount_cents, currency,
           status, ledger_transaction_id, created_at, estimated_settlement
         ) VALUES (
           @id, @provider, @rail, @payee_id, @payee_name, @amount_cents, @currency,
           @status, @ledger_transaction_id, @created_at, @estimated_settlement
         )`,
      )
      .run(record);
    return record;
  }

  listBaasTransfers(limit: number = DEFAULT_LIST_SHOWS_LIMIT): BaasTransferRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM baas_transfers
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limit) as BaasTransferRecord[];
  }

  insertCompanyDust(row: Omit<CompanyDustRecord, "id">): CompanyDustRecord {
    const record: CompanyDustRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO company_dust_ledger (
           id, split_run_id, line_item_id, amount_cents, variance_account_id, created_at
         ) VALUES (
           @id, @split_run_id, @line_item_id, @amount_cents, @variance_account_id, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  listCompanyDustByRun(splitRunId: string): CompanyDustRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM company_dust_ledger
         WHERE split_run_id = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(splitRunId) as CompanyDustRecord[];
  }

  getCreatorTaxProfile(creatorId: string): CreatorTaxProfile | undefined {
    return this.db
      .prepare(`SELECT * FROM creator_tax_profiles WHERE creator_id = ?`)
      .get(creatorId) as CreatorTaxProfile | undefined;
  }

  upsertCreatorTaxProfile(row: CreatorTaxProfile): CreatorTaxProfile {
    this.db
      .prepare(
        `INSERT INTO creator_tax_profiles (
           creator_id, tin_verified, w9_on_file, updated_at
         ) VALUES (
           @creator_id, @tin_verified, @w9_on_file, @updated_at
         )
         ON CONFLICT(creator_id) DO UPDATE SET
           tin_verified = excluded.tin_verified,
           w9_on_file = excluded.w9_on_file,
           updated_at = excluded.updated_at`,
      )
      .run(row);
    return row;
  }

  getCreatorYtd(
    creatorId: string,
    taxYear: number,
  ): CreatorYtdEarnings | undefined {
    return this.db
      .prepare(
        `SELECT * FROM creator_ytd_earnings
         WHERE creator_id = ? AND tax_year = ?`,
      )
      .get(creatorId, taxYear) as CreatorYtdEarnings | undefined;
  }

  upsertCreatorYtd(row: CreatorYtdEarnings): CreatorYtdEarnings {
    this.db
      .prepare(
        `INSERT INTO creator_ytd_earnings (
           creator_id, tax_year, gross_cents, withheld_cents, updated_at
         ) VALUES (
           @creator_id, @tax_year, @gross_cents, @withheld_cents, @updated_at
         )
         ON CONFLICT(creator_id, tax_year) DO UPDATE SET
           gross_cents = excluded.gross_cents,
           withheld_cents = excluded.withheld_cents,
           updated_at = excluded.updated_at`,
      )
      .run(row);
    return row;
  }

  insertTaxEscrow(row: Omit<TaxEscrowRecord, "id">): TaxEscrowRecord {
    const record: TaxEscrowRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO tax_escrow_ledger (
           id, creator_id, tax_year, gross_cents, withheld_cents, net_cents,
           tin_verified, w9_on_file, requires_1099, crossed_1099_threshold, created_at
         ) VALUES (
           @id, @creator_id, @tax_year, @gross_cents, @withheld_cents, @net_cents,
           @tin_verified, @w9_on_file, @requires_1099, @crossed_1099_threshold, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  listTaxEscrowByCreator(
    creatorId: string,
    taxYear: number,
  ): TaxEscrowRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM tax_escrow_ledger
         WHERE creator_id = ? AND tax_year = ?
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(creatorId, taxYear) as TaxEscrowRecord[];
  }

  getVault(payeeId: string): SovereignVaultRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM sovereign_vaults WHERE payee_id = ?`)
      .get(payeeId) as SovereignVaultRecord | undefined;
  }

  listVaults(): SovereignVaultRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM sovereign_vaults
         ORDER BY payee_id ASC`,
      )
      .all() as SovereignVaultRecord[];
  }

  upsertVault(row: SovereignVaultRecord): SovereignVaultRecord {
    this.db
      .prepare(
        `INSERT INTO sovereign_vaults (
           payee_id, payee_name, available_balance, pending_balance,
           reserve_balance, updated_at
         ) VALUES (
           @payee_id, @payee_name, @available_balance, @pending_balance,
           @reserve_balance, @updated_at
         )
         ON CONFLICT(payee_id) DO UPDATE SET
           payee_name = excluded.payee_name,
           available_balance = excluded.available_balance,
           pending_balance = excluded.pending_balance,
           reserve_balance = excluded.reserve_balance,
           updated_at = excluded.updated_at`,
      )
      .run(row);
    return row;
  }

  updatePlaidAccessToken(
    publicToken: string,
    accessToken: string,
  ): PlaidLinkTokenRecord | undefined {
    this.db
      .prepare(
        `UPDATE plaid_link_tokens SET access_token = ? WHERE public_token = ?`,
      )
      .run(accessToken, publicToken);
    return this.getPlaidLinkTokenByPublicToken(publicToken);
  }

  insertProcessorToken(
    row: Omit<PlaidProcessorTokenRecord, "id">,
  ): PlaidProcessorTokenRecord {
    const record: PlaidProcessorTokenRecord = { ...row, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO plaid_processor_tokens (
           id, creator_id, public_token, processor, processor_token,
           account_id, created_at
         ) VALUES (
           @id, @creator_id, @public_token, @processor, @processor_token,
           @account_id, @created_at
         )`,
      )
      .run(record);
    return record;
  }

  getProcessorToken(
    publicToken: string,
    processor: PlaidProcessorTokenRecord["processor"],
  ): PlaidProcessorTokenRecord | undefined {
    return this.db
      .prepare(
        `SELECT * FROM plaid_processor_tokens
         WHERE public_token = ? AND processor = ?`,
      )
      .get(publicToken, processor) as PlaidProcessorTokenRecord | undefined;
  }
}

/** Default DB location: data/atxlive.db under the project root (gitignored). */
export function defaultDbPath(): string {
  return (
    process.env.ATXLIVE_DB_PATH ?? path.join(process.cwd(), "data", "atxlive.db")
  );
}

let storeInstance: Store | null = null;

/**
 * Process-wide store singleton. Lazy so that importing a route module
 * (which Next does during build) never opens the database file — the DB is
 * only created on the first actual request.
 */
export function getStore(): Store {
  if (storeInstance === null) {
    storeInstance = new SqliteStore(defaultDbPath());
  }
  return storeInstance;
}

/** Test/ops hook: replace the singleton (e.g. with an in-memory store). */
export function setStore(store: Store | null): void {
  storeInstance = store;
}
