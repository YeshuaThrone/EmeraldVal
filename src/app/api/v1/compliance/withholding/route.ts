import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateWithholdingPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import {
  applyWithholding,
  readCreatorCompliance,
} from "@/modules/compliance/engine";

/**
 * POST /api/v1/compliance/withholding — apply 24% backup withholding when
 * TIN/W-9 is unverified, accumulate YTD gross, and flag $600 1099-MISC.
 * GET /api/v1/compliance/withholding?creator_id=&tax_year= — YTD snapshot.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateWithholdingPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `withholding:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many withholding requests from this address. Try again later.",
    );
  }

  try {
    const result = applyWithholding(getStore(), {
      creator_id: parsed.value.creator_id,
      gross_cents: parsed.value.gross_cents,
      tax_year: parsed.value.tax_year ?? new Date().getUTCFullYear(),
      tin_verified: parsed.value.tin_verified,
      w9_on_file: parsed.value.w9_on_file,
    });
    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    console.error("Failed withholding:", error);
    return jsonError(500, "store_failure", "Failed to apply withholding.");
  }
}

export async function GET(request: NextRequest) {
  const creatorId = request.nextUrl.searchParams.get("creator_id")?.trim() ?? "";
  if (creatorId === "") {
    return jsonError(422, "missing_creator_id", "creator_id is required.");
  }
  const yearRaw = request.nextUrl.searchParams.get("tax_year");
  const taxYear =
    yearRaw === null || yearRaw === ""
      ? new Date().getUTCFullYear()
      : Number(yearRaw);
  if (!Number.isSafeInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    return jsonError(422, "invalid_tax_year", "tax_year must be a four-digit year.");
  }
  try {
    return NextResponse.json(readCreatorCompliance(getStore(), creatorId, taxYear));
  } catch (error) {
    console.error("Failed withholding lookup:", error);
    return jsonError(500, "store_failure", "Failed to read withholding.");
  }
}
