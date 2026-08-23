/**
 * ATX Live Universal Municipal & Luminate Data SDK
 *
 * Standalone, non-blocking client service for citywide HOT / cultural-impact
 * metrics and physical-only Luminate POS formatting. Capture modules emit events
 * to `/api/sdk/events` for the Admin Data Room (`/admin/data-room`).
 *
 *   1. Isolated session tokens (sessionStorage, no accounts)
 *   2. Network-origin heuristics (tourist vs local / HOT ratio)
 *   3. Citywide heat pings (district tag or Austin_{zip}_{neighborhood})
 *   4. Event-driven attendance checks anywhere in the municipal box
 *   5. Physical-only Luminate POS rows with venue / pop-up sign-off anchors
 *
 * No PII, no persistent device fingerprint, no continuous GPS.
 */

import {
  type CulturalCorridor,
  type LatLng,
  type LocationIndex,
  corridorAt,
  indexLocation,
  isWithinMunicipalBounds,
  labelForZoneTag,
} from "@/lib/austin-geo";

export type {
  CulturalCorridor,
  LatLng,
  LocationIndex,
  LocationKind,
} from "@/lib/austin-geo";
export { corridorAt, indexLocation, isWithinMunicipalBounds, labelForZoneTag };

export type HeatAction = "view" | "search" | "filter";

export type NetworkClass =
  | "austin-residential"
  | "cellular-roaming"
  | "hotel-wifi"
  | "airport-arrival"
  | "unknown";

export type OriginClass = "local" | "tourist" | "unknown";

export type VenueAttendanceTarget = LatLng & {
  id?: string;
  liveAt?: number;
  liveUntil?: number;
};

export type HeatPing = {
  sessionId: string;
  action: HeatAction;
  lat: number | null;
  lng: number | null;
  corridor: CulturalCorridor | null;
  zoneTag: string;
  zipCode: string | null;
  neighborhood: string | null;
  at: number;
};

export type VerifiedAttendanceEvent = {
  sessionId: string;
  venueId: string | null;
  corridor: CulturalCorridor | null;
  zoneTag: string;
  zipCode: string | null;
  distanceMeters: number | null;
  withinRadius: boolean;
  duringShowtime: boolean;
  verified: boolean;
  inAustin: boolean;
  at: number;
};

export type MunicipalSnapshot = {
  sessionId: string;
  origin: OriginClass;
  networkClass: NetworkClass;
  touristCount: number;
  localCount: number;
  touristToLocalRatio: number | null;
  corridorHeat: Record<CulturalCorridor, number>;
  zoneHeat: Record<string, number>;
  heatPings: number;
  verifiedAttendanceCount: number;
  luminatePending: number;
  luminateSigned: number;
  generatedAt: number;
};

export type PhysicalFormatType = "VINYL" | "CD" | "CASSETTE";

export type LuminateSaleInput = {
  upcCode: string;
  registeredVenueId?: string;
  locationAnchor?: LatLng & { address?: string };
  managerSignoffId?: string | null;
  quantity: number;
  priceUsd?: number;
  unitPriceCents?: number;
  soldAt?: number;
  channel?: "PHYSICAL" | "DIGITAL";
  physicalFormatType?: PhysicalFormatType | "DIGITAL_DOWNLOAD";
  title?: string;
};

export type LuminateSale = {
  transactionId: string;
  upcCode: string;
  physicalFormatType: PhysicalFormatType | null;
  quantity: number;
  priceUsd: number;
  currency: "USD";
  registeredVenueOrLocationId: string;
  managerSignoffId: string | null;
  timestamp: number;
  channel: "PHYSICAL" | "DIGITAL";
  title: string;
  signed: boolean;
  eligible: boolean;
};

export type SdkCaptureEvent =
  | { kind: "session"; sessionId: string; origin: OriginClass; networkClass: NetworkClass; at: number }
  | { kind: "heat"; ping: HeatPing }
  | { kind: "attendance"; event: VerifiedAttendanceEvent }
  | { kind: "luminate"; sale: LuminateSale };

