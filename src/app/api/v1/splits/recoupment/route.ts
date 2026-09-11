import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateRecoupmentPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { readAdvance, upsertAdvance } from "@/modules/recoupment/engine";

/**
 * POST /api/v1/splits/recoupment — record an unearned advance.
 * GET /api/v1/splits/recoupment?creator_id= — current recoupment snapshot.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateRecoupmentPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `recoupment:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many recoupment requests from this address. Try again later.",
    );
  }

  try {
    const advance = upsertAdvance(getStore(), parsed.value);
    return NextResponse.json(advance, { status: 201 });
  } catch (error) {
    console.error("Failed recoupment upsert:", error);
    return jsonError(500, "store_failure", "Failed to persist recoupment advance.");
  }
}

export async function GET(request: NextRequest) {
  const creatorId = request.nextUrl.searchParams.get("creator_id")?.trim() ?? "";
  if (creatorId === "") {
    return jsonError(422, "missing_creator_id", "creator_id is required.");
  }
  try {
    return NextResponse.json(readAdvance(getStore(), creatorId));
  } catch (error) {
    console.error("Failed recoupment lookup:", error);
    return jsonError(500, "store_failure", "Failed to read recoupment advance.");
  }
}
