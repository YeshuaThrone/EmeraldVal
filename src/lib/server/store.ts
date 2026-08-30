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
 * The `artists` table exists now so PR 23 (API-key auth) has a home for
 * credentials; only schema + create/read stubs ship this PR.
 */

/** A stored show — the validated wire payload plus its generated id. */
export type ShowRecord = ValidShowPayload & { id: string };

/** A stored live ping — the validated wire payload plus its generated id. */
export type LivePingRecord = ValidLivePingPayload & { id: string };

/** A registered artist — schema + CRUD stub only this PR (PR 23 extends). */
export type ArtistRecord = {
  id: string;
  name: string;
  created_at: string;
};

/** Cap for GET /api/shows — sane default, overridable per call. */
export const DEFAULT_LIST_SHOWS_LIMIT = 200;

export interface Store {
  insertShow(show: ValidShowPayload): ShowRecord;
  /** Newest first (created_at DESC, insertion order as tiebreak). */
  listShows(limit?: number): ShowRecord[];
  insertLivePing(ping: ValidLivePingPayload): LivePingRecord;
  insertArtist(name: string, createdAt?: string): ArtistRecord;
  getArtist(id: string): ArtistRecord | undefined;
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
  native_ticket_capacity INTEGER
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
  created_at TEXT NOT NULL
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
  }

  insertShow(show: ValidShowPayload): ShowRecord {
    const record: ShowRecord = { ...show, id: randomUUID() };
    this.db
      .prepare(
        `INSERT INTO shows (
           id, artist_id, artist_name, venue_name, address, district,
           set_time, ticket_url, created_at, ticketing_type,
           native_ticket_price, native_ticket_capacity
         ) VALUES (
           @id, @artist_id, @artist_name, @venue_name, @address, @district,
           @set_time, @ticket_url, @created_at, @ticketing_type,
           @native_ticket_price, @native_ticket_capacity
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

  insertArtist(name: string, createdAt: string = new Date().toISOString()): ArtistRecord {
    const record: ArtistRecord = {
      id: randomUUID(),
      name: name.trim(),
      created_at: createdAt,
    };
    this.db
      .prepare(
        `INSERT INTO artists (id, name, created_at) VALUES (@id, @name, @created_at)`,
      )
      .run(record);
    return record;
  }

  getArtist(id: string): ArtistRecord | undefined {
    return this.db
      .prepare(`SELECT * FROM artists WHERE id = ?`)
      .get(id) as ArtistRecord | undefined;
  }
}

/** Default DB location: data/atxlive.db under the project root (gitignored). */
export function defaultDbPath(): string {
  return process.env.ATXLIVE_DB_PATH ?? path.join(process.cwd(), "data", "atxlive.db");
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
