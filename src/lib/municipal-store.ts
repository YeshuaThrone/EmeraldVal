import type {
  AttendanceLog,
  AdminDataPayload,
} from "@/lib/admin-types";
import type {
  CulturalCorridor,
  HeatPing,
  LuminateSale,
  NetworkClass,
  OriginClass,
  VerifiedAttendanceEvent,
} from "@/lib/atx-live-sdk";
import { formatLuminatePipeFeed } from "@/lib/atx-live-sdk";

export type { AdminDataPayload, AttendanceLog } from "@/lib/admin-types";

type Store = {
  seeded: boolean;
  touristCount: number;
  localCount: number;
  unknownCount: number;
  corridorHeat: Record<CulturalCorridor, number>;
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
  heatPings: [],
  attendance: [],
  sales: [],
};

const DAY = 24 * 60 * 60 * 1000;

function seedIfNeeded(): void {
  if (store.seeded) {
    return;
  }
  store.seeded = true;
  store.touristCount = 186;
  store.localCount = 114;
  store.unknownCount = 12;
  store.corridorHeat = {
    "red-river": 94,
    rainey: 61,
    "east-6th": 128,
    "south-congress": 47,
    "downtown-warehouse": 73,
  };

  const venues: { id: string; name: string; corridor: CulturalCorridor }[] = [
    { id: "VEN-RED-01", name: "Mohawk Austin", corridor: "red-river" },
    { id: "VEN-6TH-04", name: "The Parish", corridor: "east-6th" },
    { id: "VEN-RAIN-02", name: "Rainey Street Stage", corridor: "rainey" },
    { id: "VEN-SOCO-03", name: "Continental Club", corridor: "south-congress" },
    { id: "VEN-WH-07", name: "ACL Live at the Moody", corridor: "downtown-warehouse" },
  ];

  const now = Date.now();
  for (let i = 0; i < 18; i += 1) {
    const venue = venues[i % venues.length];
    store.attendance.push({
      sessionId: `seed-att-${i}`,
      venueId: venue.id,
      venueName: venue.name,
      corridor: venue.corridor,
      distanceMeters: 18 + (i % 7) * 12,
      withinRadius: true,
      duringShowtime: true,
      verified: true,
      at: now - (i % 8) * DAY - (i % 5) * 36 * 60 * 1000,
    });
  }

  const catalog = [
    { upc: "093624883917", title: "ATX Night Shift — 7\"", venue: "VEN-RED-01" },
    { upc: "602445109832", title: "Rainey Brass Live LP", venue: "VEN-RAIN-02" },
    { upc: "888072246155", title: "SoCo Strings — Physical CD", venue: "VEN-SOCO-03" },
    { upc: "075678624128", title: "Red River Revival Merch Bundle", venue: "VEN-6TH-04" },
    { upc: "190758589325", title: "Warehouse District Setlist Vinyl", venue: "VEN-WH-07" },
  ];

  catalog.forEach((row, index) => {
    const signed = index !== 1 && index !== 4;
    store.sales.push({
      upcCode: row.upc,
      registeredVenueId: row.venue,
      managerSignoffId: signed ? `MGR-ATX-0${index + 1}` : null,
      quantity: 4 + index * 3,
      unitPriceCents: 1800 + index * 400,
      soldAt: now - index * 5 * 60 * 60 * 1000,
      channel: "PHYSICAL",
      title: row.title,
      signed,
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
  if (sale.channel !== "PHYSICAL") {
    return;
  }
  store.sales.unshift(sale);
  if (store.sales.length > 300) {
    store.sales.length = 300;
  }
}

export function getAdminDataPayload(): AdminDataPayload {
  seedIfNeeded();
  const now = Date.now();
  const classified = store.touristCount + store.localCount;
  const daily = store.attendance.filter((row) => now - row.at <= DAY).length;
  const weekly = store.attendance.filter((row) => now - row.at <= 7 * DAY).length;
  const pending = store.sales.filter((sale) => !sale.signed).length;
  const signed = store.sales.filter((sale) => sale.signed).length;
  return {
    hot: {
      touristCount: store.touristCount,
      localCount: store.localCount,
      unknownCount: store.unknownCount,
      touristPercent: classified === 0 ? 0 : Math.round((store.touristCount / classified) * 100),
      localPercent: classified === 0 ? 0 : Math.round((store.localCount / classified) * 100),
    },
    corridorHeat: { ...store.corridorHeat },
    attendance: {
      daily,
      weekly,
      logs: [...store.attendance].sort((a, b) => b.at - a.at),
    },
    luminate: {
      pending,
      signed,
      sales: [...store.sales].sort((a, b) => b.soldAt - a.soldAt),
    },
    generatedAt: now,
  };
}

export function getLuminatePipeFeed(): string {
  seedIfNeeded();
  return formatLuminatePipeFeed(store.sales);
}
