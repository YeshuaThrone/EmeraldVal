"use client";

import { useCallback, useState } from "react";
import { LoaderCircle, MicVocal, Radio } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import {
  ARTIST_SDK_DISTRICTS,
  ATXLiveArtistSDK,
} from "@/lib/artistSdk";
import { setArtistPins } from "@/lib/artistPinStore";
import type { District } from "@/lib/types";

/**
 * One SDK instance for the whole session. The pasted Artist Control Panel
 * constructed a fresh ATXLiveArtistSDK on every render and never called
 * init(artistId), so every uploadShow ran against an uninitialized artist;
 * a module-level singleton with an explicit init fixes both.
 */
let sdkInstance: ATXLiveArtistSDK | null = null;

function getSdk(): ATXLiveArtistSDK {
  if (sdkInstance === null) {
    sdkInstance = new ATXLiveArtistSDK();
  }
  return sdkInstance;
}

type Feedback = { type: "success" | "error"; message: string };

type ArtistForm = {
  venueName: string;
  address: string;
  district: District;
  setTime: string;
  ticketUrl: string;
};

const EMPTY_FORM: ArtistForm = {
  venueName: "",
  address: "",
  district: "Downtown",
  setTime: "",
  ticketUrl: "",
};

const GEOLOCATION_TIMEOUT_MS = 10_000;

/**
 * The Artist Control Panel. Publishes shows through sdk.uploadShow and goes
 * live through navigator.geolocation → sdk.triggerLivePing; every outcome
 * lands as themed inline feedback (the pasted version used alert()). Pins
 * are mirrored into the session artist pin store so they render on the fan
 * map and survive in-session navigation — but not a reload, which the hint
 * below the actions states so the behavior isn't surprising.
 */