type NetworkHints = {
  isp?: string;
  org?: string;
  hostname?: string;
  city?: string;
  region?: string;
};

type SessionRecord = {
  id: string;
  createdAt: number;
  origin: OriginClass;
  networkClass: NetworkClass;
};

const SESSION_KEY = "atx-live.session";
const METRICS_KEY = "atx-live.metrics";
const ATTENDANCE_RADIUS_M = 150;
const AUSTIN_TZ = "America/Chicago";
const MAX_HEAT_LOG = 200;

const HOTEL_HINTS = [
  "hotel",
  "marriott",
  "hilton",
  "hyatt",
  "inn",
  "fairmont",
  "residence inn",
  "courtyard",
];
const AIRPORT_HINTS = ["airport", "aus", "bergstrom"];
const RESIDENTIAL_HINTS = [
  "spectrum",
  "grande",
  "google fiber",
  "suddenlink",
  "astound",
  "att",
  "at&t",
];
const CELLULAR_HINTS = ["verizon", "t-mobile", "cellular", "wireless", "mobility"];

type StoredMetrics = {
  touristCount: number;
  localCount: number;
  corridorHeat: Record<CulturalCorridor, number>;
  zoneHeat: Record<string, number>;
  verifiedAttendanceCount: number;
  luminatePending: number;
  luminateSigned: number;
};

const emptyHeat = (): Record<CulturalCorridor, number> => ({
  "red-river": 0,
  rainey: 0,
  "east-6th": 0,
  "south-congress": 0,
  "downtown-warehouse": 0,
});

const EVENTS_ENDPOINT = "/api/sdk/events";
const UPC_PATTERN = /^\d{12,13}$/;

const memory: {
  session: SessionRecord | null;
  heatLog: HeatPing[];
  luminateQueue: LuminateSale[];
  metrics: StoredMetrics;
  originReady: boolean;
} = {
  session: null,
  heatLog: [],
  luminateQueue: [],
  metrics: {
    touristCount: 0,
    localCount: 0,
    corridorHeat: emptyHeat(),
    zoneHeat: {},
    verifiedAttendanceCount: 0,
    luminatePending: 0,
    luminateSigned: 0,
  },
  originReady: false,
};

function canUseBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function createToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `atx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function readJson<T>(key: string): T | null {
  if (!canUseBrowser()) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseBrowser()) {
    return;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* session-only storage is best-effort */
  }
}

function loadMetrics(): StoredMetrics {
  const stored = readJson<StoredMetrics>(METRICS_KEY);
  if (!stored) {
    return memory.metrics;
  }
  return {
    touristCount: stored.touristCount ?? 0,
    localCount: stored.localCount ?? 0,
    corridorHeat: { ...emptyHeat(), ...stored.corridorHeat },
    zoneHeat: stored.zoneHeat ?? {},
    verifiedAttendanceCount: stored.verifiedAttendanceCount ?? 0,
    luminatePending: stored.luminatePending ?? 0,
    luminateSigned: stored.luminateSigned ?? 0,
  };
}

function emitCapture(event: SdkCaptureEvent): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const body = JSON.stringify(event);
    if (typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        EVENTS_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (queued) {
        return;
      }
    }
    void fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* capture must never block the map */
  }
}

function persistMetrics(): void {
  writeJson(METRICS_KEY, memory.metrics);
}

function includesHint(value: string, hints: string[]): boolean {
  const haystack = value.toLowerCase();
  return hints.some((hint) => haystack.includes(hint));
}

function connectionType(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  const connection = (
    navigator as Navigator & {
      connection?: { type?: string; effectiveType?: string };
    }
  ).connection;
  return `${connection?.type ?? ""} ${connection?.effectiveType ?? ""}`.toLowerCase();
}

function timezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinAttendanceRadius(
  user: LatLng,
  venue: LatLng,
  radiusMeters = ATTENDANCE_RADIUS_M,
): boolean {
  return distanceMeters(user, venue) <= radiusMeters;
}

export function isDuringShowtime(
  liveAt?: number,
  liveUntil?: number,
  now = Date.now(),
): boolean {
  if (liveAt == null || liveUntil == null) {
    return false;
  }
  return now >= liveAt && now <= liveUntil;
}

export function classifyNetworkOrigin(hints: NetworkHints = {}): {
  origin: OriginClass;
  networkClass: NetworkClass;
} {
  const blob = `${hints.isp ?? ""} ${hints.org ?? ""} ${hints.hostname ?? ""} ${hints.city ?? ""} ${hints.region ?? ""}`;
  const zone = timezoneName();
  const link = connectionType();
  const inAustin =
    includesHint(blob, ["austin"]) ||
    includesHint(hints.city ?? "", ["austin"]) ||
    zone === AUSTIN_TZ;

  let networkClass: NetworkClass = "unknown";
  if (includesHint(blob, AIRPORT_HINTS)) {
    networkClass = "airport-arrival";
  } else if (includesHint(blob, HOTEL_HINTS)) {
    networkClass = "hotel-wifi";
  } else if (link.includes("cellular") || includesHint(blob, CELLULAR_HINTS)) {
    networkClass = "cellular-roaming";
  } else if (inAustin && (includesHint(blob, RESIDENTIAL_HINTS) || link.includes("wifi") || link.includes("ethernet") || blob.trim() === "")) {
    networkClass = "austin-residential";
  }

  let origin: OriginClass = "unknown";
  if (networkClass === "hotel-wifi" || networkClass === "airport-arrival") {
    origin = "tourist";
  } else if (zone && zone !== AUSTIN_TZ) {
    origin = "tourist";
  } else if (inAustin && networkClass === "austin-residential") {
    origin = "local";
  } else if (inAustin) {
    origin = "local";
  }

  return { origin, networkClass };
}

function applyOrigin(origin: OriginClass, networkClass: NetworkClass): void {
  if (!memory.session) {
    return;
  }

  const previous = memory.session.origin;
  memory.session.origin = origin;
  memory.session.networkClass = networkClass;
  writeJson(SESSION_KEY, memory.session);

  if (memory.originReady) {
    if (previous === origin) {
      return;
    }
    if (previous === "tourist") {
      memory.metrics.touristCount = Math.max(0, memory.metrics.touristCount - 1);
    } else if (previous === "local") {
      memory.metrics.localCount = Math.max(0, memory.metrics.localCount - 1);
    }
    if (origin === "tourist") {
      memory.metrics.touristCount += 1;
    } else if (origin === "local") {
      memory.metrics.localCount += 1;
    }
    persistMetrics();
    emitCapture({
      kind: "session",
      sessionId: memory.session.id,
      origin,
      networkClass,
      at: Date.now(),
    });
    return;
  }

  memory.originReady = origin !== "unknown";
  if (origin === "tourist") {
    memory.metrics.touristCount += 1;
  } else if (origin === "local") {
    memory.metrics.localCount += 1;
  }
  persistMetrics();
  emitCapture({
    kind: "session",
    sessionId: memory.session.id,
    origin,
    networkClass,
    at: Date.now(),
  });
}

async function refineOriginFromPublicHints(): Promise<void> {
  if (typeof fetch !== "function") {
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      city?: string;
      region?: string;
      org?: string;
      timezone?: string;
    };
    const classified = classifyNetworkOrigin({
      city: payload.city,
      region: payload.region,
      org: payload.org,
      isp: payload.org,
    });
    if (payload.timezone && payload.timezone !== AUSTIN_TZ && classified.origin !== "local") {
      applyOrigin("tourist", classified.networkClass);
      return;
    }
    applyOrigin(classified.origin, classified.networkClass);
  } catch {
    /* stay on local heuristics — never surface network errors */
  }
}

export function initAtxLiveSdk(): SessionRecord {
  if (memory.session) {
    return memory.session;
  }

  memory.metrics = loadMetrics();

  const existing = readJson<SessionRecord>(SESSION_KEY);
  if (existing?.id) {
    memory.session = existing;
    memory.originReady = existing.origin !== "unknown";
    emitCapture({
      kind: "session",
      sessionId: existing.id,
      origin: existing.origin,
      networkClass: existing.networkClass,
      at: Date.now(),
    });
    return existing;
  }

  const localGuess = classifyNetworkOrigin();
  const session: SessionRecord = {
    id: createToken(),
    createdAt: Date.now(),
    origin: localGuess.origin,
    networkClass: localGuess.networkClass,
  };
  memory.session = session;
  writeJson(SESSION_KEY, session);
  applyOrigin(localGuess.origin, localGuess.networkClass);

  void refineOriginFromPublicHints();
  return session;
}

export function getSessionId(): string {
  return initAtxLiveSdk().id;
}

export function pingLocation(action: HeatAction, point?: LatLng | null): HeatPing {
  const sessionId = getSessionId();
  const indexed: LocationIndex | null = point ? indexLocation(point) : null;
  const ping: HeatPing = {
    sessionId,
    action,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    corridor: indexed?.corridor ?? null,
    zoneTag: indexed?.zoneTag ?? "Austin_Citywide_Popup",
    zipCode: indexed?.zipCode ?? null,
    neighborhood: indexed?.neighborhood ?? null,
    at: Date.now(),
  };
  memory.heatLog.push(ping);
  if (memory.heatLog.length > MAX_HEAT_LOG) {
    memory.heatLog.splice(0, memory.heatLog.length - MAX_HEAT_LOG);
  }
  memory.metrics.zoneHeat[ping.zoneTag] = (memory.metrics.zoneHeat[ping.zoneTag] ?? 0) + 1;
  if (ping.corridor) {
    memory.metrics.corridorHeat[ping.corridor] += 1;
  }
  persistMetrics();
  emitCapture({ kind: "heat", ping });
  return ping;
}

export function pingCorridor(action: HeatAction, point?: LatLng | null): HeatPing {
  return pingLocation(action, point);
}

function readBrowserPosition(): Promise<LatLng | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60_000,
        },
      );
    } catch {
      resolve(null);
    }
  });
}

export async function verifyAttendance(
  venue: VenueAttendanceTarget,
): Promise<VerifiedAttendanceEvent> {
  const sessionId = getSessionId();
  const duringShowtime = isDuringShowtime(venue.liveAt, venue.liveUntil);
  const user = await readBrowserPosition();
  const distance = user ? distanceMeters(user, venue) : null;
  const withinRadius = distance != null && distance <= ATTENDANCE_RADIUS_M;
  const verified = withinRadius && duringShowtime;
  const indexed = indexLocation(venue);
  const event: VerifiedAttendanceEvent = {
    sessionId,
    venueId: venue.id ?? null,
    corridor: indexed.corridor,
    zoneTag: indexed.zoneTag,
    zipCode: indexed.zipCode,
    distanceMeters: distance,
    withinRadius,
    duringShowtime,
    verified,
    inAustin: indexed.inAustin,
    at: Date.now(),
  };
  if (verified) {
    memory.metrics.verifiedAttendanceCount += 1;
    persistMetrics();
  }
  emitCapture({ kind: "attendance", event });
  return event;
}

export function recordPhysicalSale(input: LuminateSaleInput): LuminateSale | null {
  const upcCode = input.upcCode.replace(/\s+/g, "");
  if (!UPC_PATTERN.test(upcCode)) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }

  const locationId =
    input.registeredVenueId?.trim() ||
    (input.locationAnchor
      ? `POPUP_${input.locationAnchor.lat.toFixed(5)}_${input.locationAnchor.lng.toFixed(5)}`
      : "");
  if (!locationId) {
    return null;
  }

  const digital =
    input.channel === "DIGITAL" || input.physicalFormatType === "DIGITAL_DOWNLOAD";
  const format: PhysicalFormatType | null = digital
    ? null
    : input.physicalFormatType === "VINYL" ||
        input.physicalFormatType === "CD" ||
        input.physicalFormatType === "CASSETTE"
      ? input.physicalFormatType
      : "VINYL";
  const managerSignoffId = input.managerSignoffId?.trim() || null;
  const priceUsd =
    input.priceUsd ??
    (input.unitPriceCents != null ? input.unitPriceCents / 100 : 0);
  const sale: LuminateSale = {
    transactionId: createToken(),
    upcCode,
    physicalFormatType: format,
    quantity: Math.round(input.quantity),
    priceUsd: Math.max(0, Number(priceUsd.toFixed(2))),
    currency: "USD",
    registeredVenueOrLocationId: locationId,
    managerSignoffId,
    timestamp: input.soldAt ?? Date.now(),
    channel: digital ? "DIGITAL" : "PHYSICAL",
    title: input.title?.trim() ?? "",
    signed: Boolean(managerSignoffId),
    eligible: !digital && Boolean(format) && Boolean(managerSignoffId),
  };
  memory.luminateQueue.push(sale);
  if (sale.eligible) {
    memory.metrics.luminateSigned += 1;
  } else {
    memory.metrics.luminatePending += 1;
  }
  persistMetrics();
  emitCapture({ kind: "luminate", sale });
  return sale;
}

export function formatLuminatePipeFeed(sales: LuminateSale[]): string {
  const header = [
    "Transaction_ID",
    "UPC_Code",
    "Physical_Format_Type",
    "Quantity",
    "Price_USD",
    "Currency",
    "Registered_Venue_or_Location_ID",
    "Manager_Signoff_ID",
    "Timestamp",
  ].join("|");
  const rows = sales
    .filter((sale) => sale.eligible && sale.channel === "PHYSICAL" && sale.signed)
    .map((sale) =>
      [
        sale.transactionId,
        sale.upcCode,
        sale.physicalFormatType ?? "",
        String(sale.quantity),
        sale.priceUsd.toFixed(2),
        sale.currency,
        sale.registeredVenueOrLocationId,
        sale.managerSignoffId ?? "",
        new Date(sale.timestamp).toISOString(),
      ].join("|"),
    );
  return [header, ...rows].join("\n");
}

export function exportLuminatePipeFeed(): string {
  return formatLuminatePipeFeed(memory.luminateQueue);
}

export function getMunicipalSnapshot(): MunicipalSnapshot {
  initAtxLiveSdk();
  const { touristCount, localCount, corridorHeat, verifiedAttendanceCount } =
    memory.metrics;
  return {
    sessionId: memory.session?.id ?? "",
    origin: memory.session?.origin ?? "unknown",
    networkClass: memory.session?.networkClass ?? "unknown",
    touristCount,
    localCount,
    touristToLocalRatio: localCount === 0 ? null : touristCount / localCount,
    corridorHeat: { ...corridorHeat },
    zoneHeat: { ...memory.metrics.zoneHeat },
    heatPings: memory.heatLog.length,
    verifiedAttendanceCount,
    luminatePending: memory.metrics.luminatePending,
    luminateSigned: memory.metrics.luminateSigned,
    generatedAt: Date.now(),
  };
}

export const atxLiveSdk = {
  init: initAtxLiveSdk,
  getSessionId,
  classifyNetworkOrigin,
  pingLocation,
  pingCorridor,
  verifyAttendance,
  recordPhysicalSale,
  formatLuminatePipeFeed,
  exportLuminatePipeFeed,
  getMunicipalSnapshot,
  corridorAt,
  indexLocation,
  isWithinMunicipalBounds,
  labelForZoneTag,
  distanceMeters,
  isWithinAttendanceRadius,
  isDuringShowtime,
  ATTENDANCE_RADIUS_M,
};

export default atxLiveSdk;
