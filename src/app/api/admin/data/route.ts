import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { getAdminDataPayload, getLuminatePipeFeed } from "@/lib/municipal-store";

function unauthorized() {
  return NextResponse.json({ error: "Super-admin JWT required." }, { status: 401 });
}

function readClaims(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const claims = readClaims(request);
    if (!claims) {
      return unauthorized();
    }

    if (request.nextUrl.searchParams.get("export") === "luminate") {
      const feed = getLuminatePipeFeed();
      return new NextResponse(feed, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": 'attachment; filename="luminate-physical-pos.txt"',
        },
      });
    }

    return NextResponse.json(getAdminDataPayload());
  } catch {
    return NextResponse.json({ error: "Failed to load municipal metrics." }, { status: 500 });
  }
}
