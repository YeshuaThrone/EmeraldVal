import type { CulturalCorridor, LuminateSale, VerifiedAttendanceEvent } from "@/lib/atx-live-sdk";

export type AttendanceLog = VerifiedAttendanceEvent & {
  venueName: string;
};

export type ZoneHeatRow = {
  zoneTag: string;
  label: string;
  count: number;
  kind: "district" | "zip-zone";
};

export type AdminDataPayload = {
  hot: {
    touristCount: number;
    localCount: number;
    unknownCount: number;
    touristPercent: number;
    localPercent: number;
  };
  corridorHeat: Record<CulturalCorridor, number>;
  zoneHeat: ZoneHeatRow[];
  attendance: {
    daily: number;
    weekly: number;
    logs: AttendanceLog[];
  };
  luminate: {
    pending: number;
    signed: number;
    ineligible: number;
    sales: LuminateSale[];
  };
  generatedAt: number;
};
