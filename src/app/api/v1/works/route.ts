import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { clientIdentity } from "@/modules/don/http";
import { getCovenantRegistry } from "@/lib/server/covenantRegistry";
import { CovenantDistributionEngine } from "@/covenant-sdk/distribution";
import { parseWorkRegistration } from "@/covenant-sdk/manifest-parse";
import { dispatchCovenantWebhook } from "@/covenant-sdk/outbound-webhook";

/**
 * POST /api/v1/works — register a Covenant work manifest.
 *
 * Validates splits at 10000 bps and stores the work in the sandbox registry
 * (no Prisma). Failure envelope {error, code}.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const verdict = checkRateLimit(
    `covenant-works:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many work registrations from this address. Try again later.",
    );
  }

  const registry = getCovenantRegistry();
  const parsed = parseWorkRegistration(body, registry.occupiedWorkIds());
  if (!parsed.ok) {
    const status = parsed.code === "work_exists" ? 409 : 400;
    return jsonError(status, parsed.code, parsed.message);
  }

  const registered = await new CovenantDistributionEngine().registerWork(
    parsed.manifest,
  );
  if (!registered.ok) {
    return jsonError(422, registered.code, registered.message);
  }

  registry.registerWork(parsed.manifest);
  await dispatchCovenantWebhook("work.registered", {
    work: parsed.manifest,
    codeCount: registered.codeCount,
  });
  return NextResponse.json(
    {
      ok: true,
      work: parsed.manifest,
      codeCount: registered.codeCount,
    },
    { status: 201 },
  );
}

export async function GET() {
  const works = getCovenantRegistry().listWorks();
  return NextResponse.json({ ok: true, works });
}
