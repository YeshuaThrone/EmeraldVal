"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, Volume1 } from "lucide-react";
import {
  ATXLiveArtistSDK,
  ARTIST_SDK_DISTRICTS,
  type ArtistSdkFailure,
} from "@/lib/artistSdk";
import {
  clearArtistCredentials,
  loadArtistCredentials,
  registerArtist,
  saveArtistCredentials,
  verifyArtistKey,
  type ArtistCredentials,
} from "@/lib/artistCredentials";
import {
  VENUE_BASELINE_DB,
  VENUE_DB_LIMIT,
  VENUE_VENUE_NAME,
  appendReading,
  evaluateTelemetry,
  fetchVenueShows,
  lowerMasterVolume,
} from "@/lib/venueStudio";
import type { StoredShow } from "@/lib/shows";
import type { District } from "@/lib/types";

/**
 * Venue Studio — "Empire Control Room" (PR 33, fifth surface).
 *
 * Two tabs:
 *  - Sound Telemetry Guard: a live dB monitor whose alert box is driven by
 *    ATXLiveIntelligenceEngine.evaluateDecibelAcceleration over a real
 *    readings history — every fader action appends a reading, so the
 *    engine's predicted dB, pre-violation flag, recommended drop, and
 *    message replace the paste's static threshold copy. The fader and
 *    operator buttons are local simulation controls (no sensor backend
 *    exists); the engine math is real.
 *  - Stage & Show Management: a publish form posting through
 *    ATXLiveArtistSDK.uploadShow with the same localStorage Bearer
 *    credential flow as the Artist Studio (no key → registration prompt),
 *    and a published list read from GET /api/shows filtered to this venue.
 *
 * Themed to the locked white/dark-red/electric-blue tokens — the paste's
 * zinc/green/orange palette is not used.
 */

type TabId = "telemetry" | "shows";

type AuthState =
  | { status: "restoring" }
  | { status: "signed_out" }
  | { status: "signed_in"; credentials: ArtistCredentials };

type PublishState =
  | { phase: "idle" }
  | { phase: "publishing" }
  | { phase: "published"; artistName: string }
  | { phase: "failed"; failure: ArtistSdkFailure };

/** One tab of the studio — id drives the themed active state. */
const TABS: { id: TabId; label: string }[] = [
  { id: "telemetry", label: "Sound Telemetry Guard" },
  { id: "shows", label: "Stage & Show Management" },
];

const inputClass =
  "w-full rounded-xl border border-atx-line bg-atx-paper px-3 py-2 text-sm text-atx-ink placeholder:text-stone-400 focus:border-atx-blue focus:outline-none";

/** Live-feed indicator pill — the paste's live-feed dot, themed. */
function LiveFeedPill() {
  return (
    <span
      aria-label="Live feed active"
      className="inline-flex items-center gap-1.5 rounded-full border border-atx-red/30 bg-atx-red/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.15em] text-atx-red uppercase"
    >
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-atx-red opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-atx-red" />
      </span>
      Live Feed
    </span>
  );
}

