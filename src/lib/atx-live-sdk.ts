/**
 * ATX Live Municipal & Luminate Data SDK
 *
 * Standalone, non-blocking client service for City of Austin HOT / cultural-impact
 * metrics and physical-only Luminate POS formatting. Capture modules emit events
 * to `/api/sdk/events` for the Admin Data Room (`/admin/data-room`).
 *
 *   1. Isolated session tokens (sessionStorage, no accounts)
 *   2. Network-origin heuristics (tourist vs local / HOT ratio)
 *   3. Cultural-corridor heat pings
 *   4. Event-driven attendance checks (geolocation only when invoked)
 *   5. Physical-only Luminate POS rows with venue manager sign-off anchors
 *
 * No PII, no persistent device fingerprint, no continuous GPS.
 */

export type CulturalCorridor =
  | "red-river"
  | "rainey"
  | "east-6th"
  | "south-congress"
  | "downtown-warehouse";

export type HeatAction = "view" | "search" | "filter";

export type NetworkClass =
  | "austin-residential"
  | "cellular-roaming"
  | "hotel-wifi"
  | "airport-arrival"
  | "unknown";

export type OriginClass = "local" | "tourist" | "unknown";

export type LatLng = {
  lat: number;
  lng: number;
};

export type VenueAttendanceTarget = LatLng & {
  id?: string;
  liveAt?: number;
  liveUntil?: number;
};

export type HeatPing = {
  sessionId: string;
  action: HeatAction;
  corridor: CulturalCorridor | null;
  at: number;
};

export type VerifiedAttendanceEvent = {
  sessionId: string;
  venueId: string | null;
  corridor: CulturalCorridor | null;
  distanceMeters: number | null;
  withinRadius: boolean;
  duringShowtime: boolean;
  verified: boolean;
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
  heatPings: number;
  verifiedAttendanceCount: number;
  luminatePending: number;
  luminateSigned: number;
  generatedAt: number;
};

export type LuminateSaleInput = {
  upcCode: string;
  registeredVenueId: string;
  managerSignoffId?: string | null;
  quantity: number;
  unitPriceCents: number;
  soldAt?: number;
  channel?: "PHYSICAL" | "DIGITAL";
  title?: string;
};

export type LuminateSale = {
  upcCode: string;
  registeredVenueId: string;
  managerSignoffId: string | null;
  quantity: number;
  unitPriceCents: number;
  soldAt: number;
  channel: "PHYSICAL";
  title: string;
  signed: boolean;
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

const CORRIDOR_BOUNDS: Record<
  CulturalCorridor,
  { south: number; north: number; west: number; east: number }
> = {
  "red-river": { south: 30.2648, north: 30.2712, west: -97.7396, east: -97.7346 },
  rainey: { south: 30.2548, north: 30.2616, west: -97.7418, east: -97.7364 },
  "east-6th": { south: 30.2654, north: 30.2694, west: -97.7428, east: -97.7268 },
  "south-congress": { south: 30.2448, north: 30.2588, west: -97.7526, east: -97.7452 },
  "downtown-warehouse": {
    south: 30.2638,
    north: 30.2718,
    west: -97.7518,
    east: -97.7416,
  },
};

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

export function corridorAt(point: LatLng): CulturalCorridor | null {
  const matches: CulturalCorridor[] = [];
  for (const [id, box] of Object.entries(CORRIDOR_BOUNDS) as [
    CulturalCorridor,
    (typeof CORRIDOR_BOUNDS)[CulturalCorridor],
  ][]) {
    if (
      point.lat >= box.south &&
      point.lat <= box.north &&
      point.lng >= box.west &&
      point.lng <= box.east
    ) {
      matches.push(id);
    }
  }
  if (matches.length === 0) {
    return null;
  }
  if (matches.includes("red-river")) {
    return "red-river";
  }
  if (matches.includes("east-6th")) {
    return "east-6th";
  }
  return matches[0];
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

export function pingCorridor(action: HeatAction, point?: LatLng | null): HeatPing {
  const sessionId = getSessionId();
  const corridor = point ? corridorAt(point) : null;
  const ping: HeatPing = {
    sessionId,
    action,
    corridor,
    at: Date.now(),
  };
  memory.heatLog.push(ping);
  if (memory.heatLog.length > MAX_HEAT_LOG) {
    memory.heatLog.splice(0, memory.heatLog.length - MAX_HEAT_LOG);
  }
  if (corridor) {
    memory.metrics.corridorHeat[corridor] += 1;
    persistMetrics();
  }
  emitCapture({ kind: "heat", ping });
  return ping;
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
  const event: VerifiedAttendanceEvent = {
    sessionId,
    venueId: venue.id ?? null,
    corridor: corridorAt(venue),
    distanceMeters: distance,
    withinRadius,
    duringShowtime,
    verified,
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
  if (input.channel === "DIGITAL") {
    return null;
  }
  const upcCode = input.upcCode.replace(/\s+/g, "");
  if (!UPC_PATTERN.test(upcCode) || !input.registeredVenueId.trim()) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }
  const managerSignoffId = input.managerSignoffId?.trim() || null;
  const sale: LuminateSale = {
    upcCode,
    registeredVenueId: input.registeredVenueId.trim(),
    managerSignoffId,
    quantity: Math.round(input.quantity),
    unitPriceCents: Math.max(0, Math.round(input.unitPriceCents)),
    soldAt: input.soldAt ?? Date.now(),
    channel: "PHYSICAL",
    title: input.title?.trim() ?? "",
    signed: Boolean(managerSignoffId),
  };
  memory.luminateQueue.push(sale);
  if (sale.signed) {
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
    "UPC_Code",
    "Registered_Venue_ID",
    "Manager_Signoff_ID",
    "Quantity",
    "Unit_Price_Cents",
    "Sold_At",
    "Channel",
  ].join("|");
  const rows = sales
    .filter((sale) => sale.channel === "PHYSICAL" && sale.signed && sale.managerSignoffId)
    .map((sale) =>
      [
        sale.upcCode,
        sale.registeredVenueId,
        sale.managerSignoffId,
        String(sale.quantity),
        String(sale.unitPriceCents),
        new Date(sale.soldAt).toISOString(),
        sale.channel,
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
  pingCorridor,
  verifyAttendance,
  recordPhysicalSale,
  formatLuminatePipeFeed,
  exportLuminatePipeFeed,
  getMunicipalSnapshot,
  corridorAt,
  distanceMeters,
  isWithinAttendanceRadius,
  isDuringShowtime,
  ATTENDANCE_RADIUS_M,
};

export default atxLiveSdk;
