"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  MicVocal,
  Radio,
  Ticket,
} from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import {
  ATXLiveArtistSDK,
  COUNCIL_DISTRICTS,
  councilDistrictBucket,
} from "@/lib/artistSdk";
import {
  clearArtistCredentials,
  loadArtistCredentials,
  registerArtist,
  saveArtistCredentials,
  verifyArtistKey,
  type ArtistCredentials,
} from "@/lib/artistCredentials";
import { setArtistPins } from "@/lib/artistPinStore";
import type { Ticketing } from "@/lib/types";

/**
 * One SDK instance for the whole session. The pasted Artist Control Panel
 * constructed a fresh ATXLiveArtistSDK on every render and never called
 * init(artistId), so every uploadShow ran against an uninitialized artist;
 * a module-level singleton with an explicit init fixes both. PR 23 adds
 * the Bearer credential: sign-in (register or paste) calls setApiKey so
 * every write carries `Authorization: Bearer <key>`.
 */
let sdkInstance: ATXLiveArtistSDK | null = null;

function getSdk(): ATXLiveArtistSDK {
  if (sdkInstance === null) {
    sdkInstance = new ATXLiveArtistSDK();
  }
  return sdkInstance;
}

/**
 * The studio's auth state. `loading` covers the mount-time re-validation of
 * a stored credential (localStorage read + GET /api/artists/verify) so a
 * reload never flashes the sign-in card before restoring the session.
 */
type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; credentials: ArtistCredentials };

/** The two sides of the signed-out auth card: mint a key, or paste one. */
type AuthMode = "register" | "signin";

type Feedback = { type: "success" | "error"; message: string };

/** The two sides of the pill-style Ticketing Method toggle. */
type TicketingMethod = "external" | "native";

type ArtistForm = {
  venueName: string;
  address: string;
  /** Verbatim council-district select label, e.g. "District 9". */
  councilDistrict: string;
  setTime: string;
  method: TicketingMethod;
  ticketUrl: string;
  price: string;
  capacity: string;
};

const DEFAULT_COUNCIL_DISTRICT = "District 9";

const EMPTY_FORM: ArtistForm = {
  venueName: "",
  address: "",
  councilDistrict: DEFAULT_COUNCIL_DISTRICT,
  setTime: "",
  method: "external",
  ticketUrl: "",
  price: "",
  capacity: "",
};

/** Inline field errors — keyed by the conditional ticketing inputs. */
type TicketingFieldErrors = {
  ticketUrl?: string;
  price?: string;
  capacity?: string;
};

const GEOLOCATION_TIMEOUT_MS = 10_000;

/**
 * Pure client-side gate for the conditional ticketing fields. Bad native
 * price/capacity (and malformed external links) are stopped here so they
 * never reach the SDK — the SDK keeps its own validator as the transport
 * contract, but the panel surfaces these messages inline at the field.
 */
export function validateTicketingFields(
  form: Pick<ArtistForm, "method" | "ticketUrl" | "price" | "capacity">,
): TicketingFieldErrors {
  if (form.method === "external") {
    const url = form.ticketUrl.trim();
    if (url === "") {
      return {
        ticketUrl: "Add your ticket link, or switch to native ticketing.",
      };
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ticketUrl: "Ticket link must start with http:// or https://." };
      }
    } catch {
      return { ticketUrl: "That ticket link doesn't look like a URL." };
    }
    return {};
  }

  const errors: TicketingFieldErrors = {};
  const price = Number(form.price.trim());
  if (form.price.trim() === "") {
    errors.price = "Set a ticket price.";
  } else if (!Number.isFinite(price) || price < 0) {
    errors.price = "Price must be a number that is zero or more.";
  }

  const capacity = Number(form.capacity.trim());
  if (form.capacity.trim() === "") {
    errors.capacity = "Set a ticket capacity.";
  } else if (!Number.isInteger(capacity) || capacity < 1) {
    errors.capacity = "Capacity must be a whole number of at least 1.";
  }
  return errors;
}

/**
 * The Artist Control Panel (v2 + PR 23 identity). Publishing and GO LIVE
 * run through the signed-in artist's Bearer key: register (name → key,
 * shown once with a copy affordance) or sign in (paste an existing key,
 * validated against GET /api/artists/verify) — the key persists in
 * localStorage and is re-validated on mount, so the session survives a
 * reload. Publishing and GO LIVE are gated on being signed in with themed
 * inline prompts, never silent failures. Native ticketing is data, not
 * checkout: the panel captures price/capacity and the pin displays them as
 * "Direct ATXLive Ticketing" data; there is deliberately no buy flow.
 */
