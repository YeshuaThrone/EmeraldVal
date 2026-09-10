import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import type { ValidShowPayload } from "@/lib/validation";

// In-memory SQLite — no files, no network, fresh schema per test.
function newStore(): SqliteStore {
  return new SqliteStore(":memory:");
}

const SHOW_A: ValidShowPayload = {
  artist_id: "artist-42",
  artist_name: "The Night Owls",
  venue_name: "Continental Club",
  address: "1315 S Congress Ave",
  district: "South",
  set_time: "2026-09-05T21:00:00.000Z",
  ticket_url: "https://tickets.example.com/continental",
  created_at: "2026-08-30T12:00:00.000Z",
  ticketing_type: "external",
  native_ticket_price: null,
  native_ticket_capacity: null,
  // PR 22 additive fields — the client-geocoded point and council label.
  latitude: 30.2489,
  longitude: -97.7501,
  council_district: "District 9",
};

const SHOW_B: ValidShowPayload = {
  ...SHOW_A,
  artist_id: "artist-7",
  artist_name: "Glass House",
  venue_name: "Mohawk",
  district: "Downtown",
  created_at: "2026-08-31T09:00:00.000Z",
};

const PING = {
  artist_id: "artist-42",
  latitude: 30.2674,
  longitude: -97.7398,
  timestamp: "2026-08-30T20:00:00.000Z",
  status: "ON_STAGE" as const,
};

let store: SqliteStore;

beforeEach(() => {
  store = newStore();
});

describe("shows", () => {
  it("round-trips a native-ticketing show with all fields intact", () => {
    const inserted = store.insertShow({
      ...SHOW_A,
      ticketing_type: "native",
      ticket_url: "",
      native_ticket_price: 15,
      native_ticket_capacity: 80,
    });

    expect(inserted.id).toBeTruthy();
    const [read] = store.listShows();
    expect(read).toEqual(inserted);
    expect(read.native_ticket_price).toBe(15);
    expect(read.native_ticket_capacity).toBe(80);
    expect(read.ticketing_type).toBe("native");
  });

  it("round-trips an external-ticketing show with null native fields", () => {
    const inserted = store.insertShow(SHOW_A);
    const [read] = store.listShows();
    expect(read).toEqual(inserted);
    expect(read.native_ticket_price).toBeNull();
    expect(read.native_ticket_capacity).toBeNull();
    expect(read.ticket_url).toBe("https://tickets.example.com/continental");
  });

  it("lists shows newest first, with insertion order as the tiebreak", () => {
    store.insertShow(SHOW_A);
    store.insertShow(SHOW_B);
    const shows = store.listShows();
    expect(shows.map((s) => s.venue_name)).toEqual(["Mohawk", "Continental Club"]);

    // Same created_at: the most recently inserted row still leads.
    store.insertShow({ ...SHOW_A, venue_name: "Empire", created_at: SHOW_B.created_at });
    const tied = store.listShows();
    expect(tied[0].venue_name).toBe("Empire");
  });

  it("caps listShows at the requested limit", () => {
    for (let i = 0; i < 5; i += 1) {
      store.insertShow({ ...SHOW_A, venue_name: `Venue ${i}` });
    }
    expect(store.listShows(3)).toHaveLength(3);
    expect(store.listShows()).toHaveLength(5);
  });

  it("rejects malformed input at the store boundary (NOT NULL constraints)", () => {
    // The route validators guarantee typed input; a malformed record reaching
    // the store is a programming error and must fail loudly, not silently.
    expect(() =>
      store.insertShow({} as unknown as ValidShowPayload),
    ).toThrow();
  });
});

describe("live pings", () => {
  it("round-trips a ping with all fields intact", () => {
    const inserted = store.insertLivePing(PING);
    expect(inserted.id).toBeTruthy();
    expect(inserted.status).toBe("ON_STAGE");

    const second = store.insertLivePing({ ...PING, artist_id: "artist-7" });
    expect(second.id).not.toBe(inserted.id);
  });
});

