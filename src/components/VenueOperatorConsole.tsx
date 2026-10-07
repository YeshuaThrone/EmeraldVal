"use client";

import { useState } from "react";
import { Gauge, Radio, Volume1 } from "lucide-react";
import {
  ATXLiveEngine,
  DEFAULT_CURFEW_RULES,
} from "@/lib/masterSdk";
import {
  CURFEW_FAMILY_BY_MAP_DISTRICT,
  CURFEW_FAMILY_IDS,
  applyCurfewEdit,
  formatCurfewCountdown,
  secondsToCurfewBoundary,
  venueSoundHistory,
  venueSoundNow,
  type CurfewEdit,
} from "@/lib/venueOperator";
import type { District } from "@/lib/types";
import type { ATXDistrict } from "@/lib/venueStudioBlueprint";

/**
 * Operator Console (Operator Pass O2 — spec art_zVtFFMSp, Move O2).
 *
 * Three panels, every figure from an existing source — the master engine
 * (DEFAULT_CURFEW_RULES + evaluateCurfewStatus, the same instance the
 * Sound Telemetry Guard and master-SDK ping use) and the admin audit
 * contract (civic.ts VENUE_AUDIT_ROWS, the rows /admin's ordinance table
 * renders). No new API routes; no persistence — the spec's locked
 * decision #4 makes curfew edits client-state-only, and the schedule
 * panel says so plainly.
 *
 * Light surface, per locked decision #2: token classes only (atx-* /
 * stone), no `.civic-mode` classes anywhere in this component.
 */

const selectClass =
  "w-full rounded-xl border border-atx-line bg-atx-paper px-3 py-2 text-sm text-atx-ink focus:border-atx-blue focus:outline-none";

const numberInputClass =
  "w-full rounded-xl border border-atx-line bg-atx-paper px-3 py-2 text-sm text-atx-ink tabular-nums focus:border-atx-blue focus:outline-none";

export interface VenueOperatorConsoleProps {
  /** The view's master engine — same instance, no second source of truth. */
  engine: ATXLiveEngine;
  /** Minute-clock tick (src/lib/minuteClock.ts); null until client mount. */
  nowMs: number | null;
  /** The saved blueprint's district — fallback family for the selector. */
  profileDistrict: ATXDistrict;
  /** The venue's districtForPoint seed classification, when on the map. */
  mapDistrict: District | undefined;
  /** Live-now state off the blueprint profile. */
  isLive: boolean;
}

/** One editable schedule row — label, input, unit note. */
function ScheduleField({
  id,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-stone-500">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-1 ${numberInputClass}`}
      />
      <p className="mt-1 text-[11px] text-stone-400">{unit}</p>
    </div>
  );
}

