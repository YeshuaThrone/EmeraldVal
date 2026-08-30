import type { StoredShow } from "@/lib/shows";
import { requestJson } from "@/lib/transport";

/**
 * Festival-side view of artist-submitted shows (PR 25 festival ↔ studio
 * integration).
 *
 * The Festival Finder's deterministic lineup (src/lib/festivalEvents.ts) is
 * untouched; this module feeds only the additive "Artist-Submitted Shows"
 * section from the same source of truth the fan map hydrates from —
 * GET /api/shows. One published show therefore appears on the map pin AND
 * in the festival section.
 *
 * The converters are pure and unit-tested; `fetchFestivalShows` is the only
 * network touchpoint and never throws — the section degrades quietly (retry
 * affordance) instead of crashing the page.
 *
 * Framework-agnostic: no React imports. The festival page's client section
 * calls `fetchFestivalShows` on mount.
 */

/** How the festival section should present one show's ticketing. */
export type FestivalTicketing =
  | { kind: "external"; url: string }
  | { kind: "native"; price: number; capacity: number }
  | { kind: "none" };

/**
 * Kicker copy under the section title (PR 29) — labels the feed as the
 * same live source the fan map pins, per the Festival Finder paste's
 * "ARTIST-SUBMITTED SHOWS (LIVE FAN MAP FEED)" labeling.
 */
export const FESTIVAL_FEED_KICKER = "Live Fan Map Feed";

/**
 * Status label shown on every row (PR 29). Derived, not stored: a show
 * only appears in GET /api/shows after passing the studio's publish
 * validation, so publication itself is the confirmation — no new store
 * field, and no unconfirmed state can exist in this feed.
 */
export const FESTIVAL_SHOW_STATUS_LABEL = "Confirmed";

/**
 * Row title in the paste's "artist — venue" format (em dash, spaced).
 * Pure so the copy decision is unit-testable alongside the other
 * presentation converters in this module.
 */
export function formatFestivalRowTitle(artistName: string, venue: string): string {
  return `${artistName} — ${venue}`;
}

/** One artist-submitted show, shaped for the festival section's rows. */
export type FestivalShowEntry = {
  id: string;
  artistName: string;
  venue: string;
  /** Verbatim council-district label (e.g. "District 3") or the bucket fallback. */
  councilDistrict: string;
  /** ISO 8601 set time, as stored. */
  setTime: string;
  ticketing: FestivalTicketing;
};

/**
 * Formats a stored ISO set time the way the fan map's PerformerDrawer does,
 * so both surfaces show the identical label. Returns null for unparseable
 * values rather than "Invalid Date".
 */
export function formatFestivalSetTime(iso: string): string | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return new Date(time).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Reconstructs the ticketing presentation from the stored wire fields — the
 * same rules `shows.ts` uses for pins. An external record with an empty URL
 * means "no link" (the field was cleared before publish).
 */
export function festivalTicketingFromRecord(record: StoredShow): FestivalTicketing {
  if (record.ticketing_type === "native") {
    if (
      record.native_ticket_price === null ||
      record.native_ticket_capacity === null
    ) {
      // Native rows always carry both values (validator-enforced); a null
      // here would mean a hand-edited database — treat as no ticketing.
      return { kind: "none" };
    }
    return {
      kind: "native",
      price: record.native_ticket_price,
      capacity: record.native_ticket_capacity,
    };
  }
  if (record.ticketing_type === "external" && record.ticket_url !== "") {
    return { kind: "external", url: record.ticket_url };
  }
  return { kind: "none" };
}

/**
 * Converts a stored show into a festival row. Shows uploaded before PR 22
 * carry no coordinates — they still have a venue and set time, so they are
 * listed here; only the map skips them.
 */
export function showRecordToFestivalEntry(
  record: StoredShow,
): FestivalShowEntry {
  return {
    id: record.id,
    artistName: record.artist_name,
    venue: record.venue_name,
    councilDistrict:
      record.council_district !== "" ? record.council_district : record.district,
    setTime: record.set_time,
    ticketing: festivalTicketingFromRecord(record),
  };
}

/**
 * Pure ordering for the section: soonest set time first (a festival listing
 * reads chronologically), unparseable times last, ties broken by id so the
 * order is stable across refetches.
 */
export function sortFestivalEntries(
  entries: FestivalShowEntry[],
): FestivalShowEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.setTime).getTime();
    const bTime = new Date(b.setTime).getTime();
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }
    if (aValid && aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export type FetchFestivalShowsResult =
  | { ok: true; entries: FestivalShowEntry[] }
  | { ok: false; error: string };

/**
 * Fetches GET /api/shows and converts the records into festival rows.
 * Never throws: transport failures resolve to `{ok: false}` so the section
 * can render its retry affordance. Records missing the id (or with a
 * non-string one) are skipped rather than crashing the section.
 */
export async function fetchFestivalShows(): Promise<FetchFestivalShowsResult> {
  const result = await requestJson("/api/shows");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  if (!Array.isArray(result.body)) {
    return { ok: false, error: "Server returned an unexpected response." };
  }

  const records = result.body.filter(
    (record): record is StoredShow =>
      typeof record === "object" &&
      record !== null &&
      typeof (record as { id?: unknown }).id === "string",
  );
  return {
    ok: true,
    entries: sortFestivalEntries(records.map(showRecordToFestivalEntry)),
  };
}
