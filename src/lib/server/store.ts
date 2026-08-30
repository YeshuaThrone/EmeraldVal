import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  ValidLivePingPayload,
  ValidShowPayload,
} from "@/lib/validation";

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

export interface Store {
  insertShow(show: ValidShowPayload): ShowRecord;
  /** Newest first (created_at DESC, insertion order as tiebreak). */
  listShows(limit?: number): ShowRecord[];
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