describe("artists (PR 23 credentials)", () => {
  it("round-trips insert and get with the key hash and prefix", () => {
    const artist = store.insertArtist(
      "The Night Owls",
      "hash-abc",
      "atxlive_abc12345",
      "2026-08-30T00:00:00.000Z",
    );
    expect(artist.id).toBeTruthy();
    expect(artist.name).toBe("The Night Owls");
    expect(artist.key_hash).toBe("hash-abc");
    expect(artist.key_prefix).toBe("atxlive_abc12345");

    const read = store.getArtist(artist.id);
    expect(read).toEqual(artist);
  });

  it("returns undefined for an unknown artist id", () => {
    expect(store.getArtist("no-such-id")).toBeUndefined();
  });

  it("resolves an artist by key hash and never by raw key", () => {
    const artist = store.insertArtist("Glass House", "hash-xyz", "atxlive_xyz");
    expect(store.getArtistByKeyHash("hash-xyz")).toEqual(artist);
    expect(store.getArtistByKeyHash("no-such-hash")).toBeUndefined();
  });

  it("keeps duplicate names as distinct identities with distinct keys", () => {
    const first = store.insertArtist("Duo", "hash-1", "atxlive_aaaa");
    const second = store.insertArtist("Duo", "hash-2", "atxlive_bbbb");
    expect(first.id).not.toBe(second.id);
    expect(second.name).toBe("Duo");
    expect(store.getArtistByKeyHash("hash-2")?.id).toBe(second.id);
  });
});

describe("checkout capacity accounting (PR 24)", () => {
  const NATIVE_SHOW: ValidShowPayload = {
    ...SHOW_A,
    ticketing_type: "native",
    ticket_url: "",
    native_ticket_price: 25,
    native_ticket_capacity: 4,
  };

  it("fetches a stored show by id", () => {
    const stored = store.insertShow(NATIVE_SHOW);
    expect(store.getShow(stored.id)).toEqual(stored);
    expect(store.getShow("no-such-id")).toBeUndefined();
  });

  it("decrements remaining capacity on the first confirmation", () => {
    const id = store.insertShow(NATIVE_SHOW).id;
    const result = store.recordCheckoutPurchase("cs_1", id, 2);
    expect(result).toEqual({ outcome: "recorded", remaining: 2 });
    expect(store.getShow(id)?.native_ticket_capacity).toBe(2);
  });

  it("is idempotent — a repeated session never double-decrements", () => {
    const id = store.insertShow(NATIVE_SHOW).id;
    store.recordCheckoutPurchase("cs_1", id, 2);
    const repeat = store.recordCheckoutPurchase("cs_1", id, 2);
    expect(repeat).toEqual({ outcome: "already_recorded", remaining: 2 });
    expect(store.getShow(id)?.native_ticket_capacity).toBe(2);
  });

  it("reports insufficient capacity when the show sold out before confirm", () => {
    const id = store
      .insertShow({ ...NATIVE_SHOW, native_ticket_capacity: 1 })
      .id;
    const result = store.recordCheckoutPurchase("cs_2", id, 2);
    expect(result).toEqual({ outcome: "insufficient_capacity", remaining: 1 });
    expect(store.getShow(id)?.native_ticket_capacity).toBe(1);
  });

  it("returns null for unknown or non-native shows", () => {
    const externalId = store.insertShow(SHOW_A).id;
    expect(store.recordCheckoutPurchase("cs_3", "no-such-id", 1)).toBeNull();
    expect(store.recordCheckoutPurchase("cs_4", externalId, 1)).toBeNull();
  });
});

