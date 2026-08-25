import type { AdminDataPayload, AttendanceLog, ZoneHeatRow } from "@/lib/admin-types";
import type {
  CulturalCorridor,
  HeatPing,
  LuminateSale,
  NetworkClass,
  OriginClass,
  VerifiedAttendanceEvent,
} from "@/lib/atx-live-sdk";
import { formatLuminatePipeFeed } from "@/lib/atx-live-sdk";
import { DISTRICT_ZONE_TAGS, labelForZoneTag } from "@/lib/austin-geo";

export type { AdminDataPayload, AttendanceLog } from "@/lib/admin-types";

type Store = {
  seeded: boolean;
  touristCount: number;
  localCount: number;
  unknownCount: number;
  corridorHeat: Record<CulturalCorridor, number>;
  zoneHeat: Record<string, number>;
  heatPings: HeatPing[];
  attendance: AttendanceLog[];
  sales: LuminateSale[];
};

const emptyHeat = (): Record<CulturalCorridor, number> => ({
  "red-river": 0,
  rainey: 0,
  "east-6th": 0,
  "south-congress": 0,
  "downtown-warehouse": 0,
});

const store: Store = {
  seeded: false,
  touristCount: 0,
  localCount: 0,
  unknownCount: 0,
  corridorHeat: emptyHeat(),
  zoneHeat: {},
  heatPings: [],
  attendance: [],
  sales: [],
};

const DAY = 24 * 60 * 60 * 1000;

function bumpZone(zoneTag: string, amount: number): void {
  store.zoneHeat[zoneTag] = (store.zoneHeat[zoneTag] ?? 0) + amount;
}

function seedIfNeeded(): void {
  if (store.seeded) {
    return;
  }
  store.seeded = true;
  store.touristCount = 214;
  store.localCount = 168;
  store.unknownCount = 14;
  store.corridorHeat = {
    "red-river": 94,
    rainey: 61,
    "east-6th": 128,
    "south-congress": 47,
    "downtown-warehouse": 73,
  };
  store.zoneHeat = {
    [DISTRICT_ZONE_TAGS["east-6th"]]: 128,
    [DISTRICT_ZONE_TAGS["red-river"]]: 94,
    [DISTRICT_ZONE_TAGS["downtown-warehouse"]]: 73,
    [DISTRICT_ZONE_TAGS.rainey]: 61,
    [DISTRICT_ZONE_TAGS["south-congress"]]: 47,
    Austin_78749_Slaughter: 52,
    Austin_78748_Slaughter: 31,
    Austin_78745_Menchaca: 28,
    Austin_78735_Oak_Hill: 24,
    Austin_78758_North_Lamar: 41,
    Austin_78702_East_Austin: 37,
    Austin_78613_Cedar_Park: 19,
  };

  const venues: {
    id: string;
    name: string;
    corridor: CulturalCorridor | null;
    zoneTag: string;
    zipCode: string;
  }[] = [
    { id: "VEN-RED-01", name: "Mohawk Austin", corridor: "red-river", zoneTag: DISTRICT_ZONE_TAGS["red-river"], zipCode: "78701" },
    { id: "VEN-6TH-04", name: "The Parish", corridor: "east-6th", zoneTag: DISTRICT_ZONE_TAGS["east-6th"], zipCode: "78701" },
    { id: "VEN-RAIN-02", name: "Rainey Street Stage", corridor: "rainey", zoneTag: DISTRICT_ZONE_TAGS.rainey, zipCode: "78701" },
    { id: "VEN-SLAU-11", name: "Slaughter Lane Pop-up", corridor: null, zoneTag: "Austin_78749_Slaughter", zipCode: "78749" },
    { id: "VEN-LAM-08", name: "North Lamar Patio", corridor: null, zoneTag: "Austin_78758_North_Lamar", zipCode: "78758" },
    { id: "VEN-OAK-06", name: "Oak Hill Backyard", corridor: null, zoneTag: "Austin_78735_Oak_Hill", zipCode: "78735" },
    { id: "VEN-EAST-09", name: "East Austin Warehouse", corridor: null, zoneTag: "Austin_78702_East_Austin", zipCode: "78702" },
  ];

  const now = Date.now();
  for (let i = 0; i < 24; i += 1) {
    const venue = venues[i % venues.length];
    store.attendance.push({
      sessionId: `seed-att-${i}`,
      venueId: venue.id,
      venueName: venue.name,
      corridor: venue.corridor,
      zoneTag: venue.zoneTag,
      zipCode: venue.zipCode,
      distanceMeters: 18 + (i % 7) * 12,
      withinRadius: true,
      duringShowtime: true,
      verified: true,
      inAustin: true,
      at: now - (i % 8) * DAY - (i % 5) * 36 * 60 * 1000,
    });
  }

  const catalog: Array<Omit<LuminateSale, "transactionId" | "timestamp" | "signed" | "eligible">> = [
    {
      upcCode: "093624883917",
      title: "ATX Night Shift — Vinyl",
      registeredVenueOrLocationId: "VEN-RED-01",
      physicalFormatType: "VINYL",
      quantity: 4,
      priceUsd: 28,
      currency: "USD",
      managerSignoffId: "MGR-ATX-01",
      channel: "PHYSICAL",
    },
    {
      upcCode: "602445109832",
      title: "Slaughter Lane Session — Cassette",
      registeredVenueOrLocationId: "VEN-SLAU-11",
      physicalFormatType: "CASSETTE",
      quantity: 7,
      priceUsd: 14,
      currency: "USD",
      managerSignoffId: null,
      channel: "PHYSICAL",
    },
    {
      upcCode: "888072246155",
      title: "North Lamar Live — CD",
      registeredVenueOrLocationId: "VEN-LAM-08",
      physicalFormatType: "CD",
      quantity: 10,
      priceUsd: 16,
      currency: "USD",
      managerSignoffId: "MGR-ATX-03",
      channel: "PHYSICAL",
    },
    {
      upcCode: "075678624128",
      title: "Oak Hill Backyard — Digital bundle",
      registeredVenueOrLocationId: "VEN-OAK-06",
      physicalFormatType: null,
      quantity: 12,
      priceUsd: 9.99,
      currency: "USD",
      managerSignoffId: "MGR-ATX-04",
      channel: "DIGITAL",
    },
    {
      upcCode: "190758589325",
      title: "East Austin Warehouse Vinyl",
      registeredVenueOrLocationId: "VEN-EAST-09",
      physicalFormatType: "VINYL",
      quantity: 6,
      priceUsd: 32,
      currency: "USD",
      managerSignoffId: "MGR-ATX-05",
      channel: "PHYSICAL",
    },
  ];

  catalog.forEach((row, index) => {
    const signed = Boolean(row.managerSignoffId);
    const eligible = row.channel === "PHYSICAL" && signed && row.physicalFormatType != null;
    store.sales.push({
      ...row,
      transactionId: `LUM-SEED-0${index + 1}`,
      timestamp: now - index * 5 * 60 * 60 * 1000,
      signed,
      eligible,
    });
  });
}

