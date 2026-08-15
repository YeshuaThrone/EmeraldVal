import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT =
  "ATXLive/1.0 (Austin Live Music Map; github.com/YeshuaThrone/EmeraldVal)";

type NominatimReverse = {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
  };
};

function formatName(data: NominatimReverse): string {
  const road = data.address?.road ?? data.address?.pedestrian;
  const area =
    data.address?.neighbourhood ?? data.address?.suburb ?? data.address?.city;
  if (road && area) {
    return `${road}, ${area}`;
  }
  if (road) {
    return `${road}, Austin`;
  }
  return data.display_name ?? "Dropped pin, Austin";
}

export async function GET(request: NextRequest) {
  try {
    const latParam = request.nextUrl.searchParams.get("lat");
    const lonParam = request.nextUrl.searchParams.get("lon");
    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { error: "Valid lat and lon are required." },
        { status: 400 },
      );
    }

    const url = new URL(NOMINATIM_REVERSE);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const nominatimResponse = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (!nominatimResponse.ok) {
      return NextResponse.json(
        { error: "Reverse geocoding is unavailable." },
        { status: 502 },
      );
    }

    const data = (await nominatimResponse.json()) as NominatimReverse;
    return NextResponse.json({
      lat,
      lng: lon,
      displayName: formatName(data),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reverse-geocode that point." },
      { status: 500 },
    );
  }
}