export default function VenueOperatorConsole({
  engine,
  nowMs,
  profileDistrict,
  mapDistrict,
  isLive,
}: VenueOperatorConsoleProps) {
  const seedFamily =
    mapDistrict === undefined
      ? undefined
      : CURFEW_FAMILY_BY_MAP_DISTRICT[mapDistrict];
  const [family, setFamily] = useState<ATXDistrict>(
    () => seedFamily ?? profileDistrict,
  );
  const [edits, setEdits] = useState<CurfewEdit>({});

  const rule = applyCurfewEdit(DEFAULT_CURFEW_RULES[family], edits);
  const curfew =
    nowMs === null ? null : engine.evaluateCurfewStatus(new Date(nowMs), rule);
  const countdown =
    nowMs === null
      ? null
      : formatCurfewCountdown(secondsToCurfewBoundary(new Date(nowMs), rule));

  const soundNow = venueSoundNow();
  const history = venueSoundHistory();
  // Effective cap drives the trace's over-cap shading; before the first
  // client tick the engine has no styled opinion, so the rule's standard
  // cap shades the bars and nothing about the reading is invented.
  const shadingCap = curfew?.effectiveCapDb ?? rule.standardCapDb;

  const patchEdit = (patch: CurfewEdit) =>
    setEdits((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-stone-500">
        Run the night from this page — room state, the district curfew
        schedule, and the floor&apos;s sound level, all from the same engine
        and seed the admin dashboard reads. Session-only by design: nothing
        on this page persists beyond this browser tab.
      </p>

      {/* ── Room status now ─────────────────────────────────────────── */}
      <section
        aria-label="Room status"
        className="rounded-2xl border border-atx-line bg-atx-paper p-5"
      >
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Room status now
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              isLive
                ? "bg-atx-electric-soft/15 text-atx-electric-soft"
                : "bg-stone-500/10 text-stone-500"
            }`}
          >
            {isLive ? "Live now" : "Standby"}
          </span>
          <span
            className={`text-sm font-semibold ${
              curfew?.isCurfewActive === true
                ? "text-atx-red"
                : "text-atx-blue-deep"
            }`}
          >
            {nowMs === null
              ? "Reading the room clock…"
              : curfew?.isCurfewActive
                ? "In curfew window"
                : "Standard hours"}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-stone-500 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-stone-500">Effective cap</dt>
            <dd className="text-atx-ink tabular-nums">
              {curfew?.effectiveCapDb ?? rule.standardCapDb} dB
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-stone-500">
              {curfew?.isCurfewActive ? "Curfew ends in" : "Curfew begins in"}
            </dt>
            <dd className="text-atx-ink tabular-nums">
              {countdown ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Curfew schedule — read / session-only edit ──────────────── */}
      <section
        aria-label="District curfew schedule"
        className="rounded-2xl border border-atx-line bg-atx-paper p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Curfew schedule
          </h3>
          <span className="rounded-full border border-atx-line px-3 py-1 text-[11px] font-semibold text-stone-500">
            Session-only — never saved
          </span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="operator-curfew-family"
              className="block text-xs font-semibold text-stone-500"
            >
              District family
            </label>
            <select
              id="operator-curfew-family"
              className={`mt-1 ${selectClass}`}
              value={family}
              onChange={(event) => {
                // Only a real engine family updates state — invalid values
                // are ignored rather than cast (same guard as the publish
                // form's district select).
                const next = CURFEW_FAMILY_IDS.find(
                  (option) => option === event.target.value,
                );
                if (next !== undefined) {
                  setFamily(next);
                  setEdits({});
                }
              }}
            >
              {CURFEW_FAMILY_IDS.map((option) => (
                <option key={option} value={option}>
                  {DEFAULT_CURFEW_RULES[option].district}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-stone-400">
              {mapDistrict === undefined
                ? "Venue is off the map seed — showing the blueprint district."
                : `Map seed classifies this venue ${mapDistrict}.`}
            </p>
          </div>
          <ScheduleField
            id="operator-curfew-start"
            label="Curfew start (0–23)"
            value={rule.startHour24}
            min={0}
            max={23}
            unit="24h local hour the curfew window opens"
            onChange={(startHour24) => patchEdit({ startHour24 })}
          />
          <ScheduleField
            id="operator-curfew-end"
            label="Curfew end (0–23)"
            value={rule.endHour24}
            min={0}
            max={23}
            unit="24h local hour the curfew window closes"
            onChange={(endHour24) => patchEdit({ endHour24 })}
          />
          <ScheduleField
            id="operator-curfew-standard-cap"
            label="Standard cap (dB)"
            value={rule.standardCapDb}
            min={50}
            max={120}
            unit="Outside the curfew window"
            onChange={(standardCapDb) => patchEdit({ standardCapDb })}
          />
          <ScheduleField
            id="operator-curfew-cap"
            label="Curfew cap (dB)"
            value={rule.curfewCapDb}
            min={50}
            max={120}
            unit="Inside the curfew window"
            onChange={(curfewCapDb) => patchEdit({ curfewCapDb })}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEdits({})}
            className="rounded-full border border-atx-line bg-atx-paper px-4 py-2 text-xs font-semibold text-stone-500 transition hover:border-atx-blue/40 hover:text-atx-ink"
          >
            Reset session edits
          </button>
          <p className="text-[11px] text-stone-400">
            Edits apply to this tab only — no server, no API, no persistence.
            Status, countdown, and the trace&apos;s cap shading re-derive
            instantly through the master engine.
          </p>
        </div>
      </section>

      {/* ── Sound level now + last hour ─────────────────────────────── */}
      <section
        aria-label="Sound level"
        className="rounded-2xl border border-atx-line bg-atx-paper p-5"
      >
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
          <Volume1 className="h-3.5 w-3.5" aria-hidden="true" />
          Sound level — last hour
        </h3>
        {soundNow === null ? (
          <p className="mt-3 text-sm text-stone-400">
            No admin audit row for this venue yet — the console reads
            /admin&apos;s ordinance contract and there is no row under the
            studio&apos;s venue name.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <p className="text-5xl font-bold tracking-tight text-atx-ink tabular-nums">
                {soundNow.currentDb}
                <span className="ml-2 text-lg font-semibold text-stone-400">
                  dB
                </span>
              </p>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  soundNow.status === "OVER_LIMIT"
                    ? "bg-atx-red/15 text-atx-red"
                    : "bg-atx-electric-soft/15 text-atx-electric-soft"
                }`}
              >
                {soundNow.status === "OVER_LIMIT" ? "Over limit" : "Compliant"}
              </span>
              <p className="text-xs text-stone-400">
                Admin audit contract — cap {soundNow.limitDb} dB
              </p>
            </div>

            <div
              className="mt-4 flex h-20 items-end gap-1"
              role="img"
              aria-label={`Deterministic last-hour trace, ${history.length} five-minute readings ending at ${soundNow.currentDb} dB, current district cap ${shadingCap} dB`}
            >
              {history.map((db, index) => (
                <div
                  key={index}
                  className={`flex-1 rounded-t ${
                    db > shadingCap ? "bg-atx-red" : "bg-atx-electric"
                  }`}
                  style={{
                    height: `${Math.min(100, Math.max(4, (db / 100) * 100))}%`,
                  }}
                  title={`-${(history.length - 1 - index) * 5}m · ${db} dB`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-stone-400">
              <span>-55m</span>
              <span>-30m</span>
              <span>now</span>
            </div>
            <p className="mt-3 text-[11px] text-stone-400">
              The trace is deterministic simulation off the seed — anchored at
              the admin-contract reading, never a live feed. Bars shade red
              where they sit over the effective district cap.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