export function ingestSession(input: {
  origin: OriginClass;
  networkClass: NetworkClass;
}): void {
  seedIfNeeded();
  if (input.origin === "tourist") {
    store.touristCount += 1;
  } else if (input.origin === "local") {
    store.localCount += 1;
  } else {
    store.unknownCount += 1;
  }
  void input.networkClass;
}

export function ingestHeat(ping: HeatPing): void {
  seedIfNeeded();
  store.heatPings.push(ping);
  if (store.heatPings.length > 500) {
    store.heatPings.splice(0, store.heatPings.length - 500);
  }
  bumpZone(ping.zoneTag, 1);
  if (ping.corridor) {
    store.corridorHeat[ping.corridor] += 1;
  }
}

export function ingestAttendance(event: VerifiedAttendanceEvent): void {
  seedIfNeeded();
  if (!event.verified) {
    return;
  }
  store.attendance.push({
    ...event,
    venueName: event.venueId ?? "Unnamed stage",
  });
  if (store.attendance.length > 300) {
    store.attendance.splice(0, store.attendance.length - 300);
  }
}

export function ingestLuminate(sale: LuminateSale): void {
  seedIfNeeded();
  store.sales.unshift(sale);
  if (store.sales.length > 300) {
    store.sales.length = 300;
  }
}

function toZoneRows(): ZoneHeatRow[] {
  return Object.entries(store.zoneHeat)
    .map(([zoneTag, count]) => ({
      zoneTag,
      label: labelForZoneTag(zoneTag),
      count,
      kind: zoneTag.startsWith("District_") ? ("district" as const) : ("zip-zone" as const),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getAdminDataPayload(): AdminDataPayload {
  seedIfNeeded();
  const now = Date.now();
  const classified = store.touristCount + store.localCount;
  const daily = store.attendance.filter((row) => now - row.at <= DAY).length;
  const weekly = store.attendance.filter((row) => now - row.at <= 7 * DAY).length;
  const pending = store.sales.filter((sale) => sale.channel === "PHYSICAL" && !sale.signed).length;
  const signed = store.sales.filter((sale) => sale.eligible).length;
  const ineligible = store.sales.filter((sale) => !sale.eligible).length;
  return {
    hot: {
      touristCount: store.touristCount,
      localCount: store.localCount,
      unknownCount: store.unknownCount,
      touristPercent: classified === 0 ? 0 : Math.round((store.touristCount / classified) * 100),
      localPercent: classified === 0 ? 0 : Math.round((store.localCount / classified) * 100),
    },
    corridorHeat: { ...store.corridorHeat },
    zoneHeat: toZoneRows(),
    attendance: {
      daily,
      weekly,
      logs: [...store.attendance].sort((a, b) => b.at - a.at),
    },
    luminate: {
      pending,
      signed,
      ineligible,
      sales: [...store.sales].sort((a, b) => b.timestamp - a.timestamp),
    },
    generatedAt: now,
  };
}

export function getLuminatePipeFeed(): string {
  seedIfNeeded();
  return formatLuminatePipeFeed(store.sales);
}