export default function ArtistUploadWidget() {
  const [artistId, setArtistId] = useState("");
  const [form, setForm] = useState<ArtistForm>(EMPTY_FORM);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isInitialized = artistId.trim() !== "";

  const updateField = useCallback(
    <K extends keyof ArtistForm>(key: K, value: ArtistForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  // init() is idempotent, so re-initializing on every keystroke of the
  // artist name is safe and keeps the SDK's artist in lockstep with the UI.
  const handleArtistIdChange = useCallback((value: string) => {
    setArtistId(value);
    const trimmed = value.trim();
    if (trimmed !== "") {
      getSdk().init(trimmed);
    }
  }, []);

  const syncPinsToStore = useCallback(() => {
    // Fresh copies: the SDK mutates its pin objects in place (a live ping
    // flips status to ON_STAGE), and the store's snapshot contract needs a
    // new array reference for useSyncExternalStore to see the change.
    setArtistPins(getSdk().artistPins.map((pin) => ({ ...pin })));
  }, []);

  const handlePublish = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isInitialized) {
        setFeedback({
          type: "error",
          message: "Enter your artist name first — it labels your pins.",
        });
        return;
      }

      setIsPublishing(true);
      setFeedback(null);
      try {
        const result = await getSdk().uploadShow({
          venueName: form.venueName,
          address: form.address.trim() === "" ? undefined : form.address,
          district: form.district,
          setTime: form.setTime,
          ticketUrl: form.ticketUrl.trim() === "" ? undefined : form.ticketUrl,
        });

        if (!result.success) {
          setFeedback({ type: "error", message: result.error });
          return;
        }

        syncPinsToStore();
        setForm(EMPTY_FORM);
        setFeedback({
          type: "success",
          message: `Show published — ${result.pin.performerName} is pinned at ${result.pin.locationName} on the fan map.`,
        });
      } catch {
        // uploadShow resolves failures into results; reaching here means
        // something unexpected — surface it rather than swallowing it.
        setFeedback({
          type: "error",
          message: "Publishing failed unexpectedly. Please try again.",
        });
      } finally {
        setIsPublishing(false);
      }
    },
    [form, isInitialized, syncPinsToStore],
  );

  const handleGoLive = useCallback(() => {
    if (!isInitialized) {
      setFeedback({
        type: "error",
        message: "Enter your artist name first — it labels your pins.",
      });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setFeedback({
        type: "error",
        message: "Your browser doesn't support location sharing.",
      });
      return;
    }

    setIsGoingLive(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await getSdk().triggerLivePing({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

          if (!result.success) {
            setFeedback({ type: "error", message: result.error });
            return;
          }

          syncPinsToStore();
          setIsLive(true);
          setFeedback({
            type: "success",
            message: `You're ON STAGE — ${result.pin.locationName} is pulsing on the fan map.`,
          });
        } catch {
          setFeedback({
            type: "error",
            message: "Going live failed unexpectedly. Please try again.",
          });
        } finally {
          setIsGoingLive(false);
        }
      },
      (error) => {
        setIsGoingLive(false);
        setFeedback({
          type: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Location access was denied — allow location in your browser to go live on stage."
              : "Couldn't get your location. Check that location services are on and try again.",
        });
      },
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  }, [isInitialized, syncPinsToStore]);

  const feedbackClass =
    feedback === null
      ? ""
      : feedback.type === "success"
        ? "border-atx-electric/40 bg-atx-electric/10 text-atx-electric-deep"
        : "border-atx-stage/40 bg-atx-stage/10 text-atx-stage-deep";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void handlePublish(event);
      }}
    >
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-atx-electric uppercase">
          <MicVocal className="h-3.5 w-3.5" />
          Artist Studio
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-atx-ink md:text-3xl">
          Artist Control Panel
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Publish your shows and go live on the ATXLive fan map.
        </p>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">Artist Name</span>
          <input
            required
            value={artistId}
            onChange={(event) => handleArtistIdChange(event.target.value)}
            placeholder="Your artist or band name"
            className={FIELD_CLASS}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">Venue Name</span>
          <input
            required
            value={form.venueName}
            onChange={(event) => updateField("venueName", event.target.value)}
            placeholder="Empire Control Room"
            className={FIELD_CLASS}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">
            Address <span className="text-stone-400">(optional)</span>
          </span>
          <input
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="606 Red River St"
            className={FIELD_CLASS}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">District</span>
          <select
            required
            value={form.district}
            onChange={(event) =>
              updateField("district", event.target.value as District)
            }
            className={FIELD_CLASS}
          >
            {ARTIST_SDK_DISTRICTS.map((district) => (
              <option key={district} value={district} className="bg-atx-paper">
                {district}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">Set Time</span>
          <input
            required
            type="datetime-local"
            value={form.setTime}
            onChange={(event) => updateField("setTime", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">
            Ticket Link <span className="text-stone-400">(optional)</span>
          </span>
          <input
            type="url"
            value={form.ticketUrl}
            onChange={(event) => updateField("ticketUrl", event.target.value)}
            placeholder="https://tickets.example.com/my-show"
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div
        aria-live="polite"
        className={`grid gap-2 ${feedback === null ? "hidden" : ""}`}
      >
        {feedback !== null ? (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-3 py-2.5 text-sm ${feedbackClass}`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <button
          type="submit"
          disabled={isPublishing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-atx-electric px-4 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(0,85,255,0.35)] transition hover:bg-atx-electric-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPublishing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <MicVocal className="h-4 w-4" />
          )}
          {isPublishing ? "Publishing…" : "Publish Show"}
        </button>

        <button
          type="button"
          onClick={handleGoLive}
          disabled={isGoingLive || !isInitialized}
          title={
            isInitialized
              ? undefined
              : "Enter your artist name to enable going live"
          }
          className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-atx-stage px-4 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-atx-stage-deep disabled:cursor-not-allowed disabled:opacity-70 ${
            isLive ? "animate-pulse shadow-[0_0_32px_rgba(139,0,0,0.65)]" : ""
          }`}
        >
          {isGoingLive ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          {isGoingLive ? "Getting location…" : "GO LIVE ON STAGE NOW"}
        </button>

        <p className="text-center text-xs text-stone-400">
          Pins live for this session only — they clear when the page reloads.
        </p>
      </div>
    </form>
  );
}