export default function ArtistUploadWidget() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [registerName, setRegisterName] = useState("");
  const [signinKey, setSigninKey] = useState("");
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<Feedback | null>(null);
  /** The one-time key reveal after registering — never shown again. */
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<ArtistForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<TicketingFieldErrors>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const updateField = useCallback(
    <K extends keyof ArtistForm>(key: K, value: ArtistForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  /** Applies a credential to the SDK singleton and the session state. */
  const signInWith = useCallback((credentials: ArtistCredentials) => {
    const sdk = getSdk();
    sdk.setApiKey(credentials.apiKey);
    sdk.init(credentials.artistId);
    saveArtistCredentials(credentials);
    setAuth({ status: "signed_in", credentials });
    setAuthFeedback(null);
  }, []);
  // Mount: restore the session from localStorage and re-validate the key
  // against the server — a stale or revoked key signs the artist out
  // instead of failing silently on the next publish.
  useEffect(() => {
    let cancelled = false;

    // Everything resolves in the async chain — no synchronous setState in
    // the effect body (react-hooks/set-state-in-effect).
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
        getSdk().setApiKey(restored.stored.apiKey);
        getSdk().init(restored.stored.artistId);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRegister = useCallback(async () => {
    const name = registerName.trim();
    if (name === "") {
      setAuthFeedback({
        type: "error",
        message: "Enter your artist or band name to create a key.",
      });
      return;
    }
    setIsAuthWorking(true);
    setAuthFeedback(null);
    try {
      const credentials = await registerArtist(name);
      if (credentials === null) {
        setAuthFeedback({
          type: "error",
          message: "Registration failed — please try again.",
        });
        return;
      }
      signInWith(credentials);
      setRevealedKey(credentials.apiKey);
      setCopied(false);
    } finally {
      setIsAuthWorking(false);
    }
  }, [registerName, signInWith]);

  const handleSignIn = useCallback(async () => {
    const key = signinKey.trim();
    if (key === "") {
      setAuthFeedback({
        type: "error",
        message: "Paste the artist key you stored when you registered.",
      });
      return;
    }
    setIsAuthWorking(true);
    setAuthFeedback(null);
    try {
      const profile = await verifyArtistKey(key);
      if (profile === null) {
        setAuthFeedback({
          type: "error",
          message:
            "That key doesn't match any registered artist — check for typos, or create a new key.",
        });
        return;
      }
      signInWith({
        artistId: profile.id,
        artistName: profile.artistName,
        apiKey: key,
        keyPrefix: profile.keyPrefix,
      });
      setSigninKey("");
    } finally {
      setIsAuthWorking(false);
    }
  }, [signinKey, signInWith]);

  const handleSignOut = useCallback(() => {
    clearArtistCredentials();
    getSdk().setApiKey("");
    setAuth({ status: "signed_out" });
    setRevealedKey(null);
    setAuthMode("register");
    setAuthFeedback(null);
  }, []);

  const handleCopyKey = useCallback(async () => {
    if (revealedKey === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    } catch {
      // Clipboard permission denied — the key stays selectable in the
      // reveal box, so the artist can copy it manually.
      setCopied(false);
    }
  }, [revealedKey]);

  const syncPinsToStore = useCallback(() => {
    // Fresh copies: the SDK mutates its pin objects in place (a live ping
    // flips status to ON_STAGE), and the store's snapshot contract needs a
    // new array reference for useSyncExternalStore to see the change.
    setArtistPins(getSdk().artistPins.map((pin) => ({ ...pin })));
  }, []);

  const requireSignIn = useCallback(
    (action: string): boolean => {
      if (auth.status === "signed_in") {
        return true;
      }
      setFeedback({
        type: "error",
        message:
          auth.status === "loading"
            ? "Checking your sign-in — try again in a moment."
            : `Sign in with your artist key to ${action} — create a key or paste an existing one above.`,
      });
      return false;
    },
    [auth],
  );

  const handlePublish = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!requireSignIn("publish shows")) {
        return;
      }
      if (auth.status !== "signed_in") {
        return;
      }
      const credentials = auth.credentials;

      // Inline gate: bad ticketing input never reaches the SDK.
      const errors = validateTicketingFields(form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});

      const ticketing: Ticketing =
        form.method === "external"
          ? { type: "external", ticketUrl: form.ticketUrl.trim() }
          : {
              type: "native",
              price: Number(form.price.trim()),
              capacity: Number(form.capacity.trim()),
            };

      setIsPublishing(true);
      setFeedback(null);
      try {
        const result = await getSdk().uploadShow({
          // Informational on the wire — the server stamps the authenticated
          // artist row onto the stored show.
          artistName: credentials.artistName,
          venueName: form.venueName,
          address: form.address.trim() === "" ? undefined : form.address,
          // The geocoded point still drives filter classification; the
          // council-district bucket is the SDK input and the verbatim label
          // rides along as pin metadata.
          district: councilDistrictBucket(form.councilDistrict) ?? "Downtown",
          councilDistrict: form.councilDistrict,
          setTime: form.setTime,
          ticketing,
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
    [auth, form, requireSignIn, syncPinsToStore],
  );

  const handleGoLive = useCallback(() => {
    if (!requireSignIn("go live on stage")) {
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
  }, [requireSignIn, syncPinsToStore]);

  const feedbackClass =
    feedback === null
      ? ""
      : feedback.type === "success"
        ? "border-atx-electric/40 bg-atx-electric/10 text-atx-electric-deep"
        : "border-atx-stage/40 bg-atx-stage/10 text-atx-stage-deep";

  const authFeedbackClass =
    authFeedback === null
      ? ""
      : authFeedback.type === "success"
        ? "border-atx-electric/40 bg-atx-electric/10 text-atx-electric-deep"
        : "border-atx-stage/40 bg-atx-stage/10 text-atx-stage-deep";

  const fieldErrorClass = "text-xs font-medium text-atx-red";

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

      {auth.status === "signed_in" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-atx-electric/40 bg-atx-electric/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-atx-electric-deep">
              Signed in as {auth.credentials.artistName}
            </p>
            <p className="truncate font-mono text-xs text-stone-500">
              {auth.credentials.keyPrefix}…
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-atx-line bg-atx-paper px-3 py-1.5 text-xs font-semibold text-stone-500 transition hover:border-atx-stage/50 hover:text-atx-stage-deep"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl border border-atx-line bg-stone-50 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-atx-line bg-stone-100 p-1">
            <button
              type="button"
              role="radio"
              aria-checked={authMode === "register"}
              onClick={() => {
                setAuthFeedback(null);
                setAuthMode("register");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                authMode === "register"
                  ? "bg-atx-paper text-atx-ink shadow-[0_2px_10px_rgba(28,25,23,0.18)]"
                  : "text-stone-500 hover:text-atx-ink"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Create key
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={authMode === "signin"}
              onClick={() => {
                setAuthFeedback(null);
                setAuthMode("signin");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                authMode === "signin"
                  ? "bg-atx-paper text-atx-ink shadow-[0_2px_10px_rgba(28,25,23,0.18)]"
                  : "text-stone-500 hover:text-atx-ink"
              }`}
            >
              <MicVocal className="h-3.5 w-3.5" />
              Sign in
            </button>
          </div>

          {authMode === "register" ? (
            <div className="grid gap-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-stone-500">
                  Artist Name
                </span>
                <input
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  placeholder="Your artist or band name"
                  className={FIELD_CLASS}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void handleRegister();
                }}
                disabled={isAuthWorking}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-atx-electric px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-atx-electric-deep disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAuthWorking ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {isAuthWorking ? "Creating…" : "Create artist key"}
              </button>
              <p className="text-xs text-stone-400">
                New here? A key is your studio credential — create one per
                artist or band name.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-stone-500">
                  Artist Key
                </span>
                <input
                  type="password"
                  value={signinKey}
                  onChange={(event) => setSigninKey(event.target.value)}
                  placeholder="atxlive_…"
                  className={`${FIELD_CLASS} font-mono`}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void handleSignIn();
                }}
                disabled={isAuthWorking}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-atx-electric px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-atx-electric-deep disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAuthWorking ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {isAuthWorking ? "Checking…" : "Sign in"}
              </button>
              <p className="text-xs text-stone-400">
                Paste the key you stored when you registered.
              </p>
            </div>
          )}

          <div aria-live="polite" className="grid gap-2">
            {authFeedback !== null ? (
              <p
                role={authFeedback.type === "error" ? "alert" : "status"}
                className={`rounded-xl border px-3 py-2.5 text-sm ${authFeedbackClass}`}
              >
                {authFeedback.message}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {revealedKey !== null ? (
        <div className="grid gap-2 rounded-xl border border-atx-stage/40 bg-atx-stage/10 p-3">
          <p className="text-xs font-semibold text-atx-stage-deep">
            Store it now — we show it once. This is the only time your full
            key appears; copy it somewhere safe before leaving this panel.
          </p>
          <code className="block break-all rounded-lg border border-atx-line bg-atx-paper px-3 py-2 font-mono text-xs text-atx-ink select-all">
            {revealedKey}
          </code>
          <button
            type="button"
            onClick={() => {
              void handleCopyKey();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-atx-line bg-atx-paper px-3 py-2 text-xs font-semibold text-atx-ink transition hover:border-atx-electric/50 hover:text-atx-electric"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy key"}
          </button>
        </div>
      ) : null}

      <div className="grid gap-3">
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
            placeholder="Citywide Austin Metro"
            className={FIELD_CLASS}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-stone-500">
            City Council District
          </span>
          <select
            required
            value={form.councilDistrict}
            onChange={(event) =>
              updateField("councilDistrict", event.target.value)
            }
            className={FIELD_CLASS}
          >
            {COUNCIL_DISTRICTS.map((entry) => (
              <option
                key={entry.label}
                value={entry.label}
                className="bg-atx-paper"
              >
                {entry.label} — {entry.area}
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

        <div className="grid gap-1.5" role="radiogroup" aria-label="Ticketing method">
          <span className="text-xs font-medium text-stone-500">
            Ticketing Method
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-full border border-atx-line bg-stone-100 p-1">
            <button
              type="button"
              role="radio"
              aria-checked={form.method === "external"}
              onClick={() => {
                setFieldErrors({});
                updateField("method", "external");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                form.method === "external"
                  ? "bg-atx-paper text-atx-ink shadow-[0_2px_10px_rgba(28,25,23,0.18)]"
                  : "text-stone-500 hover:text-atx-ink"
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              External Link
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.method === "native"}
              onClick={() => {
                setFieldErrors({});
                updateField("method", "native");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                form.method === "native"
                  ? "bg-atx-paper text-atx-ink shadow-[0_2px_10px_rgba(28,25,23,0.18)]"
                  : "text-stone-500 hover:text-atx-ink"
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              Sell Native on ATXLive
            </button>
          </div>
        </div>

        {form.method === "external" ? (
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-500">Ticket Link</span>
            <input
              required
              type="text"
              inputMode="url"
              value={form.ticketUrl}
              aria-invalid={fieldErrors.ticketUrl !== undefined}
              onChange={(event) => updateField("ticketUrl", event.target.value)}
              placeholder="https://tickets.example.com/my-show"
              className={FIELD_CLASS}
            />
            {fieldErrors.ticketUrl !== undefined ? (
              <p role="alert" className={fieldErrorClass}>
                {fieldErrors.ticketUrl}
              </p>
            ) : null}
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-stone-500">
                Price ($)
              </span>
              <input
                required
                type="number"
                inputMode="decimal"
                value={form.price}
                aria-invalid={fieldErrors.price !== undefined}
                onChange={(event) => updateField("price", event.target.value)}
                placeholder="15"
                className={FIELD_CLASS}
              />
              {fieldErrors.price !== undefined ? (
                <p role="alert" className={fieldErrorClass}>
                  {fieldErrors.price}
                </p>
              ) : null}
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-stone-500">
                Capacity
              </span>
              <input
                required
                type="number"
                inputMode="numeric"
                value={form.capacity}
                aria-invalid={fieldErrors.capacity !== undefined}
                onChange={(event) =>
                  updateField("capacity", event.target.value)
                }
                placeholder="150"
                className={FIELD_CLASS}
              />
              {fieldErrors.capacity !== undefined ? (
                <p role="alert" className={fieldErrorClass}>
                  {fieldErrors.capacity}
                </p>
              ) : null}
            </label>
          </div>
        )}
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
          onClick={(event) => {
            // Auth gates before native form validation — a signed-out
            // artist gets the themed sign-in prompt, not a browser
            // tooltip on a required field they never got to submit.
            if (auth.status !== "signed_in") {
              event.preventDefault();
              requireSignIn("publish shows");
            }
          }}
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
          disabled={isGoingLive}
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