export default function VenueStudioView() {
  const [activeTab, setActiveTab] = useState<TabId>("telemetry");

  // ── Sound Telemetry Guard state ────────────────────────────────────────
  // currentDb is the fader's live level; readings is the history the engine
  // evaluates. Every operator action appends a reading so acceleration and
  // the 5-minute prediction update from real history.
  const [currentDb, setCurrentDb] = useState(VENUE_BASELINE_DB);
  const [readings, setReadings] = useState<number[]>([]);
  const telemetry = evaluateTelemetry(readings, currentDb);

  const handleFader = (nextDb: number) => {
    setCurrentDb(nextDb);
    setReadings((history) => appendReading(history, nextDb));
  };

  const handleLowerVolume = () => {
    const lowered = lowerMasterVolume(currentDb);
    setCurrentDb(lowered);
    setReadings((history) => appendReading(history, lowered));
  };

  const handleResetBaseline = () => {
    setCurrentDb(VENUE_BASELINE_DB);
    setReadings((history) => appendReading(history, VENUE_BASELINE_DB));
  };

  // ── Stage & Show Management state ─────────────────────────────────────
  const [auth, setAuth] = useState<AuthState>({ status: "restoring" });
  const [performer, setPerformer] = useState("");
  const [stageLocation, setStageLocation] = useState("");
  const [setTime, setSetTime] = useState("");
  const [district, setDistrict] = useState<District>(
    ARTIST_SDK_DISTRICTS[0],
  );
  const [registerName, setRegisterName] = useState("");
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [publish, setPublish] = useState<PublishState>({ phase: "idle" });
  const [feed, setFeed] = useState<
    | { phase: "loading" }
    | { phase: "loaded"; shows: StoredShow[] }
    | { phase: "error"; error: string }
  >({ phase: "loading" });

  const refreshFeed = useCallback(() => {
    let cancelled = false;
    fetchVenueShows().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setFeed({ phase: "loaded", shows: result.shows });
      } else {
        setFeed({ phase: "error", error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Credential restore mirrors the Artist Studio: read localStorage,
    // re-validate against GET /api/artists/verify, clear stale keys.
    let cancelled = false;
    void Promise.resolve(loadArtistCredentials())
      .then((stored) => {
        if (stored === null) {
          setAuth({ status: "signed_out" });
          return null;
        }
        return verifyArtistKey(stored.apiKey).then((profile) => ({
          stored,
          profile,
        }));
      })
      .then((restored) => {
        if (cancelled) {
          return;
        }
        if (restored === null || restored.profile === null) {
          if (restored !== null) {
            clearArtistCredentials();
          }
          setAuth({ status: "signed_out" });
          return;
        }
        setAuth({ status: "signed_in", credentials: restored.stored });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return refreshFeed();
  }, [refreshFeed]);

  const handleRegister = () => {
    const name = registerName.trim();
    if (name === "") {
      setAuthFeedback("Enter a name to mint a venue publishing key.");
      return;
    }
    setAuthFeedback(null);
    void registerArtist(name).then((credentials) => {
      if (credentials === null) {
        setAuthFeedback("Registration failed — please try again.");
        return;
      }
      saveArtistCredentials(credentials);
      setAuth({ status: "signed_in", credentials });
      setAuthFeedback(null);
    });
  };

  const handlePublish = () => {
    if (auth.status !== "signed_in") {
      return;
    }
    const sdk = new ATXLiveArtistSDK({
      artistId: auth.credentials.artistId,
      apiKey: auth.credentials.apiKey,
    });
    setPublish({ phase: "publishing" });
    void sdk
      .uploadShow({
        venueName: VENUE_VENUE_NAME,
        artistName: performer,
        address: stageLocation,
        district: district,
        setTime: setTime,
      })
      .then((result) => {
        if (result.success) {
          // Honest banner: only a real 201 publish lands here — the show
          // is now on the live fan map feed.
          setPublish({ phase: "published", artistName: performer.trim() });
          setPerformer("");
          setStageLocation("");
          setSetTime("");
          refreshFeed();
        } else {
          setPublish({ phase: "failed", failure: result });
        }
      });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-atx-ink md:text-2xl">
            Empire Control Room — Venue Studio
          </h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-stone-400 uppercase">
            Municipal Sound Telemetry &amp; Operations Dashboard
          </p>
        </div>
        <LiveFeedPill />
      </header>

      {/* ── Tab navigation ─────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Venue Studio sections"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-atx-red bg-atx-red text-white"
                  : "border-atx-line bg-atx-paper text-stone-500 hover:border-atx-blue/40 hover:text-atx-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Sound Telemetry Guard ──────────────────────────────── */}
      {activeTab === "telemetry" ? (
        <section
          role="tabpanel"
          aria-label="Sound Telemetry Guard"
          className="flex flex-col gap-4"
        >
          <div className="rounded-3xl border border-atx-line bg-atx-paper p-5 md:p-6">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
                <Volume1 className="h-4 w-4" aria-hidden="true" />
                Live dB Monitor
              </p>
              <p className="text-xs font-medium text-stone-400">
                Ordinance cap {VENUE_DB_LIMIT} dB
              </p>
            </div>
            <p className="mt-3 text-6xl font-bold tracking-tight text-atx-ink tabular-nums md:text-7xl">
              {currentDb}
              <span className="ml-2 text-xl font-semibold text-stone-400">
                dB
              </span>
            </p>

            {/* Operator fader — a local simulation control; each movement
                appends a reading so the engine's prediction updates. */}
            <label
              htmlFor="venue-master-fader"
              className="mt-4 block text-xs font-semibold text-stone-500"
            >
              Master volume fader (simulation)
            </label>
            <input
              id="venue-master-fader"
              type="range"
              min={70}
              max={100}
              value={currentDb}
              onChange={(event) => handleFader(Number(event.target.value))}
              className="mt-2 w-full accent-atx-red"
            />

            {/* Engine-driven alert box — predicted dB, recommended drop,
                and message all come from evaluateDecibelAcceleration. */}
            <div
              role="status"
              className={`mt-4 rounded-2xl border p-4 ${
                telemetry.isPreViolationWarning
                  ? "border-atx-red/40 bg-atx-red/10"
                  : "border-atx-blue/30 bg-atx-blue/5"
              }`}
            >
              <p
                className={`text-xs font-bold tracking-[0.15em] uppercase ${
                  telemetry.isPreViolationWarning
                    ? "text-atx-red"
                    : "text-atx-blue-deep"
                }`}
              >
                {telemetry.isPreViolationWarning
                  ? "Pre-violation warning"
                  : "Telemetry stable"}
              </p>
              <p className="mt-1.5 text-sm font-medium text-atx-ink">
                {telemetry.message}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-500">
                <div>
                  <dt className="font-semibold text-stone-500">
                    Predicted dB (5 min)
                  </dt>
                  <dd className="text-atx-ink tabular-nums">
                    {telemetry.predictedDbIn5Min} dB
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-500">
                    Recommended drop
                  </dt>
                  <dd className="text-atx-ink tabular-nums">
                    {telemetry.recommendedVolumeDropDb > 0
                      ? `-${telemetry.recommendedVolumeDropDb} dB`
                      : "None"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLowerVolume}
                className="rounded-full border border-atx-red bg-atx-red/10 px-4 py-2 text-xs font-semibold text-atx-red-deep transition hover:bg-atx-red/20"
              >
                <Volume1
                  className="mr-1 inline h-3.5 w-3.5"
                  aria-hidden="true"
                />
                Lower Master Volume (-3 dB)
              </button>
              <button
                type="button"
                onClick={handleResetBaseline}
                className="rounded-full border border-atx-line bg-atx-paper px-4 py-2 text-xs font-semibold text-stone-500 transition hover:border-atx-blue/40 hover:text-atx-ink"
              >
                Reset Telemetry Baseline
              </button>
            </div>
            <p className="mt-3 text-[11px] text-stone-400">
              Fader and operator actions are local simulation controls — no
              sensor backend exists. The predictive guard is the real
              ATXLiveIntelligenceEngine over the readings history.
            </p>
          </div>
        </section>
      ) : (
        /* ── Tab 2: Stage & Show Management ─────────────────────────── */
        <section
          aria-label="Stage and Show Management"
          className="flex flex-col gap-4"
        >
          {auth.status === "restoring" ? (
            <p className="rounded-2xl border border-atx-line bg-atx-paper p-4 text-sm text-stone-400">
              Checking your venue publishing key…
            </p>
          ) : auth.status === "signed_out" ? (
            /* Credential gate — mirrors the Artist Studio's registration
               prompt: publishing needs a minted Bearer key. */
            <div className="rounded-2xl border border-atx-line bg-atx-paper p-5">
              <h2 className="text-sm font-bold text-atx-ink">
                Venue publishing key required
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Shows publish to the live Fan Map under a Bearer key. Mint one
                for the venue — it is stored locally and shown once.
              </p>
              <label
                htmlFor="venue-register-name"
                className="mt-3 block text-xs font-semibold text-stone-500"
              >
                Venue operator name
              </label>
              <input
                id="venue-register-name"
                className={inputClass}
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="e.g. Empire Control Room Ops"
              />
              {authFeedback !== null ? (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-atx-red"
                >
                  {authFeedback}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleRegister}
                className="mt-3 rounded-full bg-atx-red px-4 py-2 text-xs font-semibold text-white transition hover:bg-atx-red-deep"
              >
                Mint publishing key
              </button>
            </div>
          ) : (
            <>
              {/* Publish form — posts through ATXLiveArtistSDK.uploadShow. */}
              <form
                aria-label="Publish a venue show"
                className="rounded-2xl border border-atx-line bg-atx-paper p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  handlePublish();
                }}
              >
                <h2 className="text-sm font-bold text-atx-ink">
                  Publish a show at {VENUE_VENUE_NAME}
                </h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="venue-performer"
                      className="block text-xs font-semibold text-stone-500"
                    >
                      Performer name
                    </label>
                    <input
                      id="venue-performer"
                      className={inputClass}
                      value={performer}
                      onChange={(event) => setPerformer(event.target.value)}
                      placeholder="e.g. Glass Prairie"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="venue-stage"
                      className="block text-xs font-semibold text-stone-500"
                    >
                      Stage location
                    </label>
                    <input
                      id="venue-stage"
                      className={inputClass}
                      value={stageLocation}
                      onChange={(event) =>
                        setStageLocation(event.target.value)
                      }
                      placeholder="e.g. 912 Red River St"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="venue-set-time"
                      className="block text-xs font-semibold text-stone-500"
                    >
                      Set time
                    </label>
                    <input
                      id="venue-set-time"
                      type="datetime-local"
                      className={inputClass}
                      value={setTime}
                      onChange={(event) => setSetTime(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="venue-district"
                      className="block text-xs font-semibold text-stone-500"
                    >
                      District
                    </label>
                    <select
                      id="venue-district"
                      className={inputClass}
                      value={district}
                      onChange={(event) => {
                        // Select values are strings; only a valid district
                        // updates state — invalid values are ignored rather
                        // than cast.
                        const next = ARTIST_SDK_DISTRICTS.find(
                          (option) => option === event.target.value,
                        );
                        if (next !== undefined) {
                          setDistrict(next);
                        }
                      }}
                    >
                      {ARTIST_SDK_DISTRICTS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={publish.phase === "publishing"}
                  className="mt-4 rounded-full bg-atx-red px-5 py-2 text-xs font-semibold text-white transition hover:bg-atx-red-deep disabled:opacity-50"
                >
                  {publish.phase === "publishing"
                    ? "Publishing…"
                    : "Publish show to Fan Map"}
                </button>

                {/* Honest banner: success only after a real upload. */}
                {publish.phase === "published" ? (
                  <p
                    role="status"
                    className="mt-3 rounded-2xl border border-atx-blue/40 bg-atx-blue/10 p-3 text-sm font-medium text-atx-blue-deep"
                  >
                    Published show for {publish.artistName} to live Fan Map!
                  </p>
                ) : null}
                {publish.phase === "failed" ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-2xl border border-atx-red/40 bg-atx-red/10 p-3 text-sm font-medium text-atx-red-deep"
                  >
                    {publish.failure.error}
                  </p>
                ) : null}
              </form>

              {/* Published shows — GET /api/shows filtered to this venue. */}
              <div className="rounded-2xl border border-atx-line bg-atx-paper p-5">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                  Published shows — Live Fan Map Feed
                </h3>
                {feed.phase === "loading" ? (
                  <p className="mt-2 text-sm text-stone-400">
                    Loading published shows…
                  </p>
                ) : feed.phase === "error" ? (
                  <p
                    role="alert"
                    className="mt-2 text-sm text-atx-red-deep"
                  >
                    Couldn&apos;t load the published feed: {feed.error}
                  </p>
                ) : feed.shows.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-400">
                    No shows published at {VENUE_VENUE_NAME} yet — publish one
                    above and it appears here and on the fan map.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {feed.shows.map((show) => (
                      <li
                        key={show.id}
                        className="rounded-xl border border-atx-line px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-atx-ink">
                          {show.artist_name}
                        </p>
                        <p className="text-xs text-stone-500">
                          {show.address !== "" ? `${show.address} · ` : ""}
                          {new Date(show.set_time).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  clearArtistCredentials();
                  setAuth({ status: "signed_out" });
                }}
                className="self-start text-xs font-medium text-stone-400 underline transition hover:text-atx-red"
              >
                Sign out of venue publishing
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
