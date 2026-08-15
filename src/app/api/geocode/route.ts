import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "ATXLive/1.0 (Austin Live Music Map; github.com/YeshuaThrone/EmeraldVal)";

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
};

function normalizeQuery(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ").replace(/&/g, "and");
  if (/austin/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}, Austin, Texas`;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) {
      return NextResponse.json(
        { error: "Enter a street or intersection." },
        { status: 400 },
      );
    }

    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set("q", normalizeQuery(query));
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("viewbox", "-98.05,30.55,-97.50,30.08");
    url.searchParams.set("bounded", "0");

    const nominatimResponse = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (!nominatimResponse.ok) {
      return NextResponse.json(
        { error: "Geocoding service is unavailable." },
        { status: 502 },
      );
    }

    const hits = (await nominatimResponse.json()) as NominatimHit[];
    const hit = hits[0];
    if (!hit) {
      return NextResponse.json(
        { error: "Location not found. Try a more specific Austin street." },
        { status: 404 },
      );
    }

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Geocoder returned an invalid coordinate." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      lat,
      lng,
      displayName: hit.display_name,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to geocode that location." },
      { status: 500 },
    );
  }
}
