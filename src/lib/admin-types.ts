import type { CulturalCorridor, LuminateSale, VerifiedAttendanceEvent } from "@/lib/atx-live-sdk";

export type AttendanceLog = VerifiedAttendanceEvent & {
  venueName: string;
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
  attendance: {
    daily: number;
    weekly: number;
    logs: AttendanceLog[];
  };
  luminate: {
    pending: number;
    signed: number;
    sales: LuminateSale[];
  };
  generatedAt: number;
};
