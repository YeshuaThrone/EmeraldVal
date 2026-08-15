import { NextRequest, NextResponse } from "next/server";
import { geocodeAustinQuery } from "@/lib/nominatim";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) {
      return NextResponse.json(
        { error: "Enter a street or intersection." },
        { status: 400 },
      );
    }

    const hit = await geocodeAustinQuery(query);
    if (!hit) {
      return NextResponse.json(
        { error: "Location not found. Try a more specific Austin street." },
        { status: 404 },
      );
    }

    return NextResponse.json(hit);
  } catch {
    return NextResponse.json(
      { error: "Failed to geocode that location." },
      { status: 500 },
    );
  }
}
