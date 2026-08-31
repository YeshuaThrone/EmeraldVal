"use client";

/**
 * VenueBlueprintForm — the v3.5.0 Venue Studio rebuild (paste directive 1).
 *
 * A real React form implementing the VenueStudioBlueprintProfile schema:
 * Core Identity (venue name, all-of-Austin district grid, capacity, stage
 * layout, operating hours, live set windows), Amenities & Vibe Matrix
 * (patio, smoking, licensing, age limits, dominant genre multi-select), and
 * the Telemetry & Compliance Opt-In (dB cap, live stream, sensor ID).
 *
 * The parent owns the state; this component is a controlled view over
 * VenueBlueprintFormState with pure helpers from lib/venueStudioForm. The
 * schema's Default Austin Blueprint Seed Instance pre-fills every field, so
 * the studio opens on a live, valid blueprint ("Austin Live Control Room").
 * The live JSON preview shows the compiled VenueStudioBlueprintProfile as
 * the operator edits — the exact payload the blueprint engine consumes.
 */
import { useState } from "react";
import { Radio, Save } from "lucide-react";
import {
  type AgeRestrictionType,
  type LicensingType,
  type SmokingPolicyType,
  type VenueStudioBlueprintProfile,
} from "@/lib/venueStudioBlueprint";
import {
  AGE_RESTRICTION_OPTIONS,
  BLUEPRINT_DISTRICTS,
  buildBlueprintProfile,
  DOMINANT_GENRE_OPTIONS,
  LICENSING_OPTIONS,
  SMOKING_POLICY_OPTIONS,
  STAGE_LAYOUT_OPTIONS,
  toggleDominantGenre,
  validateBlueprintProfile,
  type VenueBlueprintFormState,
} from "@/lib/venueStudioForm";

const inputClass =
  "w-full rounded-xl border border-atx-line bg-atx-paper px-3 py-2 text-sm text-atx-ink placeholder:text-stone-400 focus:border-atx-blue focus:outline-none";

const labelClass =
  "block text-[11px] font-semibold tracking-[0.15em] text-stone-500 uppercase";

const sectionClass =
  "rounded-2xl border border-atx-line bg-white p-4 shadow-[0_2px_12px_rgba(28,25,23,0.06)]";

function SectionHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h3 className="text-sm font-bold text-atx-ink">{title}</h3>
      <span className="text-[11px] text-stone-500">{note}</span>
    </div>
  );
}

/**
 * The v3.5.0 Venue Studio rebuild — a controlled blueprint form. The parent
 * owns the state so the studio can react to saved profiles (e.g. the
 * telemetry guard's dB limit follows the blueprint's decibelThresholdCapDb).
 */