describe("Don Engine ledger", () => {
  it("round-trips a Plaid Link token by both token kinds", () => {
    const inserted = store.insertPlaidLinkToken({
      creator_id: "creator-1",
      link_token: "link-sandbox-aaa",
      public_token: "public-sandbox-bbb",
      access_token: "access-sandbox-ccc",
      expiration: "2026-09-10T19:00:00.000Z",
      products: "auth,identity",
    });
    expect(store.getPlaidLinkTokenByLinkToken("link-sandbox-aaa")).toEqual(
      inserted,
    );
    expect(
      store.getPlaidLinkTokenByPublicToken("public-sandbox-bbb"),
    ).toEqual(inserted);
  });

  it("lists KYC rows for a creator newest first", () => {
    const failed = store.insertKycVerification({
      creator_id: "c1",
      plaid_link_token: null,
      plaid_public_token: null,
      status: "failed",
      identity_json: "{}",
      failure_reason: "sandbox",
      created_at: "2026-09-10T12:00:00.000Z",
      verified_at: null,
    });
    const verified = store.insertKycVerification({
      creator_id: "c1",
      plaid_link_token: null,
      plaid_public_token: null,
      status: "verified",
      identity_json: "{}",
      failure_reason: null,
      created_at: "2026-09-10T13:00:00.000Z",
      verified_at: "2026-09-10T13:00:00.000Z",
    });
    store.insertKycVerification({
      creator_id: "other",
      plaid_link_token: null,
      plaid_public_token: null,
      status: "verified",
      identity_json: "{}",
      failure_reason: null,
      created_at: "2026-09-10T14:00:00.000Z",
      verified_at: "2026-09-10T14:00:00.000Z",
    });
    const listed = store.listKycVerificationsByCreator("c1");
    expect(listed.map((row) => row.id)).toEqual([verified.id, failed.id]);
  });

  it("persists a split run, line item, and ledger row then patches settlement", () => {
    const run = store.insertSplitRun({
      source: "spotify",
      period: "2026-08",
      currency: "USD",
      gross_cents: 10_000,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: "2026-09-10T15:00:00.000Z",
    });
    const item = store.insertRoyaltyLineItem({
      split_run_id: run.id,
      work_id: "trk_01",
      work_title: "Midnight On 6th",
      amount_cents: 10_000,
      splits_json: "[]",
      created_at: run.created_at,
    });
    const ledger = store.insertLedgerTransaction({
      split_run_id: run.id,
      line_item_id: item.id,
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "creator",
      share_bps: 7000,
      amount_cents: 7000,
      currency: "USD",
      status: "pending_settlement",
      rail: null,
      baas_provider: null,
      baas_transfer_id: null,
      created_at: run.created_at,
      settled_at: null,
    });
    const patched = store.updateLedgerSettlement(ledger.id, {
      status: "settled",
      rail: "rtp",
      baas_provider: "column",
      baas_transfer_id: "xfer_1",
      settled_at: run.created_at,
    });
    expect(patched?.status).toBe("settled");
    expect(patched?.baas_transfer_id).toBe("xfer_1");
    expect(store.listLedgerTransactionsByRun(run.id)[0]?.id).toBe(ledger.id);
    expect(store.listLedgerTransactionsByLineItem(item.id)[0]?.kind).toBe("royalty");
  });

  it("round-trips dust, tax escrow, vaults, and processor tokens", () => {
    const dust = store.insertCompanyDust({
      split_run_id: "run-1",
      line_item_id: "item-1",
      amount_cents: 1,
      variance_account_id: "platform",
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.listCompanyDustByRun("run-1")[0]?.id).toBe(dust.id);

    store.upsertCreatorTaxProfile({
      creator_id: "c1",
      tin_verified: 1,
      w9_on_file: 1,
      updated_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getCreatorTaxProfile("c1")?.tin_verified).toBe(1);

    store.upsertCreatorYtd({
      creator_id: "c1",
      tax_year: 2026,
      gross_cents: 60000,
      withheld_cents: 0,
      updated_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getCreatorYtd("c1", 2026)?.gross_cents).toBe(60000);

    store.insertTaxEscrow({
      creator_id: "c1",
      tax_year: 2026,
      gross_cents: 100,
      withheld_cents: 24,
      net_cents: 76,
      tin_verified: 0,
      w9_on_file: 0,
      requires_1099: 1,
      crossed_1099_threshold: 1,
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.listTaxEscrowByCreator("c1", 2026)).toHaveLength(1);

    store.upsertVault({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      available_balance: 10,
      pending_balance: 5,
      reserve_balance: 2,
      updated_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.listVaults()).toHaveLength(1);
    expect(store.getVault("c1")?.pending_balance).toBe(5);

    store.insertPlaidLinkToken({
      creator_id: "c1",
      link_token: "link-sandbox-x",
      public_token: "public-sandbox-x",
      access_token: "access-sandbox-x",
      expiration: "2026-09-10T19:00:00.000Z",
      products: "auth",
    });
    store.updatePlaidAccessToken("public-sandbox-x", "enc:v1:token");
    expect(store.getPlaidLinkTokenByPublicToken("public-sandbox-x")?.access_token).toBe(
      "enc:v1:token",
    );

    const processor = store.insertProcessorToken({
      creator_id: "c1",
      public_token: "public-sandbox-x",
      processor: "unit",
      processor_token: "processor-sandbox-unit-1",
      account_id: "acc-sandbox-1",
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(
      store.getProcessorToken("public-sandbox-x", "unit")?.id,
    ).toBe(processor.id);

    const advance = store.upsertRecoupmentAdvance({
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 1000,
      recoupment_current_cents: 0,
      recoupment_bps: 10_000,
      updated_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getRecoupmentAdvance("c1")?.creator_id).toBe(advance.creator_id);
    expect(store.listRecoupmentAdvances()).toHaveLength(1);

    store.upsertVaultDispute({
      payee_id: "c1",
      locked: 1,
      line_item_id: null,
      frozen_from_available: 10,
      frozen_from_pending: 0,
      updated_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getVaultDispute("c1")?.locked).toBe(1);

    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: "2026-09-10T15:00:00.000Z",
      estimated_settlement: null,
    });
    expect(store.getBaasTransfer(transfer.id)?.id).toBe(transfer.id);
    expect(store.updateBaasTransferStatus(transfer.id, "failed")?.status).toBe("failed");
    store.insertPayoutHold({
      transfer_id: transfer.id,
      payee_id: "c1",
      amount_cents: 10,
      status: "in_flight",
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.sumInFlightPayoutHolds("c1")).toBe(10);
    store.updatePayoutHoldStatus(transfer.id, "settled");
    expect(store.getPayoutHold(transfer.id)?.status).toBe("settled");

    const journal = store.insertGlJournal({
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      created_at: "2026-09-10T15:00:00.000Z",
    });
    store.insertGlEntry({
      journal_id: journal.id,
      account: "fbo_cash",
      debit_cents: 10,
      credit_cents: 0,
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.listGlEntriesByJournal(journal.id)).toHaveLength(1);
    expect(store.listGlEntries()).toHaveLength(1);
    expect(store.listGlJournals()).toHaveLength(1);

    const webhook = store.insertWebhookEvent({
      event_id: `${transfer.id}:payout.failed`,
      event: "payout.failed",
      transfer_id: transfer.id,
      payload_json: "{}",
      reversal_id: null,
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getWebhookEvent(webhook.event_id)?.id).toBe(webhook.id);
    const reversal = store.insertPayoutReversal({
      transfer_id: transfer.id,
      payee_id: "c1",
      amount_cents: 10,
      reason: "payout.failed",
      ledger_transaction_id: null,
      journal_id: journal.id,
      created_at: "2026-09-10T15:00:00.000Z",
    });
    expect(store.getPayoutReversalByTransfer(transfer.id)?.id).toBe(reversal.id);
  });
});
