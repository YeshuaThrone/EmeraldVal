import type { GeocodeResponse } from "@/lib/types";

type GeocodePayload = {
  lat?: number;
  lng?: number;
  displayName?: string;
  error?: string;
};

function readPayload(data: GeocodePayload): GeocodeResponse {
  if (
    typeof data.lat === "number" &&
    Number.isFinite(data.lat) &&
    typeof data.lng === "number" &&
    Number.isFinite(data.lng) &&
    typeof data.displayName === "string" &&
    data.displayName.length > 0
  ) {
    return {
      ok: true,
      lat: data.lat,
      lng: data.lng,
      displayName: data.displayName,
    };
  }

  return { ok: false, error: data.error ?? "Location not found" };
}

export async function geocodeQuery(query: string): Promise<GeocodeResponse> {
  try {
    const response = await fetch(
      `/api/geocode?q=${encodeURIComponent(query)}`,
    );
    const data = (await response.json()) as GeocodePayload;
    return readPayload(data);
  } catch {
    return {
      ok: false,
      error: "Could not reach the geocoder. Try again.",
    };
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResponse> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
    });
    const response = await fetch(`/api/reverse?${params.toString()}`);
    const data = (await response.json()) as GeocodePayload;
    return readPayload(data);
  } catch {
    return {
      ok: false,
      error: "Could not reverse-geocode that point.",
    };
  }
}

export function parseTipHandle(raw: string): { cashApp: string; venmo: string } {
  const value = raw.trim();
  if (value.startsWith("@")) {
    return { cashApp: "", venmo: value.replace(/^@+/, "") };
  }
  if (value.startsWith("$")) {
    return { cashApp: value.replace(/^\$+/, ""), venmo: "" };
  }
  return { cashApp: value, venmo: "" };
}

export function shortenDisplayName(name: string): string {
  return name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}