export default function VenueBlueprintForm({
  form,
  onFormChange,
  onSavedProfile,
}: {
  form: VenueBlueprintFormState;
  onFormChange: (patch: Partial<VenueBlueprintFormState>) => void;
  onSavedProfile: (profile: VenueStudioBlueprintProfile) => void;
}) {
  const [savedProfile, setSavedProfile] = useState<VenueStudioBlueprintProfile | null>(null);

  const draftProfile = buildBlueprintProfile(form);
  const validation = validateBlueprintProfile(draftProfile);

  const handleSave = () => {
    if (!validation.isValid) return;
    const profile = buildBlueprintProfile(form);
    setSavedProfile(profile);
    onSavedProfile(profile);
  };

  return (
    <div className="space-y-4">
      {/* 1. Core Identity (Mirrors Artist Studio Setup) */}
      <section className={sectionClass} aria-label="Core Identity">
        <SectionHeader note="Mirrors Artist Studio Setup" title="Core Identity" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bp-venue-name" className={labelClass}>
              Venue name
            </label>
            <input
              id="bp-venue-name"
              className={inputClass}
              value={form.venueName}
              placeholder="e.g. Empire Control Room"
              onChange={(e) => onFormChange({ venueName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="bp-capacity" className={labelClass}>
              Capacity
            </label>
            <input
              id="bp-capacity"
              type="number"
              min={1}
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => onFormChange({ capacity: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bp-operating-hours" className={labelClass}>
              Operating hours
            </label>
            <input
              id="bp-operating-hours"
              value={form.operatingHours}
              onChange={(e) => onFormChange({ operatingHours: e.target.value })}
              placeholder="4:00 PM - 2:00 AM"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bp-live-windows" className={labelClass}>
              Live set windows
            </label>
            <input
              id="bp-live-windows"
              value={form.liveSetWindows}
              onChange={(e) => onFormChange({ liveSetWindows: e.target.value })}
              placeholder="8:00 PM - 1:30 AM"
              className={inputClass}
            />
          </div>
        </div>

        <p className={`${labelClass} mt-4`}>District — all of Austin</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {BLUEPRINT_DISTRICTS.map((district) => (
            <button
              key={district.value}
              type="button"
              aria-pressed={form.district === district.value}
              onClick={() => onFormChange({ district: district.value })}
              className={
                form.district === district.value
                  ? "rounded-xl border border-atx-red bg-atx-red px-2 py-2 text-[11px] font-semibold text-white"
                  : "rounded-xl border border-atx-line bg-atx-paper px-2 py-2 text-[11px] font-semibold text-stone-600 transition hover:border-atx-electric/60 hover:text-atx-electric"
              }
            >
              {district.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <span className={labelClass}>Stage layout</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {STAGE_LAYOUT_OPTIONS.map((layout) => (
              <button
                key={layout.value}
                type="button"
                aria-pressed={form.stageLayout === layout.value}
                onClick={() => onFormChange({ stageLayout: layout.value })}
                className={
                  form.stageLayout === layout.value
                    ? "rounded-xl border border-atx-electric bg-atx-electric/10 px-2 py-2 text-[11px] font-semibold text-atx-electric"
                    : "rounded-xl border border-atx-line bg-atx-paper px-2 py-2 text-[11px] font-semibold text-stone-600"
                }
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Amenities & Vibe Matrix (Tourist & Fan Matching) */}
      <section className={sectionClass}>
        <SectionHeader note="Tourist & fan matching" title="Amenities & Vibe Matrix" />
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-atx-ink">
          <input
            type="checkbox"
            checked={form.patioAndOutdoorAccess}
            onChange={(e) => onFormChange({ patioAndOutdoorAccess: e.target.checked })}
            className="h-4 w-4 accent-[#9b1b30]"
          />
          Patio &amp; outdoor access — crucial for weather surge directives
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="bp-smoking" className={labelClass}>
              Smoking policy
            </label>
            <select
              id="bp-smoking"
              value={form.smokingPolicy}
              onChange={(e) => onFormChange({ smokingPolicy: e.target.value as SmokingPolicyType })}
              className={inputClass}
            >
              {SMOKING_POLICY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bp-licensing" className={labelClass}>
              Liquor licensing
            </label>
            <select
              id="bp-licensing"
              value={form.liquorLicensing}
              onChange={(e) => onFormChange({ liquorLicensing: e.target.value as LicensingType })}
              className={inputClass}
            >
              {LICENSING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bp-age-limits" className={labelClass}>
              Age limits
            </label>
            <select
              id="bp-age-limits"
              value={form.ageLimits}
              onChange={(e) => onFormChange({ ageLimits: e.target.value as AgeRestrictionType })}
              className={inputClass}
            >
              {AGE_RESTRICTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <span className={labelClass}>Dominant genres</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DOMINANT_GENRE_OPTIONS.map((genre) => {
              const active = form.dominantGenres.includes(genre.value);
              return (
                <button
                  key={genre.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onFormChange({
                      dominantGenres: toggleDominantGenre(form.dominantGenres, genre.value),
                    })
                  }
                  className={
                    active
                      ? "rounded-full border border-atx-electric bg-atx-electric/10 px-3 py-1 text-xs font-semibold text-atx-electric"
                      : "rounded-full border border-atx-line bg-atx-paper px-3 py-1 text-xs font-semibold text-stone-500"
                  }
                >
                  {genre.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Sound Telemetry & Compliance Opt-In */}
      <section className={sectionClass}>
        <SectionHeader note="Connect sound meters to the guard" title="Telemetry & Compliance Opt-In" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bp-db-cap" className={labelClass}>
              Decibel threshold cap (dB)
            </label>
            <input
              id="bp-db-cap"
              type="number"
              value={form.decibelThresholdCapDb}
              onChange={(e) => onFormChange({ decibelThresholdCapDb: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bp-sensor-id" className={labelClass}>
              Sensor ID (optional)
            </label>
            <input
              id="bp-sensor-id"
              value={form.sensorId}
              onChange={(e) => onFormChange({ sensorId: e.target.value })}
              placeholder="sensor_atx_demo_01"
              className={inputClass}
            />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-atx-ink">
          <input
            type="checkbox"
            checked={form.liveTelemetryStreamOptIn}
            onChange={(e) => onFormChange({ liveTelemetryStreamOptIn: e.target.checked })}
            className="h-4 w-4 accent-[#9b1b30]"
          />
          Connect live telemetry stream to the automated alert engine
        </label>
      </section>

      {/* Live validation + compiled payload preview */}
      <section
        aria-label="Blueprint validation and payload"
        className={
          validation.isValid
            ? "rounded-2xl border border-atx-electric/40 bg-atx-electric/5 p-4"
            : "rounded-2xl border border-atx-red/40 bg-atx-red/5 p-4"
        }
      >
        {validation.isValid ? (
          <p className="text-xs font-semibold text-atx-ink">
            Blueprint valid — {draftProfile.venueName || "Untitled venue"} · {draftProfile.district} ·{" "}
            {draftProfile.capacity} cap · {draftProfile.telemetryConfig.decibelThresholdCapDb} dB cap
          </p>
        ) : (
          <p className="text-xs font-semibold text-atx-ink">
            Missing: {validation.missingFields.join(", ")}
          </p>
        )}
        <pre className="mt-2 max-h-44 overflow-auto rounded-xl bg-atx-ink p-3 text-[10px] leading-relaxed text-stone-200">
          {JSON.stringify(draftProfile, null, 2)}
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!validation.isValid}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-atx-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-atx-red/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          Save Venue Blueprint
        </button>
        {validation.isValid ? (
          <span className="text-xs font-semibold text-atx-electric">
            {draftProfile.venueName || "Untitled"} · {draftProfile.district} · {draftProfile.capacity} cap ·{" "}
            {draftProfile.telemetryConfig.decibelThresholdCapDb} dB cap
          </span>
        ) : null}
      </div>

      {savedProfile && (
        <section aria-label="Saved blueprint" className={sectionClass}>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-atx-red" aria-hidden="true" />
            <h3 className="text-sm font-bold text-atx-ink">Saved — {savedProfile.venueName}</h3>
            <span className="rounded-full border border-atx-electric/30 bg-atx-electric/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-atx-electric uppercase">
              {savedProfile.isLive ? "Live" : "Standby"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-stone-600 sm:grid-cols-4">
            <div>
              <dt className="font-semibold text-stone-500">District</dt>
              <dd className="font-semibold text-atx-ink">{savedProfile.district}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-500">Capacity</dt>
              <dd className="font-semibold text-atx-ink">{savedProfile.capacity}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-500">Stage</dt>
              <dd className="font-semibold text-atx-ink">{savedProfile.stageLayout}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-500">dB cap</dt>
              <dd className="font-semibold text-atx-ink">{savedProfile.telemetryConfig.decibelThresholdCapDb}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
