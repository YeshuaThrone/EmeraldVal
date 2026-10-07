import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateVaultReleasePayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { releaseVaultPending } from "@/modules/vaults/engine";

/**
 * GET /api/v1/vaults — FBO sub-ledger balances.
 * POST /api/v1/vaults `{ action: "release" }` — pending → available.
 */

export async function GET(request: NextRequest) {
  try {
    const store = getStore();
    const payeeId = request.nextUrl.searchParams.get("payee_id")?.trim() ?? "";
    if (payeeId !== "") {
      const vault = store.getVault(payeeId);
      if (vault === undefined) {
        return jsonError(404, "vault_not_found", "No sovereign vault exists for that payee.");
      }
      return NextResponse.json(vault);
    }
    return NextResponse.json({ vaults: store.listVaults() });
  } catch (error) {
    console.error("Failed vault lookup:", error);
    return jsonError(500, "store_failure", "Failed to read sovereign vaults.");
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateVaultReleasePayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `vault-release:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many vault requests from this address. Try again later.",
    );
  }

  try {
    const result = releaseVaultPending(
      getStore(),
      parsed.value.payee_id,
      parsed.value.amount_cents,
    );
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed vault release:", error);
    return jsonError(500, "store_failure", "Failed to release pending balance.");
  }
}
