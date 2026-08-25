import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import type { FanCapture } from "@/lib/fan-captures";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json({ error: "Super-admin JWT required." }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ configured: false, captures: [] as FanCapture[] });
    }

    const client = getSupabase();
    if (!client) {
      return NextResponse.json({ configured: false, captures: [] as FanCapture[] });
    }

    const { data, error } = await client
      .from("fan_captures")
      .select("id, phone, email, first_name, artist_id, stage, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json(
        { configured: true, captures: [] as FanCapture[], error: "Fan capture table is unavailable." },
        { status: 200 },
      );
    }

    return NextResponse.json({
      configured: true,
      captures: (data ?? []) as FanCapture[],
    });
  } catch {
    return NextResponse.json({ error: "Failed to load fan captures." }, { status: 500 });
  }
}
